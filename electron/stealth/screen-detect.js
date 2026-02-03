// ============================================================================
// RedParrot - Screen Share Detection
// Detect when screen sharing/recording is active
// ============================================================================

const { exec } = require('child_process');
const { desktopCapturer } = require('electron');

// Known screen sharing applications
const SCREEN_SHARE_APPS = {
    darwin: [
        'zoom.us',
        'zoom',
        'Microsoft Teams',
        'Google Chrome', // for Google Meet
        'Slack',
        'Discord',
        'Webex',
        'Skype',
        'GoToMeeting',
        'BlueJeans',
        'obs',
        'OBS Studio',
        'ScreenFlow',
        'Camtasia',
        'QuickTime Player',
    ],
    win32: [
        'Zoom.exe',
        'Teams.exe',
        'chrome.exe',
        'slack.exe',
        'Discord.exe',
        'webex.exe',
        'Skype.exe',
        'obs64.exe',
        'obs32.exe',
        'CamtasiaStudio.exe',
    ],
    linux: [
        'zoom',
        'teams',
        'chrome',
        'slack',
        'discord',
        'obs',
    ],
};

/**
 * Check if any screen recording/sharing app is running
 */
async function isScreenSharingActive() {
    return new Promise((resolve) => {
        const apps = SCREEN_SHARE_APPS[process.platform] || [];

        if (process.platform === 'darwin') {
            // Check for screen recording indicator on macOS
            exec('ps aux', (err, stdout) => {
                if (err) return resolve(false);

                const runningApps = stdout.toLowerCase();
                const hasShareApp = apps.some(app =>
                    runningApps.includes(app.toLowerCase())
                );

                // Additional check for screen recording system process
                const hasRecording = runningApps.includes('screencapturekit') ||
                    runningApps.includes('replaykit');

                resolve(hasShareApp || hasRecording);
            });
        } else if (process.platform === 'win32') {
            exec('tasklist', (err, stdout) => {
                if (err) return resolve(false);

                const runningApps = stdout.toLowerCase();
                const hasShareApp = apps.some(app =>
                    runningApps.includes(app.toLowerCase())
                );

                resolve(hasShareApp);
            });
        } else {
            exec('ps aux', (err, stdout) => {
                if (err) return resolve(false);

                const runningApps = stdout.toLowerCase();
                const hasShareApp = apps.some(app =>
                    runningApps.includes(app.toLowerCase())
                );

                resolve(hasShareApp);
            });
        }
    });
}

/**
 * Detect if OBS or similar is capturing the screen
 */
async function isOBSCapturing() {
    return new Promise((resolve) => {
        if (process.platform === 'darwin') {
            exec('ps aux | grep -i obs', (err, stdout) => {
                resolve(!err && stdout.toLowerCase().includes('obs'));
            });
        } else if (process.platform === 'win32') {
            exec('tasklist | findstr /i "obs"', (err, stdout) => {
                resolve(!err && stdout.length > 0);
            });
        } else {
            resolve(false);
        }
    });
}

/**
 * Check for active Zoom meeting
 */
async function isZoomMeetingActive() {
    return new Promise((resolve) => {
        if (process.platform === 'darwin') {
            // Check if Zoom's CptHost (screen share) process is running
            exec('ps aux | grep -i "CptHost\\|zoom.us"', (err, stdout) => {
                const isActive = !err && (
                    stdout.includes('CptHost') ||
                    stdout.includes('zoom.us')
                );
                resolve(isActive);
            });
        } else if (process.platform === 'win32') {
            exec('tasklist | findstr /i "Zoom"', (err, stdout) => {
                resolve(!err && stdout.includes('Zoom'));
            });
        } else {
            resolve(false);
        }
    });
}

/**
 * Check for active Microsoft Teams meeting
 */
async function isTeamsMeetingActive() {
    return new Promise((resolve) => {
        if (process.platform === 'darwin') {
            exec('ps aux | grep -i "Microsoft Teams"', (err, stdout) => {
                resolve(!err && stdout.includes('Teams'));
            });
        } else if (process.platform === 'win32') {
            exec('tasklist | findstr /i "Teams"', (err, stdout) => {
                resolve(!err && stdout.includes('Teams'));
            });
        } else {
            resolve(false);
        }
    });
}

/**
 * Check for active Google Meet (in Chrome)
 */
async function isGoogleMeetActive() {
    return new Promise((resolve) => {
        // This is harder to detect reliably
        // We can check for Chrome with meet.google.com in title
        if (process.platform === 'darwin') {
            exec('lsappinfo list | grep -i meet', (err, stdout) => {
                resolve(!err && stdout.toLowerCase().includes('meet'));
            });
        } else {
            resolve(false);
        }
    });
}

/**
 * Comprehensive screen share detection
 * Returns an object with detection results
 */
async function detectScreenShare() {
    const [isSharing, isOBS, isZoom, isTeams, isMeet] = await Promise.all([
        isScreenSharingActive(),
        isOBSCapturing(),
        isZoomMeetingActive(),
        isTeamsMeetingActive(),
        isGoogleMeetActive(),
    ]);

    return {
        isActive: isSharing || isOBS || isZoom || isTeams || isMeet,
        details: {
            generalSharing: isSharing,
            obs: isOBS,
            zoom: isZoom,
            teams: isTeams,
            meet: isMeet,
        },
    };
}

/**
 * Create a screen share monitor that calls callback on changes
 */
function createScreenShareMonitor(callback, intervalMs = 2000) {
    let lastState = false;

    const checkInterval = setInterval(async () => {
        try {
            const result = await detectScreenShare();

            if (result.isActive !== lastState) {
                lastState = result.isActive;
                callback(result);
            }
        } catch (error) {
            console.error('Screen share monitor error:', error);
        }
    }, intervalMs);

    return {
        stop: () => clearInterval(checkInterval),
    };
}

module.exports = {
    isScreenSharingActive,
    isOBSCapturing,
    isZoomMeetingActive,
    isTeamsMeetingActive,
    isGoogleMeetActive,
    detectScreenShare,
    createScreenShareMonitor,
    SCREEN_SHARE_APPS,
};
