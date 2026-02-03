// ============================================================================
// RedParrot - Audio Capture Service
// Captures microphone and system audio for real-time transcription
// ============================================================================

export interface AudioCaptureConfig {
    sampleRate: number;
    channels: number;
    chunkDurationMs: number;
    enableNoiseReduction: boolean;
}

export interface AudioChunk {
    data: Float32Array;
    timestamp: number;
    duration: number;
}

type AudioChunkCallback = (chunk: AudioChunk) => void;

const DEFAULT_CONFIG: AudioCaptureConfig = {
    sampleRate: 16000, // Whisper prefers 16kHz
    channels: 1,
    chunkDurationMs: 3000, // 3 second chunks
    enableNoiseReduction: true,
};

export class AudioCaptureService {
    private config: AudioCaptureConfig;
    private audioContext: AudioContext | null = null;
    private mediaStream: MediaStream | null = null;
    private processor: ScriptProcessorNode | null = null;
    private workletNode: AudioWorkletNode | null = null;
    private analyser: AnalyserNode | null = null;
    private isCapturing: boolean = false;
    private audioBuffer: Float32Array[] = [];
    private chunkCallback: AudioChunkCallback | null = null;
    private chunkTimer: NodeJS.Timeout | null = null;
    private lastChunkTime: number = 0;

    constructor(config: Partial<AudioCaptureConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Initialize audio capture from microphone
     */
    async startMicrophoneCapture(callback: AudioChunkCallback): Promise<boolean> {
        try {
            this.chunkCallback = callback;

            // Request microphone permission
            if (window.electronAPI) {
                await window.electronAPI.requestMicrophonePermission();
            }

            // Get microphone stream
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: this.config.enableNoiseReduction,
                    autoGainControl: true,
                    sampleRate: this.config.sampleRate,
                    channelCount: this.config.channels,
                },
            });

            // Setup audio processing
            await this.setupAudioProcessing();

            this.isCapturing = true;
            this.startChunkTimer();

            console.log('[AudioCapture] Microphone capture started');
            return true;
        } catch (error) {
            console.error('[AudioCapture] Failed to start microphone capture:', error);
            return false;
        }
    }

    /**
     * Initialize audio capture from system audio (screen/window audio)
     */
    async startSystemAudioCapture(
        sourceId: string,
        callback: AudioChunkCallback
    ): Promise<boolean> {
        try {
            this.chunkCallback = callback;

            // Get system audio stream using Electron's desktopCapturer
            const constraints: MediaStreamConstraints = {
                audio: {
                    // @ts-ignore - Electron specific
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: sourceId,
                    },
                },
                video: {
                    // @ts-ignore - Required by Chrome to get audio
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: sourceId,
                    },
                },
            };

            this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

            // Remove the video track, we only need audio
            this.mediaStream.getVideoTracks().forEach(track => track.stop());

            await this.setupAudioProcessing();

            this.isCapturing = true;
            this.startChunkTimer();

            console.log('[AudioCapture] System audio capture started');
            return true;
        } catch (error) {
            console.error('[AudioCapture] Failed to start system audio capture:', error);
            return false;
        }
    }

    /**
     * Start combined capture (microphone + system audio)
     */
    async startCombinedCapture(
        systemSourceId: string,
        callback: AudioChunkCallback
    ): Promise<boolean> {
        try {
            this.chunkCallback = callback;

            // Get microphone stream
            const micStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: this.config.enableNoiseReduction,
                    autoGainControl: true,
                },
            });

            // Get system audio stream
            const systemStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    // @ts-ignore
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: systemSourceId,
                    },
                },
                video: {
                    // @ts-ignore
                    mandatory: {
                        chromeMediaSource: 'desktop',
                        chromeMediaSourceId: systemSourceId,
                    },
                },
            });

            // Remove video track
            systemStream.getVideoTracks().forEach(track => track.stop());

            // Combine streams
            this.audioContext = new AudioContext({ sampleRate: this.config.sampleRate });

            const micSource = this.audioContext.createMediaStreamSource(micStream);
            const systemSource = this.audioContext.createMediaStreamSource(systemStream);

            // Create a destination to merge streams
            const destination = this.audioContext.createMediaStreamDestination();

            micSource.connect(destination);
            systemSource.connect(destination);

            this.mediaStream = destination.stream;

            await this.setupAudioProcessing();

            this.isCapturing = true;
            this.startChunkTimer();

            console.log('[AudioCapture] Combined capture started');
            return true;
        } catch (error) {
            console.error('[AudioCapture] Failed to start combined capture:', error);
            return false;
        }
    }

    /**
     * Setup audio processing pipeline
     */
    private async setupAudioProcessing(): Promise<void> {
        if (!this.mediaStream) {
            throw new Error('No media stream available');
        }

        // Create audio context if not exists
        if (!this.audioContext) {
            this.audioContext = new AudioContext({ sampleRate: this.config.sampleRate });
        }

        // Create media stream source
        const source = this.audioContext.createMediaStreamSource(this.mediaStream);

        // Create analyser for audio level monitoring
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        source.connect(this.analyser);

        // Use ScriptProcessor for audio data access
        // Note: ScriptProcessorNode is deprecated but still widely supported
        // AudioWorklet would be preferred for production
        const bufferSize = 4096;
        this.processor = this.audioContext.createScriptProcessor(
            bufferSize,
            this.config.channels,
            this.config.channels
        );

        this.processor.onaudioprocess = (event) => {
            if (!this.isCapturing) return;

            const inputData = event.inputBuffer.getChannelData(0);
            const audioData = new Float32Array(inputData);

            // Add to buffer
            this.audioBuffer.push(audioData);
        };

        // Connect the processing chain
        this.analyser.connect(this.processor);
        this.processor.connect(this.audioContext.destination);
    }

    /**
     * Start timer to emit audio chunks at regular intervals
     */
    private startChunkTimer(): void {
        this.lastChunkTime = Date.now();

        this.chunkTimer = setInterval(() => {
            this.emitChunk();
        }, this.config.chunkDurationMs);
    }

    /**
     * Emit accumulated audio as a chunk
     */
    private emitChunk(): void {
        if (this.audioBuffer.length === 0 || !this.chunkCallback) {
            return;
        }

        // Concatenate all buffers
        const totalLength = this.audioBuffer.reduce((sum, buf) => sum + buf.length, 0);
        const combinedBuffer = new Float32Array(totalLength);

        let offset = 0;
        for (const buffer of this.audioBuffer) {
            combinedBuffer.set(buffer, offset);
            offset += buffer.length;
        }

        // Check if there's actual audio (not just silence)
        const hasAudio = this.detectVoiceActivity(combinedBuffer);

        if (hasAudio) {
            const chunk: AudioChunk = {
                data: combinedBuffer,
                timestamp: this.lastChunkTime,
                duration: Date.now() - this.lastChunkTime,
            };

            this.chunkCallback(chunk);
        }

        // Clear buffer and update timestamp
        this.audioBuffer = [];
        this.lastChunkTime = Date.now();
    }

    /**
     * Simple Voice Activity Detection (VAD)
     */
    private detectVoiceActivity(audioData: Float32Array): boolean {
        // Calculate RMS (Root Mean Square) energy
        let sum = 0;
        for (let i = 0; i < audioData.length; i++) {
            sum += audioData[i] * audioData[i];
        }
        const rms = Math.sqrt(sum / audioData.length);

        // Threshold for voice detection (adjust as needed)
        const threshold = 0.01;

        return rms > threshold;
    }

    /**
     * Get current audio level (0-1)
     */
    getAudioLevel(): number {
        if (!this.analyser) return 0;

        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(dataArray);

        const sum = dataArray.reduce((a, b) => a + b, 0);
        return sum / (dataArray.length * 255);
    }

    /**
     * Stop audio capture
     */
    stop(): void {
        this.isCapturing = false;

        if (this.chunkTimer) {
            clearInterval(this.chunkTimer);
            this.chunkTimer = null;
        }

        if (this.processor) {
            this.processor.disconnect();
            this.processor = null;
        }

        if (this.analyser) {
            this.analyser.disconnect();
            this.analyser = null;
        }

        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        this.audioBuffer = [];
        console.log('[AudioCapture] Capture stopped');
    }

    /**
     * Check if currently capturing
     */
    isActive(): boolean {
        return this.isCapturing;
    }

    /**
     * Convert Float32Array to WAV blob for API upload
     */
    static float32ToWav(audioData: Float32Array, sampleRate: number = 16000): Blob {
        const numChannels = 1;
        const bitsPerSample = 16;
        const bytesPerSample = bitsPerSample / 8;
        const blockAlign = numChannels * bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        const dataSize = audioData.length * bytesPerSample;
        const headerSize = 44;
        const totalSize = headerSize + dataSize;

        const buffer = new ArrayBuffer(totalSize);
        const view = new DataView(buffer);

        // WAV header
        const writeString = (offset: number, str: string) => {
            for (let i = 0; i < str.length; i++) {
                view.setUint8(offset + i, str.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, totalSize - 8, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true); // fmt chunk size
        view.setUint16(20, 1, true); // PCM format
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitsPerSample, true);
        writeString(36, 'data');
        view.setUint32(40, dataSize, true);

        // Convert float32 to int16
        const offset = 44;
        for (let i = 0; i < audioData.length; i++) {
            const sample = Math.max(-1, Math.min(1, audioData[i]));
            const intSample = sample < 0
                ? sample * 0x8000
                : sample * 0x7FFF;
            view.setInt16(offset + i * 2, intSample, true);
        }

        return new Blob([buffer], { type: 'audio/wav' });
    }

    /**
     * Base64 encode audio for API transmission
     */
    static async audioToBase64(audioBlob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = (reader.result as string).split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(audioBlob);
        });
    }
}

// Export singleton instance
export const audioCapture = new AudioCaptureService();
