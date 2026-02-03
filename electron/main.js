// ============================================================================
// RedParrot - AI Interview Copilot
// Electron Main Process with Advanced Stealth Features
// ============================================================================

const { app, BrowserWindow, ipcMain, screen, desktopCapturer, systemPreferences } = require('electron');
const path = require('path');
const Store = require('electron-store');

// ============================================================================
// STEALTH CONFIGURATION
// ============================================================================

// Rename process to appear as system process (stealth)
process.title = 'System Helper';

// Initialize secure store
const store = new Store({
    name: 'system-config',
    encryptionKey: 'redparrot-secure-key-2024',
});

// Global window references
let mainWindow = null;
let overlayWindow = null;
let isScreenSharing = false;

// ============================================================================
// STEALTH: PROCESS HIDING (macOS)
// ============================================================================

function hideFromDock() {
    if (process.platform === 'darwin') {
        // Hide from Dock on macOS
        app.dock?.hide();
        // Set as accessory app (no dock icon, no menu bar)
        app.setActivationPolicy('accessory');
    }
}

function setStealthProcessName() {
    // Spoof process name to appear as system process
    const stealthNames = [
        'System Helper',
        'WindowServer Helper',
        'CoreServices Helper',
        'XPC Service',
    ];
    process.title = stealthNames[Math.floor(Math.random() * stealthNames.length)];
}

// ============================================================================
// MAIN WINDOW CONFIGURATION
// ============================================================================

function createMainWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        show: false, // Hidden by default for stealth
        frame: true,
        titleBarStyle: 'hiddenInset',
        vibrancy: 'ultra-dark',
        visualEffectState: 'active',
        backgroundColor: '#0f172a',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            sandbox: false,
        },
        // Stealth: Skip taskbar on Windows
        skipTaskbar: store.get('stealthMode', true),
    });

    // Load the app
    const isDev = !app.isPackaged;
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        // mainWindow.webContents.openDevTools(); // Uncomment for debugging
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    mainWindow.once('ready-to-show', () => {
        if (!store.get('stealthMode', false)) {
            mainWindow.show();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    return mainWindow;
}

// ============================================================================
// OVERLAY WINDOW - STEALTH & UNDETECTABLE
// ============================================================================

function createOverlayWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    // Get saved position or default to bottom-right
    const savedBounds = store.get('overlayBounds', {
        x: width - 420,
        y: height - 320,
        width: 400,
        height: 300,
    });

    overlayWindow = new BrowserWindow({
        x: savedBounds.x,
        y: savedBounds.y,
        width: savedBounds.width,
        height: savedBounds.height,
        minWidth: 300,
        minHeight: 200,
        maxWidth: 800,
        maxHeight: 600,

        // ========== STEALTH FEATURES ==========
        transparent: true,           // Transparent background
        frame: false,                // No window frame
        alwaysOnTop: true,           // Always visible
        skipTaskbar: true,           // Hide from taskbar
        resizable: true,
        movable: true,
        minimizable: false,
        maximizable: false,
        closable: false,
        focusable: false,            // Don't steal focus

        // Critical for screen share invisibility
        hasShadow: false,

        // macOS specific
        vibrancy: null,              // No vibrancy effect

        // Windows specific - hide from Alt+Tab
        type: process.platform === 'win32' ? 'toolbar' : 'panel',

        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    // ========== ADVANCED STEALTH SETTINGS ==========

    // Exclude from window capture (screen sharing)
    overlayWindow.setContentProtection(true);

    // Set window level to be above screen share overlays
    if (process.platform === 'darwin') {
        overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1);
        overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    } else if (process.platform === 'win32') {
        overlayWindow.setAlwaysOnTop(true, 'pop-up-menu');
    }

    // Make window click-through in certain regions
    overlayWindow.setIgnoreMouseEvents(false);

    // Load overlay UI
    const isDev = !app.isPackaged;
    if (isDev) {
        overlayWindow.loadURL('http://localhost:5173/#/overlay');
    } else {
        overlayWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
            hash: 'overlay',
        });
    }

    // Save position on move
    overlayWindow.on('moved', () => {
        const bounds = overlayWindow.getBounds();
        store.set('overlayBounds', bounds);
    });

    overlayWindow.on('resized', () => {
        const bounds = overlayWindow.getBounds();
        store.set('overlayBounds', bounds);
    });

    return overlayWindow;
}

// ============================================================================
// SCREEN SHARE DETECTION
// ============================================================================

let screenShareCheckInterval = null;

async function checkScreenSharing() {
    try {
        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            fetchWindowIcons: false,
        });

        // Check for active screen recording/sharing indicators
        // This is a heuristic - screen sharing detection is limited
        const sharingApps = [
            'zoom.us',
            'Microsoft Teams',
            'Google Meet',
            'Slack',
            'Discord',
            'Webex',
            'Skype',
            'GoToMeeting',
        ];

        // Get running apps on macOS
        if (process.platform === 'darwin') {
            const { exec } = require('child_process');
            exec('ps aux | grep -i "screen\\|record\\|zoom\\|teams\\|meet"', (err, stdout) => {
                if (!err && stdout) {
                    const isSharing = sharingApps.some(appName =>
                        stdout.toLowerCase().includes(appName.toLowerCase())
                    );

                    if (isSharing !== isScreenSharing) {
                        isScreenSharing = isSharing;
                        handleScreenShareChange(isSharing);
                    }
                }
            });
        }
    } catch (error) {
        console.error('Screen share detection error:', error);
    }
}

function handleScreenShareChange(isSharing) {
    if (overlayWindow) {
        if (isSharing && store.get('autoHideOnShare', true)) {
            // Hide overlay when screen sharing detected
            overlayWindow.setOpacity(0);
            overlayWindow.webContents.send('screen-share-detected', true);
        } else {
            // Restore overlay
            overlayWindow.setOpacity(store.get('overlayOpacity', 0.95));
            overlayWindow.webContents.send('screen-share-detected', false);
        }
    }
}

function startScreenShareMonitor() {
    if (screenShareCheckInterval) {
        clearInterval(screenShareCheckInterval);
    }
    screenShareCheckInterval = setInterval(checkScreenSharing, 2000);
}

// ============================================================================
// IPC HANDLERS
// ============================================================================

function setupIpcHandlers() {
    // Get app settings
    ipcMain.handle('get-settings', () => {
        return {
            stealthMode: store.get('stealthMode', true),
            autoHideOnShare: store.get('autoHideOnShare', true),
            overlayOpacity: store.get('overlayOpacity', 0.95),
            answerLength: store.get('answerLength', 'medium'),
            language: store.get('language', 'en'),
            groqApiKey: store.get('groqApiKey', ''),
            ollamaEnabled: store.get('ollamaEnabled', false),
        };
    });

    // Save settings
    ipcMain.handle('save-settings', (_, settings) => {
        Object.entries(settings).forEach(([key, value]) => {
            store.set(key, value);
        });

        // Apply settings
        if (overlayWindow && settings.overlayOpacity !== undefined) {
            overlayWindow.setOpacity(settings.overlayOpacity);
        }

        return true;
    });

    // Toggle overlay visibility
    ipcMain.handle('toggle-overlay', () => {
        if (overlayWindow) {
            if (overlayWindow.isVisible()) {
                overlayWindow.hide();
            } else {
                overlayWindow.show();
            }
            return overlayWindow.isVisible();
        }
        return false;
    });

    // Set overlay opacity
    ipcMain.handle('set-overlay-opacity', (_, opacity) => {
        if (overlayWindow) {
            overlayWindow.setOpacity(opacity);
            store.set('overlayOpacity', opacity);
        }
    });

    // Set click-through mode
    ipcMain.handle('set-click-through', (_, enabled) => {
        if (overlayWindow) {
            overlayWindow.setIgnoreMouseEvents(enabled, { forward: true });
        }
    });

    // Show main window
    ipcMain.handle('show-main-window', () => {
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        }
    });

    // Hide main window
    ipcMain.handle('hide-main-window', () => {
        if (mainWindow) {
            mainWindow.hide();
        }
    });

    // Send answer to overlay
    ipcMain.handle('display-answer', (_, answerData) => {
        if (overlayWindow) {
            overlayWindow.webContents.send('new-answer', answerData);
        }
    });

    // Update transcription in overlay
    ipcMain.handle('update-transcription', (_, text) => {
        if (overlayWindow) {
            overlayWindow.webContents.send('transcription-update', text);
        }
    });

    // Screen capture for coding interviews
    ipcMain.handle('capture-screen', async () => {
        try {
            const sources = await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: { width: 1920, height: 1080 },
            });

            if (sources.length > 0) {
                const thumbnail = sources[0].thumbnail.toDataURL();
                return thumbnail;
            }
            return null;
        } catch (error) {
            console.error('Screen capture error:', error);
            return null;
        }
    });

    // Get audio sources for capture
    ipcMain.handle('get-audio-sources', async () => {
        try {
            const sources = await desktopCapturer.getSources({
                types: ['window', 'screen'],
            });
            return sources.map(s => ({ id: s.id, name: s.name }));
        } catch (error) {
            return [];
        }
    });

    // Request microphone permission (macOS)
    ipcMain.handle('request-microphone-permission', async () => {
        if (process.platform === 'darwin') {
            const status = systemPreferences.getMediaAccessStatus('microphone');
            if (status !== 'granted') {
                return await systemPreferences.askForMediaAccess('microphone');
            }
            return true;
        }
        return true;
    });

    // Minimize to tray
    ipcMain.handle('minimize-to-tray', () => {
        if (mainWindow) {
            mainWindow.hide();
        }
    });

    // Quit application
    ipcMain.handle('quit-app', () => {
        app.quit();
    });
}

// ============================================================================
// GLOBAL SHORTCUTS
// ============================================================================

function setupGlobalShortcuts() {
    const { globalShortcut } = require('electron');

    // Toggle overlay visibility (Ctrl/Cmd + Shift + O)
    globalShortcut.register('CommandOrControl+Shift+O', () => {
        if (overlayWindow) {
            if (overlayWindow.isVisible()) {
                overlayWindow.hide();
            } else {
                overlayWindow.show();
            }
        }
    });

    // Toggle main window (Ctrl/Cmd + Shift + R)
    globalShortcut.register('CommandOrControl+Shift+R', () => {
        if (mainWindow) {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow.show();
                mainWindow.focus();
            }
        }
    });

    // Emergency hide all (Ctrl/Cmd + Shift + H)
    globalShortcut.register('CommandOrControl+Shift+H', () => {
        if (mainWindow) mainWindow.hide();
        if (overlayWindow) overlayWindow.hide();
    });

    // Toggle click-through (Ctrl/Cmd + Shift + C)
    globalShortcut.register('CommandOrControl+Shift+C', () => {
        if (overlayWindow) {
            const current = overlayWindow.isIgnoreMouseEvents;
            overlayWindow.setIgnoreMouseEvents(!current, { forward: true });
        }
    });
}

// ============================================================================
// APP LIFECYCLE
// ============================================================================

app.whenReady().then(async () => {
    // Initialize stealth features
    if (store.get('stealthMode', true)) {
        hideFromDock();
        setStealthProcessName();
    }

    // Create windows
    createMainWindow();
    createOverlayWindow();

    // Setup IPC handlers
    setupIpcHandlers();

    // Setup global shortcuts
    setupGlobalShortcuts();

    // Start screen share monitoring
    startScreenShareMonitor();

    // macOS: Re-create windows when dock icon clicked
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
            createOverlayWindow();
        }
    });
});

// Quit when all windows are closed (Windows/Linux)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Cleanup on quit
app.on('will-quit', () => {
    const { globalShortcut } = require('electron');
    globalShortcut.unregisterAll();

    if (screenShareCheckInterval) {
        clearInterval(screenShareCheckInterval);
    }
});

// Handle certificate errors (development)
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    if (!app.isPackaged) {
        event.preventDefault();
        callback(true);
    } else {
        callback(false);
    }
});

// ============================================================================
// EXPORT FOR TESTING
// ============================================================================

module.exports = {
    createMainWindow,
    createOverlayWindow,
    checkScreenSharing,
};
