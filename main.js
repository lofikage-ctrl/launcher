const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { fork } = require('child_process');

let mainWindow;
let bridgeProcess = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 960,
        height: 600,
        minWidth: 800,
        minHeight: 550,
        resizable: true,
        frame: false,
        titleBarStyle: 'hidden',
        backgroundColor: '#0a0a0a',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        icon: path.join(__dirname, 'assets', 'icon.ico')
    });

    mainWindow.loadFile('index.html');

    mainWindow.on('closed', () => {
        mainWindow = null;
        stopBridge();
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    stopBridge();
    app.quit();
});

// Bridge process management
function getBridgePath() {
    // In dev: ../cloud-bridge/bridge.js
    // In production (packaged): resources/cloud-bridge/bridge.js
    if (app.isPackaged) {
        return path.join(process.resourcesPath, 'cloud-bridge', 'bridge.js');
    }
    return path.join(__dirname, '..', 'cloud-bridge', 'bridge.js');
}

ipcMain.handle('start-bridge', async (event, channelId) => {
    if (bridgeProcess) {
        return { success: false, error: 'Bridge már fut!' };
    }

    try {
        const bridgePath = getBridgePath();

        // Set environment variable for channel ID so bridge.js can use it
        const env = { ...process.env, BRIDGE_CHANNEL_ID: channelId, BRIDGE_NONINTERACTIVE: '1' };

        bridgeProcess = fork(bridgePath, [], {
            env,
            silent: true
        });

        bridgeProcess.stdout?.on('data', (data) => {
            const msg = data.toString().trim();
            if (msg && mainWindow) {
                mainWindow.webContents.send('bridge-log', msg);
            }
        });

        bridgeProcess.stderr?.on('data', (data) => {
            const msg = data.toString().trim();
            if (msg && mainWindow) {
                mainWindow.webContents.send('bridge-log', `[HIBA] ${msg}`);
            }
        });

        bridgeProcess.on('message', (msg) => {
            if (mainWindow) {
                mainWindow.webContents.send('bridge-log', typeof msg === 'string' ? msg : JSON.stringify(msg));
            }
        });

        bridgeProcess.on('exit', (code) => {
            bridgeProcess = null;
            if (mainWindow) {
                mainWindow.webContents.send('bridge-stopped', code);
            }
        });

        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('stop-bridge', async () => {
    stopBridge();
    return { success: true };
});

ipcMain.handle('get-bridge-status', async () => {
    return { running: bridgeProcess !== null };
});

ipcMain.handle('minimize-window', async () => {
    mainWindow?.minimize();
});

ipcMain.handle('close-window', async () => {
    mainWindow?.close();
});

function stopBridge() {
    if (bridgeProcess) {
        bridgeProcess.kill();
        bridgeProcess = null;
    }
}
