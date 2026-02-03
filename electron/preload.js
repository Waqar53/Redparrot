// ============================================================================
// RedParrot - Preload Script
// Secure bridge between Electron main process and renderer
// ============================================================================

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
    // ========== SETTINGS ==========
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

    // ========== WINDOW CONTROL ==========
    toggleOverlay: () => ipcRenderer.invoke('toggle-overlay'),
    setOverlayOpacity: (opacity) => ipcRenderer.invoke('set-overlay-opacity', opacity),
    setClickThrough: (enabled) => ipcRenderer.invoke('set-click-through', enabled),
    showMainWindow: () => ipcRenderer.invoke('show-main-window'),
    hideMainWindow: () => ipcRenderer.invoke('hide-main-window'),
    minimizeToTray: () => ipcRenderer.invoke('minimize-to-tray'),
    quitApp: () => ipcRenderer.invoke('quit-app'),

    // ========== INTERVIEW FEATURES ==========
    displayAnswer: (answerData) => ipcRenderer.invoke('display-answer', answerData),
    updateTranscription: (text) => ipcRenderer.invoke('update-transcription', text),

    // ========== SCREEN CAPTURE ==========
    captureScreen: () => ipcRenderer.invoke('capture-screen'),
    getAudioSources: () => ipcRenderer.invoke('get-audio-sources'),

    // ========== PERMISSIONS ==========
    requestMicrophonePermission: () => ipcRenderer.invoke('request-microphone-permission'),

    // ========== EVENT LISTENERS ==========
    onNewAnswer: (callback) => {
        ipcRenderer.on('new-answer', (_, data) => callback(data));
        return () => ipcRenderer.removeListener('new-answer', callback);
    },

    onTranscriptionUpdate: (callback) => {
        ipcRenderer.on('transcription-update', (_, text) => callback(text));
        return () => ipcRenderer.removeListener('transcription-update', callback);
    },

    onScreenShareDetected: (callback) => {
        ipcRenderer.on('screen-share-detected', (_, isSharing) => callback(isSharing));
        return () => ipcRenderer.removeListener('screen-share-detected', callback);
    },

    // ========== PLATFORM INFO ==========
    platform: process.platform,
    isPackaged: process.env.NODE_ENV === 'production',
});

// Expose safe Node.js APIs
contextBridge.exposeInMainWorld('nodeAPI', {
    // Path utilities (safe subset)
    path: {
        join: (...args) => require('path').join(...args),
        basename: (p) => require('path').basename(p),
        extname: (p) => require('path').extname(p),
    },
});

console.log('Preload script loaded successfully');
