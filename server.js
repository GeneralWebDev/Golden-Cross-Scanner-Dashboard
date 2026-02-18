const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const glob = require('glob');

const app = express();
const PORT = process.env.PORT || 3000;

// IMPORTANT: keep this path exactly as your script folder
const SCRIPT_DIR = 'C:\\Users\\mcale\\OneDrive\\Desktop\\Golden Cross Project';

// Serve the frontend from the same folder as this server.js
app.use(cors());
app.use(express.static(__dirname));

function getLatestFile(pattern) {
  const files = glob.sync(pattern, { cwd: SCRIPT_DIR, nodir: true });
  if (!files.length) return null;

  files.sort((a, b) => {
    const statA = fs.statSync(path.join(SCRIPT_DIR, a));
    const statB = fs.statSync(path.join(SCRIPT_DIR, b));
    return statB.mtimeMs - statA.mtimeMs;
  });

  return files[0];
}

// SSE endpoint to run the scan
app.get('/api/run-scan', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // NOTE: no shell:true here. We want clean argv execution.
  const child = spawn('py', ['-u', 'golden_cross_scan.py'], {
    cwd: SCRIPT_DIR,
    windowsHide: true
  });

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  child.stdout.on('data', (data) => send({ type: 'stdout', text: data.toString() }));
  child.stderr.on('data', (data) => send({ type: 'stderr', text: data.toString() }));

  child.on('close', (code) => {
    send({ type: 'exit', code });
    res.end();
  });

  child.on('error', (err) => {
    send({ type: 'error', text: err.message });
    res.end();
  });

  // If the browser disconnects, stop the process
  req.on('close', () => {
    try { child.kill(); } catch (_) {}
  });
});

// API: Get latest matches CSV
app.get('/api/matches', (req, res) => {
  const filename = getLatestFile('matches_*.csv');
  if (!filename) return res.status(404).json({ error: 'No matches file found' });

  const content = fs.readFileSync(path.join(SCRIPT_DIR, filename), 'utf-8');
  res.json({ filename, content });
});

// API: Get latest failures CSV
app.get('/api/failures', (req, res) => {
  const filename = getLatestFile('failures_*.csv');
  if (!filename) return res.status(404).json({ error: 'No failures file found' });

  const content = fs.readFileSync(path.join(SCRIPT_DIR, filename), 'utf-8');
  res.json({ filename, content });
});

// API: Get latest run log
app.get('/api/log', (req, res) => {
  const filename = getLatestFile('run_*.log');
  if (!filename) return res.status(404).json({ error: 'No log file found' });

  const content = fs.readFileSync(path.join(SCRIPT_DIR, filename), 'utf-8');
  res.json({ filename, content });
});

app.listen(PORT, () => {
  console.log(`Golden Cross Dashboard server running at http://localhost:${PORT}`);
  console.log(`Script directory: ${SCRIPT_DIR}`);
});
