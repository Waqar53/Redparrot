// ============================================================================
// RedParrot - Process Hiding Utilities
// Platform-specific stealth implementations
// ============================================================================

const { exec } = require('child_process');
const path = require('path');

/**
 * Hide process from macOS Activity Monitor (partial)
 * Note: Complete hiding requires code signing and entitlements
 */
function hideFromActivityMonitor() {
    if (process.platform !== 'darwin') return;

    // Rename process in activity monitor
    const stealthName = 'com.apple.CoreServices.helper';
    process.title = stealthName;
}

/**
 * Hide from Windows Task Manager
 * Uses process name spoofing technique
 */
function hideFromTaskManager() {
    if (process.platform !== 'win32') return;

    try {
        // This requires native module for complete implementation
        // Here we use process renaming as a basic technique
        process.title = 'System Idle Process';
    } catch (error) {
        console.error('Failed to hide from Task Manager:', error);
    }
}

/**
 * Get disguised process names based on platform
 */
function getStealthProcessName() {
    const names = {
        darwin: [
            'com.apple.CoreServices',
            'com.apple.preferences',
            'System Preferences Helper',
            'CoreServicesUIAgent',
        ],
        win32: [
            'svchost',
            'RuntimeBroker',
            'SearchUI',
            'SystemSettings',
        ],
        linux: [
            'gnome-settings-daemon',
            'systemd-helper',
            'dbus-daemon',
        ],
    };

    const platformNames = names[process.platform] || names.linux;
    return platformNames[Math.floor(Math.random() * platformNames.length)];
}

/**
 * Set process priority to low to avoid detection
 */
function setLowPriority() {
    try {
        if (process.platform === 'win32') {
            exec(`wmic process where processid=${process.pid} CALL setpriority "below normal"`);
        } else {
            exec(`renice 10 ${process.pid}`);
        }
    } catch (error) {
        // Silently fail - not critical
    }
}

/**
 * Check if running in virtual machine (interview proctoring might check this)
 */
function isRunningInVM() {
    return new Promise((resolve) => {
        if (process.platform === 'darwin') {
            exec('sysctl -n machdep.cpu.brand_string', (err, stdout) => {
                if (err) return resolve(false);
                const vmIndicators = ['VMware', 'VirtualBox', 'Parallels', 'QEMU'];
                resolve(vmIndicators.some(v => stdout.includes(v)));
            });
        } else if (process.platform === 'win32') {
            exec('systeminfo', (err, stdout) => {
                if (err) return resolve(false);
                const vmIndicators = ['VMware', 'VirtualBox', 'Hyper-V', 'QEMU'];
                resolve(vmIndicators.some(v => stdout.includes(v)));
            });
        } else {
            resolve(false);
        }
    });
}

module.exports = {
    hideFromActivityMonitor,
    hideFromTaskManager,
    getStealthProcessName,
    setLowPriority,
    isRunningInVM,
};
