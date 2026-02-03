// ============================================================================
// RedParrot - Interview Pipeline Service
// Orchestrates the complete interview assistance flow
// ============================================================================

import { AudioCaptureService, AudioChunk } from './audio-capture';
import { ASRService, TranscriptionResult } from './asr-service';
import { QuestionDetectorService, DetectedQuestion } from './question-detector';
import { AIAnswerService, GeneratedAnswer, AnswerLength, ResumeData } from './ai-service';
import { useInterviewStore } from '@/stores/interview-store';

export interface PipelineConfig {
    groqApiKey: string;
    aiProvider: 'groq' | 'ollama' | 'auto';
    asrProvider: 'groq' | 'whisper-local' | 'auto';
    language: string;
    defaultAnswerLength: AnswerLength;
    audioSource: 'microphone' | 'system' | 'both';
}

export interface PipelineCallbacks {
    onTranscription?: (result: TranscriptionResult) => void;
    onQuestionDetected?: (question: DetectedQuestion) => void;
    onAnswerGenerated?: (answer: GeneratedAnswer, length: AnswerLength) => void;
    onError?: (error: Error) => void;
    onStatusChange?: (status: PipelineStatus) => void;
}

export type PipelineStatus =
    | 'idle'
    | 'initializing'
    | 'listening'
    | 'transcribing'
    | 'detecting'
    | 'generating'
    | 'error';

export class InterviewPipeline {
    private audioCapture: AudioCaptureService;
    private asrService: ASRService;
    private questionDetector: QuestionDetectorService;
    private aiService: AIAnswerService;

    private config: PipelineConfig;
    private callbacks: PipelineCallbacks;
    private status: PipelineStatus = 'idle';
    private isRunning: boolean = false;

    constructor(config: Partial<PipelineConfig> = {}, callbacks: PipelineCallbacks = {}) {
        this.config = {
            groqApiKey: '',
            aiProvider: 'groq',
            asrProvider: 'groq',
            language: 'auto',
            defaultAnswerLength: 'medium',
            audioSource: 'microphone',
            ...config,
        };

        this.callbacks = callbacks;

        // Initialize services
        this.audioCapture = new AudioCaptureService({
            sampleRate: 16000,
            channels: 1,
            chunkDurationMs: 3000,
            enableNoiseReduction: true,
        });

        this.asrService = new ASRService({
            provider: this.config.asrProvider,
            groqApiKey: this.config.groqApiKey,
            language: this.config.language,
        });

        this.questionDetector = new QuestionDetectorService();

        this.aiService = new AIAnswerService({
            provider: this.config.aiProvider,
            groqApiKey: this.config.groqApiKey,
        });
    }

    /**
     * Start the interview pipeline
     */
    async start(): Promise<boolean> {
        if (this.isRunning) {
            console.warn('[Pipeline] Already running');
            return false;
        }

        try {
            this.setStatus('initializing');

            // Initialize ASR service
            const asrReady = await this.asrService.initialize();
            if (!asrReady) {
                throw new Error('Failed to initialize ASR service');
            }

            // Start audio capture based on config
            let captureStarted = false;

            switch (this.config.audioSource) {
                case 'microphone':
                    captureStarted = await this.audioCapture.startMicrophoneCapture(
                        (chunk) => this.handleAudioChunk(chunk)
                    );
                    break;
                case 'system':
                    // System audio requires source ID from Electron
                    const sources = await window.electronAPI?.getAudioSources();
                    if (sources && sources.length > 0) {
                        captureStarted = await this.audioCapture.startSystemAudioCapture(
                            sources[0].id,
                            (chunk) => this.handleAudioChunk(chunk)
                        );
                    }
                    break;
                case 'both':
                    const allSources = await window.electronAPI?.getAudioSources();
                    if (allSources && allSources.length > 0) {
                        captureStarted = await this.audioCapture.startCombinedCapture(
                            allSources[0].id,
                            (chunk) => this.handleAudioChunk(chunk)
                        );
                    }
                    break;
            }

            if (!captureStarted) {
                throw new Error('Failed to start audio capture');
            }

            this.isRunning = true;
            this.setStatus('listening');

            console.log('[Pipeline] Started successfully');
            return true;
        } catch (error) {
            console.error('[Pipeline] Start error:', error);
            this.setStatus('error');
            this.callbacks.onError?.(error as Error);
            return false;
        }
    }

    /**
     * Stop the interview pipeline
     */
    stop(): void {
        this.audioCapture.stop();
        this.asrService.stopRealTimeTranscription();
        this.isRunning = false;
        this.setStatus('idle');
        console.log('[Pipeline] Stopped');
    }

    /**
     * Handle incoming audio chunk
     */
    private async handleAudioChunk(chunk: AudioChunk): Promise<void> {
        if (!this.isRunning) return;

        try {
            this.setStatus('transcribing');

            // Transcribe audio
            const transcription = await this.asrService.transcribe(chunk.data);

            if (!transcription || !transcription.text) {
                this.setStatus('listening');
                return;
            }

            // Notify transcription
            this.callbacks.onTranscription?.(transcription);

            // Update store
            const store = useInterviewStore.getState();
            store.addTranscriptionResult(transcription);

            // Detect question
            this.setStatus('detecting');
            const question = this.questionDetector.detectQuestion(transcription.text);

            if (question) {
                console.log('[Pipeline] Question detected:', question.text);

                // CRITICAL: Clear ALL previous state BEFORE processing new question
                // This prevents mixing of answers between questions
                store.clearTranscription(); // Clear old transcription
                store.setCurrentAnswers({ short: undefined, medium: undefined, long: undefined });
                store.setCurrentQuestion(question);

                this.callbacks.onQuestionDetected?.(question);

                // Generate answers for the new question
                await this.generateAnswers(question);
            }

            this.setStatus('listening');
        } catch (error) {
            console.error('[Pipeline] Processing error:', error);
            this.callbacks.onError?.(error as Error);
            this.setStatus('listening'); // Continue listening despite error
        }
    }

    /**
     * Generate answers for detected question
     */
    private async generateAnswers(question: DetectedQuestion): Promise<void> {
        this.setStatus('generating');

        const store = useInterviewStore.getState();
        store.setGenerating(true);

        try {
            // Generate all three lengths in parallel
            const [short, medium, long] = await Promise.all([
                this.aiService.generateAnswer(question, 'short'),
                this.aiService.generateAnswer(question, 'medium'),
                this.aiService.generateAnswer(question, 'long'),
            ]);

            const answers = { short, medium, long };

            store.setCurrentAnswers(answers);

            // Notify with the default length answer
            const defaultAnswer = answers[this.config.defaultAnswerLength];
            if (defaultAnswer) {
                this.callbacks.onAnswerGenerated?.(defaultAnswer, this.config.defaultAnswerLength);
            }

            // Send to overlay
            if (window.electronAPI) {
                window.electronAPI.displayAnswer({
                    question: question.text,
                    questionType: question.type,
                    answers,
                    defaultLength: this.config.defaultAnswerLength,
                });
            }

            console.log('[Pipeline] Answers generated successfully');
        } catch (error) {
            console.error('[Pipeline] Answer generation error:', error);
            this.callbacks.onError?.(error as Error);
        } finally {
            store.setGenerating(false);
        }
    }

    /**
     * Set resume context for better answers
     */
    setResume(resume: ResumeData): void {
        this.aiService.setResume(resume);
        useInterviewStore.getState().setResume(resume);
    }

    /**
     * Set job description context
     */
    setJobContext(jobDescription: string, companyName?: string): void {
        this.aiService.setContext({
            jobDescription,
            companyName,
        });

        const store = useInterviewStore.getState();
        store.setJobDescription(jobDescription);
        if (companyName) {
            store.setCompanyName(companyName);
        }
    }

    /**
     * Update pipeline configuration
     */
    updateConfig(config: Partial<PipelineConfig>): void {
        this.config = { ...this.config, ...config };

        // Update services
        this.asrService.updateConfig({
            provider: this.config.asrProvider,
            groqApiKey: this.config.groqApiKey,
            language: this.config.language,
        });

        this.aiService.updateConfig({
            provider: this.config.aiProvider,
            groqApiKey: this.config.groqApiKey,
        });
    }

    /**
     * Set status and notify
     */
    private setStatus(status: PipelineStatus): void {
        this.status = status;
        this.callbacks.onStatusChange?.(status);
    }

    /**
     * Get current status
     */
    getStatus(): PipelineStatus {
        return this.status;
    }

    /**
     * Get current audio level
     */
    getAudioLevel(): number {
        return this.audioCapture.getAudioLevel();
    }

    /**
     * Check if pipeline is running
     */
    isActive(): boolean {
        return this.isRunning;
    }

    /**
     * Clear question history
     */
    clearHistory(): void {
        this.questionDetector.clearHistory();
    }
}

// Singleton instance
let pipelineInstance: InterviewPipeline | null = null;

export function getInterviewPipeline(
    config?: Partial<PipelineConfig>,
    callbacks?: PipelineCallbacks
): InterviewPipeline {
    if (!pipelineInstance) {
        pipelineInstance = new InterviewPipeline(config, callbacks);
    }
    return pipelineInstance;
}

export function resetInterviewPipeline(): void {
    if (pipelineInstance) {
        pipelineInstance.stop();
        pipelineInstance = null;
    }
}
