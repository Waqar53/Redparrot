// ============================================================================
// RedParrot - ASR (Automatic Speech Recognition) Service
// Integrates Whisper.cpp (local) and Groq API (free cloud)
// ============================================================================

import { AudioCaptureService } from './audio-capture';

export interface TranscriptionResult {
    text: string;
    language: string;
    confidence: number;
    duration: number;
    timestamp: number;
}

export interface ASRConfig {
    provider: 'groq' | 'whisper-local' | 'auto';
    groqApiKey: string;
    whisperModelPath?: string;
    language?: string;
    translateToEnglish: boolean;
}

type TranscriptionCallback = (result: TranscriptionResult) => void;

const DEFAULT_CONFIG: ASRConfig = {
    provider: 'groq',
    groqApiKey: '',
    language: 'en', // Force English to avoid multi-lingual garbage
    translateToEnglish: true, // Always translate to English
};

export class ASRService {
    private config: ASRConfig;
    private isProcessing: boolean = false;
    private transcriptionCallback: TranscriptionCallback | null = null;
    private pendingRequests: number = 0;
    private maxConcurrentRequests: number = 2;

    constructor(config: Partial<ASRConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Initialize the ASR service
     */
    async initialize(): Promise<boolean> {
        try {
            // Validate configuration
            if (this.config.provider === 'groq' && !this.config.groqApiKey) {
                console.warn('[ASR] Groq API key not configured');
                return false;
            }

            console.log(`[ASR] Initialized with provider: ${this.config.provider}`);
            return true;
        } catch (error) {
            console.error('[ASR] Initialization failed:', error);
            return false;
        }
    }

    /**
     * Set callback for transcription results
     */
    onTranscription(callback: TranscriptionCallback): void {
        this.transcriptionCallback = callback;
    }

    /**
     * Transcribe audio chunk using configured provider
     */
    async transcribe(audioData: Float32Array): Promise<TranscriptionResult | null> {
        if (this.pendingRequests >= this.maxConcurrentRequests) {
            console.warn('[ASR] Too many pending requests, skipping chunk');
            return null;
        }

        this.pendingRequests++;

        try {
            const startTime = Date.now();
            let result: TranscriptionResult | null = null;

            switch (this.config.provider) {
                case 'groq':
                    result = await this.transcribeWithGroq(audioData);
                    break;
                case 'whisper-local':
                    result = await this.transcribeWithWhisperLocal(audioData);
                    break;
                case 'auto':
                    // Try local first, fallback to Groq
                    result = await this.transcribeWithWhisperLocal(audioData);
                    if (!result) {
                        result = await this.transcribeWithGroq(audioData);
                    }
                    break;
            }

            if (result && this.transcriptionCallback) {
                this.transcriptionCallback(result);
            }

            const duration = Date.now() - startTime;
            console.log(`[ASR] Transcription completed in ${duration}ms`);

            return result;
        } catch (error) {
            console.error('[ASR] Transcription error:', error);
            return null;
        } finally {
            this.pendingRequests--;
        }
    }

    /**
     * Transcribe using Groq's Whisper API (FREE tier: 750K tokens/day)
     */
    private async transcribeWithGroq(audioData: Float32Array): Promise<TranscriptionResult | null> {
        if (!this.config.groqApiKey) {
            console.error('[ASR] Groq API key not configured');
            return null;
        }

        try {
            // Convert audio to WAV blob
            const wavBlob = AudioCaptureService.float32ToWav(audioData, 16000);

            // Create form data with optimized settings
            const formData = new FormData();
            formData.append('file', wavBlob, 'audio.wav');
            formData.append('model', 'whisper-large-v3-turbo'); // Faster, more accurate model

            // Force English for consistent results - prevents multi-language garbage
            formData.append('language', 'en');

            // Add prompt to guide transcription for interview context
            formData.append('prompt', 'This is a job interview. The interviewer is asking questions about programming, software development, work experience, and technical skills. Common questions include: Tell me about yourself, What are your strengths, Describe your experience, What is the difference between, How would you handle, Walk me through your approach.');

            // Set temperature to 0 for most accurate/deterministic transcription
            formData.append('temperature', '0');

            // Call Groq API
            const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.groqApiKey}`,
                },
                body: formData,
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Groq API error: ${response.status} - ${error}`);
            }

            const data = await response.json();

            return {
                text: data.text?.trim() || '',
                language: data.language || 'unknown',
                confidence: 1.0, // Groq doesn't provide confidence
                duration: audioData.length / 16000 * 1000,
                timestamp: Date.now(),
            };
        } catch (error) {
            console.error('[ASR] Groq transcription error:', error);
            return null;
        }
    }

    /**
     * Transcribe using local Whisper.cpp (via whisper-node)
     * Requires whisper.cpp to be installed locally
     */
    private async transcribeWithWhisperLocal(audioData: Float32Array): Promise<TranscriptionResult | null> {
        try {
            // Note: This requires whisper-node package and whisper.cpp installation
            // For now, we'll implement a placeholder that can be expanded

            // In production, you would use:
            // const whisper = require('whisper-node');
            // const result = await whisper.transcribe(audioPath, { modelPath: this.config.whisperModelPath });

            console.warn('[ASR] Local Whisper not implemented, falling back to Groq');
            return null;
        } catch (error) {
            console.error('[ASR] Local Whisper error:', error);
            return null;
        }
    }

    /**
     * Real-time streaming transcription
     * Processes audio chunks as they arrive
     */
    async startRealTimeTranscription(
        audioCapture: AudioCaptureService,
        callback: TranscriptionCallback
    ): Promise<void> {
        this.transcriptionCallback = callback;
        this.isProcessing = true;

        // The audio capture will call our transcribe method for each chunk
        console.log('[ASR] Real-time transcription started');
    }

    /**
     * Stop real-time transcription
     */
    stopRealTimeTranscription(): void {
        this.isProcessing = false;
        console.log('[ASR] Real-time transcription stopped');
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<ASRConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Get supported languages
     */
    static getSupportedLanguages(): { code: string; name: string }[] {
        return [
            { code: 'auto', name: 'Auto Detect' },
            { code: 'en', name: 'English' },
            { code: 'es', name: 'Spanish' },
            { code: 'fr', name: 'French' },
            { code: 'de', name: 'German' },
            { code: 'it', name: 'Italian' },
            { code: 'pt', name: 'Portuguese' },
            { code: 'ru', name: 'Russian' },
            { code: 'ja', name: 'Japanese' },
            { code: 'ko', name: 'Korean' },
            { code: 'zh', name: 'Chinese' },
            { code: 'ar', name: 'Arabic' },
            { code: 'hi', name: 'Hindi' },
            { code: 'nl', name: 'Dutch' },
            { code: 'pl', name: 'Polish' },
            { code: 'tr', name: 'Turkish' },
            { code: 'vi', name: 'Vietnamese' },
            { code: 'th', name: 'Thai' },
            { code: 'id', name: 'Indonesian' },
            { code: 'ms', name: 'Malay' },
            { code: 'fil', name: 'Filipino' },
            { code: 'uk', name: 'Ukrainian' },
            { code: 'cs', name: 'Czech' },
            { code: 'sv', name: 'Swedish' },
            { code: 'da', name: 'Danish' },
            { code: 'fi', name: 'Finnish' },
            { code: 'no', name: 'Norwegian' },
            { code: 'el', name: 'Greek' },
            { code: 'he', name: 'Hebrew' },
            { code: 'hu', name: 'Hungarian' },
            { code: 'ro', name: 'Romanian' },
            { code: 'sk', name: 'Slovak' },
            { code: 'bg', name: 'Bulgarian' },
            { code: 'hr', name: 'Croatian' },
            { code: 'sr', name: 'Serbian' },
            { code: 'sl', name: 'Slovenian' },
            { code: 'et', name: 'Estonian' },
            { code: 'lv', name: 'Latvian' },
            { code: 'lt', name: 'Lithuanian' },
            { code: 'fa', name: 'Persian' },
            { code: 'ur', name: 'Urdu' },
            { code: 'bn', name: 'Bengali' },
            { code: 'ta', name: 'Tamil' },
            { code: 'te', name: 'Telugu' },
            { code: 'mr', name: 'Marathi' },
            { code: 'gu', name: 'Gujarati' },
            { code: 'kn', name: 'Kannada' },
            { code: 'ml', name: 'Malayalam' },
            { code: 'pa', name: 'Punjabi' },
            { code: 'sw', name: 'Swahili' },
            { code: 'af', name: 'Afrikaans' },
        ];
    }
}

// Export singleton instance
export const asrService = new ASRService();
