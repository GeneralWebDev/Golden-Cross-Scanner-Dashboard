// Golden Cross Scanner Dashboard - Frontend JavaScript
const API_BASE = window.location.origin;

const outputStream = document.getElementById('outputStream');
const statusBadge = document.getElementById('statusBadge');
const runScanBtn = document.getElementById('runScanBtn');

// Set initial status badge class
statusBadge.className = 'status-badge idle';

// Run Scan Button Handler
runScanBtn.addEventListener('click', () => {
    startScan();
});

function startScan() {
    outputStream.textContent = '';
    setStatus('running', 'Running');
    runScanBtn.disabled = true;
    runScanBtn.textContent = '\u23F3 Scanning...';

    const eventSource = new EventSource(`${API_BASE}/api/run-scan`);

    eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'stdout' || data.type === 'stderr') {
            outputStream.textContent += data.text;
            outputStream.scrollTop = outputStream.scrollHeight;
        } else if (data.type === 'exit') {
            const code = data.code;
            if (code === 0) {
                setStatus('complete', 'Complete');
            } else {
                setStatus('error', `Exit Code: ${code}`);
            }
            runScanBtn.disabled = false;
            runScanBtn.textContent = '\u25B6 Run Scan';
            eventSource.close();
            // Auto-fetch results after scan completes
            setTimeout(() => {
                fetchMatches();
                fetchFailures();
                fetchLog();
            }, 1000);
        } else if (data.type === 'error') {
            outputStream.textContent += `\nERROR: ${data.text}\n`;
            setStatus('error', 'Error');
            runScanBtn.disabled = false;
            runScanBtn.textContent = '\u25B6 Run Scan';
            eventSource.close();
        }
    };

    eventSource.onerror = () => {
        setStatus('error', 'Connection Lost');
        runScanBtn.disabled = false;
        runScanBtn.textContent = '\u25B6 Run Scan';
        eventSource.close();
    };
}

function setStatus(className, text) {
    statusBadge.className = `status-badge ${className}`;
    statusBadge.textContent = text;
}

// Fetch Matches CSV
function fetchMatches() {
    fetch(`${API_BASE}/api/matches`)
        .then(res => {
            if (!res.ok) throw new Error('No matches file found');
            return res.json();
        })
        .then(data => {
            const container = document.getElementById('matchesDisplay');
            if (data.filename) {
                container.innerHTML = `<p style="color: var(--accent-yellow); margin-bottom: 0.5rem;">File: ${data.filename}</p>`;
                container.innerHTML += csvToTable(data.content);
            } else {
                container.textContent = 'No matches file available.';
            }
        })
        .catch(err => {
            document.getElementById('matchesDisplay').textContent = err.message;
        });
}

// Fetch Failures CSV
function fetchFailures() {
    fetch(`${API_BASE}/api/failures`)
        .then(res => {
            if (!res.ok) throw new Error('No failures file found');
            return res.json();
        })
        .then(data => {
            const container = document.getElementById('failuresDisplay');
            if (data.filename) {
                container.innerHTML = `<p style="color: var(--accent-yellow); margin-bottom: 0.5rem;">File: ${data.filename}</p>`;
                container.innerHTML += csvToTable(data.content);
            } else {
                container.textContent = 'No failures file available.';
            }
        })
        .catch(err => {
            document.getElementById('failuresDisplay').textContent = err.message;
        });
}

// Fetch Run Log
function fetchLog() {
    fetch(`${API_BASE}/api/log`)
        .then(res => {
            if (!res.ok) throw new Error('No log file found');
            return res.json();
        })
        .then(data => {
            const logDisplay = document.getElementById('logDisplay');
            if (data.filename) {
                logDisplay.textContent = `=== ${data.filename} ===\n\n${data.content}`;
            } else {
                logDisplay.textContent = 'No log file available.';
            }
        })
        .catch(err => {
            document.getElementById('logDisplay').textContent = err.message;
        });
}

// Convert CSV string to HTML table
function csvToTable(csv) {
    if (!csv || csv.trim() === '') return '<p>Empty file.</p>';
    const lines = csv.trim().split('\n');
    if (lines.length === 0) return '<p>Empty file.</p>';

    let html = '<table>';

    // Header row
    const headers = parseCSVLine(lines[0]);
    html += '<thead><tr>';
    headers.forEach(h => {
        html += `<th>${escapeHtml(h)}</th>`;
    });
    html += '</tr></thead>';

    // Data rows
    html += '<tbody>';
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '') continue;
        const cols = parseCSVLine(lines[i]);
        html += '<tr>';
        cols.forEach(c => {
            html += `<td>${escapeHtml(c)}</td>`;
        });
        html += '</tr>';
    }
    html += '</tbody></table>';
    return html;
}

// Simple CSV line parser (handles quoted fields)
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"' && i + 1 < line.length && line[i + 1] === '"') {
                current += '"';
                i++;
            } else if (ch === '"') {
                inQuotes = false;
            } else {
                current += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                result.push(current.trim());
                current = '';
            } else {
                current += ch;
            }
        }
    }
    result.push(current.trim());
    return result;
}

// Escape HTML entities
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Auto-load data on page load
window.addEventListener('DOMContentLoaded', () => {
    fetchMatches();
    fetchFailures();
    fetchLog();
});
