const { ipcRenderer } = require('electron');

// ── DOM References ──
const btnPlay = document.getElementById('btn-play');
const btnPlayText = document.querySelector('.play-btn-text');
const channelInput = document.getElementById('channelInput');
const logContent = document.getElementById('logContent');
const btnClearLog = document.getElementById('btn-clear-log');
const btnMinimize = document.getElementById('btn-minimize');
const btnClose = document.getElementById('btn-close');

const dotStreamerbot = document.getElementById('dot-streamerbot');
const dotCloud = document.getElementById('dot-cloud');
const dotBridge = document.getElementById('dot-bridge');
const valStreamerbot = document.getElementById('val-streamerbot');
const valCloud = document.getElementById('val-cloud');
const valBridge = document.getElementById('val-bridge');

let bridgeRunning = false;

// ── Tab Navigation ──
document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const tabId = btn.dataset.tab;
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.getElementById(`tab-${tabId}`).classList.add('active');
    });
});

// ── Window Controls ──
btnMinimize.addEventListener('click', () => ipcRenderer.invoke('minimize-window'));
btnClose.addEventListener('click', () => ipcRenderer.invoke('close-window'));

// ── Play Button ──
btnPlay.addEventListener('click', async () => {
    if (bridgeRunning) {
        // Stop
        addLog('Bridge leállítása...', 'warn');
        const result = await ipcRenderer.invoke('stop-bridge');
        if (result.success) {
            setBridgeState(false);
            addLog('Bridge sikeresen leállítva.', 'info');
        }
    } else {
        // Start
        const channel = channelInput.value.trim();
        if (!channel) {
            addLog('❌ Kérlek add meg a csatornád nevét!', 'error');
            channelInput.focus();
            return;
        }

        addLog(`Bridge indítása: "${channel}" csatornához...`, 'info');
        setStatus('bridge', 'yellow', 'Indítás...');

        const result = await ipcRenderer.invoke('start-bridge', channel);
        if (result.success) {
            setBridgeState(true);
            addLog('✅ Bridge sikeresen elindult!', 'success');
        } else {
            addLog(`❌ Hiba: ${result.error}`, 'error');
            setStatus('bridge', 'red', 'Hiba');
        }
    }
});

// ── Log ──
function addLog(message, type = '') {
    const line = document.createElement('p');
    line.className = `log-line ${type}`;
    const time = new Date().toLocaleTimeString('hu-HU');
    line.textContent = `[${time}] ${message}`;
    logContent.appendChild(line);
    logContent.scrollTop = logContent.scrollHeight;

    // Parse status from log messages
    if (message.includes('Sikeres csatlakozás a Streamer.bot')) {
        setStatus('streamerbot', 'green', 'Csatlakozva');
    }
    if (message.includes('felhő backend')) {
        setStatus('cloud', 'green', 'Csatlakozva');
    }
    if (message.includes('MINDEN KÉSZEN ÁLL')) {
        setStatus('streamerbot', 'green', 'Csatlakozva');
        setStatus('cloud', 'green', 'Csatlakozva');
        setStatus('bridge', 'green', 'Aktív');
    }
    if (message.includes('HIBA') || message.includes('hiba') || message.includes('Error')) {
        // Don't override specific statuses
    }
}

btnClearLog.addEventListener('click', () => {
    logContent.innerHTML = '<p class="log-line info">Log törölve.</p>';
});

// ── Status Management ──
function setStatus(component, color, text) {
    const dot = document.getElementById(`dot-${component}`);
    const val = document.getElementById(`val-${component}`);

    dot.className = `status-dot ${color}`;
    val.textContent = text;
}

function setBridgeState(running) {
    bridgeRunning = running;
    if (running) {
        btnPlay.classList.add('running');
        btnPlayText.textContent = 'LEÁLLÍTÁS';
        setStatus('bridge', 'green', 'Aktív');
        channelInput.disabled = true;
    } else {
        btnPlay.classList.remove('running');
        btnPlayText.textContent = 'INDÍTÁS';
        setStatus('bridge', 'red', 'Leállítva');
        setStatus('streamerbot', '', 'Várakozás...');
        setStatus('cloud', '', 'Várakozás...');
        channelInput.disabled = false;
    }
}

// ── IPC Listeners ──
ipcRenderer.on('bridge-log', (event, message) => {
    // Detect log type
    let type = '';
    if (message.includes('✅') || message.includes('Sikeres') || message.includes('KÉSZEN')) type = 'success';
    else if (message.includes('❌') || message.includes('HIBA') || message.includes('Error')) type = 'error';
    else if (message.includes('⚠') || message.includes('Warning')) type = 'warn';
    else type = 'info';

    addLog(message, type);
});

ipcRenderer.on('bridge-stopped', (event, code) => {
    setBridgeState(false);
    if (code === 0) {
        addLog('Bridge normálisan leállt.', 'info');
    } else {
        addLog(`Bridge váratlanul leállt (kód: ${code})`, 'error');
    }
});

// ── Initialize ──
(async () => {
    const status = await ipcRenderer.invoke('get-bridge-status');
    if (status.running) {
        setBridgeState(true);
    }
})();

// Save channel name in localStorage
channelInput.addEventListener('change', () => {
    localStorage.setItem('srg-channel', channelInput.value);
});

// Restore saved channel
const savedChannel = localStorage.getItem('srg-channel');
if (savedChannel) {
    channelInput.value = savedChannel;
}
