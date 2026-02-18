const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const glob = require('glob');

const app = express();
const PORT = 3000;

const SCRIPT_DIR = 'C:\\Users\\mcale\\OneDrive\\Desktop\\Golden Cross Project';

app.use(cors());
app.use(express.static(path.join(__dirname)));

function getLatestFile(pattern) {
    const files = glob.sync(pattern, { cwd: SCRIPT_DIR });
    if (files.length === 0) return null;
    files.sort((a, b) => {
        const statA = fs.statSync(path.join(SCRIPT_DIR, a));
        const statB = fs.statSync(path.join(SCRIPT_DIR, b));
        return statB.mtimeMs - statA.mtimeMs;
    });
    return files[0];
}

// SSE endpoint to run the scan
app.get('/api/run-scan', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const child = spawn('py', ['-u', 'golden_cross_scan.py'], {
        cwd: SCRIPT_DIR,
        shell: true
    });

    child.stdout.on('data', (data) => {
        const text = data.toString();
        res.write(`data: ${JSON.stringify({ type: 'stdout', text })}\n\n`);
    });

    child.stderr.on('data', (data) => {
        const text = data.toString();
        res.write(`data: ${JSON.stringify({ type: 'stderr', text })}\n\n`);
    });

    child.on('close', (code) => {
        res.write(`data: ${JSON.stringify({ type: 'exit', code })}\n\n`);
        res.end();
    });

    child.on('error', (err) => {
        res.write(`data: ${JSON.stringify({ type: 'error', text: err.message })}\n\n`);
        res.end();
    });

    req.on('close', () => {
        child.kill();
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
