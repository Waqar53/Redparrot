// ============================================================================
// RedParrot - Global Type Definitions
// ============================================================================

// Extend Window interface for Electron API
interface ElectronAPI {
    // Settings
    getSettings: () => Promise<Record<string, any>>;
    saveSettings: (settings: Record<string, any>) => Promise<boolean>;

    // Window Control
    toggleOverlay: () => Promise<boolean>;
    setOverlayOpacity: (opacity: number) => Promise<void>;
    setClickThrough: (enabled: boolean) => Promise<void>;
    showMainWindow: () => Promise<void>;
    hideMainWindow: () => Promise<void>;
    minimizeToTray: () => Promise<void>;
    quitApp: () => Promise<void>;

    // Interview Features
    displayAnswer: (answerData: {
        question: string;
        questionType: string;
        answers: Record<string, any>;
        defaultLength: string;
    }) => Promise<void>;
    updateTranscription: (text: string) => Promise<void>;

    // Screen Capture
    captureScreen: () => Promise<string | null>;
    getAudioSources: () => Promise<Array<{ id: string; name: string }>>;

    // Permissions
    requestMicrophonePermission: () => Promise<boolean>;

    // Event Listeners
    onNewAnswer: (callback: (data: any) => void) => () => void;
    onTranscriptionUpdate: (callback: (text: string) => void) => () => void;
    onScreenShareDetected: (callback: (isSharing: boolean) => void) => () => void;

    // Platform Info
    platform: 'darwin' | 'win32' | 'linux';
    isPackaged: boolean;
}

interface NodeAPI {
    path: {
        join: (...args: string[]) => string;
        basename: (p: string) => string;
        extname: (p: string) => string;
    };
}

declare global {
    interface Window {
        electronAPI?: ElectronAPI;
        nodeAPI?: NodeAPI;
    }
}

export { };
