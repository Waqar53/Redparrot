// ============================================================================
// RedParrot - Window Exclusion Utilities
// Hide windows from screen capture and Alt+Tab
// ============================================================================

const { exec } = require('child_process');

/**
 * Window exclusion flags for different platforms
 */
const WindowFlags = {
    // macOS window levels
    MACOS_NORMAL: 0,
    MACOS_FLOATING: 3,
    MACOS_MODAL: 8,
    MACOS_POPUP: 10,
    MACOS_SCREENSAVER: 13,

    // Windows window styles
    WIN_TOOLWINDOW: 0x00000080,
    WIN_NOACTIVATE: 0x08000000,
};

/**
 * Exclude window from macOS screen capture
 * Uses window sharing type to prevent capture
 */
function excludeFromMacScreenCapture(browserWindow) {
    if (process.platform !== 'darwin') return;

    try {
        // Set content protection - prevents screen recording
        browserWindow.setContentProtection(true);

        // Set window level above screen capture
        browserWindow.setAlwaysOnTop(true, 'screen-saver', 1);

        // Make visible on all spaces including fullscreen
        browserWindow.setVisibleOnAllWorkspaces(true, {
            visibleOnFullScreen: true,
            skipTransformProcessType: true,
        });
    } catch (error) {
        console.error('Failed to exclude from screen capture:', error);
    }
}

/**
 * Exclude window from Windows screen capture
 */
function excludeFromWinScreenCapture(browserWindow) {
    if (process.platform !== 'win32') return;

    try {
        // Set content protection
        browserWindow.setContentProtection(true);

        // Use toolbar window type to hide from Alt+Tab
        // This is set in window creation options
    } catch (error) {
        console.error('Failed to exclude from Windows capture:', error);
    }
}

/**
 * Hide window from Alt+Tab / Cmd+Tab switcher
 */
function hideFromWindowSwitcher(browserWindow) {
    try {
        if (process.platform === 'darwin') {
            // On macOS, use accessory activation policy
            const { app } = require('electron');
            app.setActivationPolicy('accessory');
        } else if (process.platform === 'win32') {
            // On Windows, skipTaskbar + toolbar type handles this
            browserWindow.setSkipTaskbar(true);
        }
    } catch (error) {
        console.error('Failed to hide from window switcher:', error);
    }
}

/**
 * Make window click-through (mouse events pass through)
 */
function setClickThrough(browserWindow, enabled, options = {}) {
    try {
        browserWindow.setIgnoreMouseEvents(enabled, {
            forward: options.forward ?? true, // Forward mouse events to windows below
        });
    } catch (error) {
        console.error('Failed to set click-through:', error);
    }
}

/**
 * Set window opacity with smooth transition
 */
function setOpacitySmooth(browserWindow, targetOpacity, duration = 200) {
    const startOpacity = browserWindow.getOpacity();
    const steps = 20;
    const stepDuration = duration / steps;
    const opacityStep = (targetOpacity - startOpacity) / steps;

    let currentStep = 0;
    const interval = setInterval(() => {
        currentStep++;
        const newOpacity = startOpacity + (opacityStep * currentStep);
        browserWindow.setOpacity(Math.max(0, Math.min(1, newOpacity)));

        if (currentStep >= steps) {
            clearInterval(interval);
            browserWindow.setOpacity(targetOpacity);
        }
    }, stepDuration);
}

module.exports = {
    WindowFlags,
    excludeFromMacScreenCapture,
    excludeFromWinScreenCapture,
    hideFromWindowSwitcher,
    setClickThrough,
    setOpacitySmooth,
};
