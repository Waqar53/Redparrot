// ============================================================================
// RedParrot - Interview State Store
// Zustand store for global state management
// ============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DetectedQuestion, QuestionType } from '@/services/question-detector';
import { GeneratedAnswer, ResumeData, AnswerLength } from '@/services/ai-service';
import { TranscriptionResult } from '@/services/asr-service';

// ============================================================================
// Types
// ============================================================================

export interface Settings {
    // API Keys
    groqApiKey: string;

    // ASR Settings
    asrProvider: 'groq' | 'whisper-local' | 'auto';
    language: string;

    // AI Settings
    aiProvider: 'groq' | 'ollama' | 'auto';
    ollamaModel: string;
    defaultAnswerLength: AnswerLength;

    // Audio Settings
    audioSource: 'microphone' | 'system' | 'both';
    enableNoiseReduction: boolean;

    // Overlay Settings
    overlayOpacity: number;
    overlayPosition: { x: number; y: number };
    autoHideOnScreenShare: boolean;

    // Stealth Settings
    stealthMode: boolean;
    hideFromDock: boolean;

    // Display Settings
    showTranscription: boolean;
    showQuestionType: boolean;
    theme: 'dark' | 'light';
}

export interface QuestionAnswerPair {
    id: string;
    question: DetectedQuestion;
    answers: {
        short?: GeneratedAnswer;
        medium?: GeneratedAnswer;
        long?: GeneratedAnswer;
    };
    selectedLength: AnswerLength;
    timestamp: number;
}

export interface InterviewSession {
    id: string;
    startedAt: number;
    endedAt?: number;
    companyName?: string;
    jobTitle?: string;
    questionsAnswered: number;
    qaHistory: QuestionAnswerPair[];
}

export interface InterviewState {
    // Session State
    isInterviewActive: boolean;
    currentSession: InterviewSession | null;

    // Real-time State
    isListening: boolean;
    isProcessing: boolean;
    isGenerating: boolean;

    // Transcription
    currentTranscription: string;
    transcriptionHistory: TranscriptionResult[];

    // Questions & Answers
    currentQuestion: DetectedQuestion | null;
    currentAnswers: QuestionAnswerPair['answers'];
    selectedAnswerLength: AnswerLength;
    qaHistory: QuestionAnswerPair[];

    // Resume
    resume: ResumeData | null;
    jobDescription: string;
    companyName: string;

    // Settings
    settings: Settings;

    // UI State
    isOverlayVisible: boolean;
    isScreenSharing: boolean;
    audioLevel: number;

    // Screen Analysis State
    capturedScreen: string | null; // base64 image
    screenAnalysis: string | null;
    isAnalyzingScreen: boolean;

    // Error State
    error: string | null;
}

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_SETTINGS: Settings = {
    groqApiKey: '',
    asrProvider: 'groq',
    language: 'auto',
    aiProvider: 'groq',
    ollamaModel: 'llama3.2',
    defaultAnswerLength: 'medium',
    audioSource: 'microphone',
    enableNoiseReduction: true,
    overlayOpacity: 0.95,
    overlayPosition: { x: 100, y: 100 },
    autoHideOnScreenShare: true,
    stealthMode: true,
    hideFromDock: true,
    showTranscription: true,
    showQuestionType: true,
    theme: 'dark',
};

const INITIAL_STATE: InterviewState = {
    isInterviewActive: false,
    currentSession: null,
    isListening: false,
    isProcessing: false,
    isGenerating: false,
    currentTranscription: '',
    transcriptionHistory: [],
    currentQuestion: null,
    currentAnswers: {},
    selectedAnswerLength: 'medium',
    qaHistory: [],
    resume: null,
    jobDescription: '',
    companyName: '',
    settings: DEFAULT_SETTINGS,
    isOverlayVisible: true,
    isScreenSharing: false,
    audioLevel: 0,
    capturedScreen: null,
    screenAnalysis: null,
    isAnalyzingScreen: false,
    error: null,
};

// ============================================================================
// Store Actions Interface
// ============================================================================

interface InterviewActions {
    // Session Management
    startInterview: () => void;
    endInterview: () => void;

    // Audio Control
    startListening: () => void;
    stopListening: () => void;
    setAudioLevel: (level: number) => void;

    // Transcription
    updateTranscription: (text: string) => void;
    addTranscriptionResult: (result: TranscriptionResult) => void;
    clearTranscription: () => void;

    // Question & Answer
    setCurrentQuestion: (question: DetectedQuestion) => void;
    setCurrentAnswers: (answers: QuestionAnswerPair['answers']) => void;
    setSelectedAnswerLength: (length: AnswerLength) => void;
    saveQuestionAnswer: () => void;
    clearCurrentQA: () => void;

    // Resume & Context
    setResume: (resume: ResumeData) => void;
    setJobDescription: (description: string) => void;
    setCompanyName: (name: string) => void;

    // Settings
    updateSettings: (settings: Partial<Settings>) => void;
    resetSettings: () => void;

    // UI State
    toggleOverlay: () => void;
    setOverlayVisible: (visible: boolean) => void;
    setScreenSharing: (isSharing: boolean) => void;

    // Processing State
    setProcessing: (processing: boolean) => void;
    setGenerating: (generating: boolean) => void;

    // Screen Analysis
    setCapturedScreen: (imageBase64: string | null) => void;
    setScreenAnalysis: (analysis: string | null) => void;
    setAnalyzingScreen: (analyzing: boolean) => void;
    clearScreenAnalysis: () => void;

    // Error Handling
    setError: (error: string | null) => void;
    clearError: () => void;

    // Reset
    reset: () => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useInterviewStore = create<InterviewState & InterviewActions>()(
    persist(
        (set, get) => ({
            ...INITIAL_STATE,

            // Session Management
            startInterview: () => {
                const sessionId = `session_${Date.now()}`;
                set({
                    isInterviewActive: true,
                    currentSession: {
                        id: sessionId,
                        startedAt: Date.now(),
                        questionsAnswered: 0,
                        qaHistory: [],
                    },
                    qaHistory: [],
                    currentQuestion: null,
                    currentAnswers: {},
                    error: null,
                });
            },

            endInterview: () => {
                const { currentSession, qaHistory } = get();
                if (currentSession) {
                    set({
                        isInterviewActive: false,
                        currentSession: {
                            ...currentSession,
                            endedAt: Date.now(),
                            questionsAnswered: qaHistory.length,
                            qaHistory,
                        },
                        isListening: false,
                    });
                }
            },

            // Audio Control
            startListening: () => set({ isListening: true }),
            stopListening: () => set({ isListening: false }),
            setAudioLevel: (level) => set({ audioLevel: level }),

            // Transcription
            updateTranscription: (text) => set({ currentTranscription: text }),
            addTranscriptionResult: (result) => set((state) => ({
                transcriptionHistory: [...state.transcriptionHistory, result],
                currentTranscription: state.currentTranscription + ' ' + result.text,
            })),
            clearTranscription: () => set({ currentTranscription: '', transcriptionHistory: [] }),

            // Question & Answer
            setCurrentQuestion: (question) => set({
                currentQuestion: question,
                isProcessing: false,
            }),
            setCurrentAnswers: (answers) => set({
                currentAnswers: answers,
                isGenerating: false,
            }),
            setSelectedAnswerLength: (length) => set({ selectedAnswerLength: length }),

            saveQuestionAnswer: () => {
                const { currentQuestion, currentAnswers, selectedAnswerLength, qaHistory } = get();
                if (!currentQuestion || Object.keys(currentAnswers).length === 0) return;

                const qaPair: QuestionAnswerPair = {
                    id: `qa_${Date.now()}`,
                    question: currentQuestion,
                    answers: currentAnswers,
                    selectedLength: selectedAnswerLength,
                    timestamp: Date.now(),
                };

                set({
                    qaHistory: [...qaHistory, qaPair],
                    currentQuestion: null,
                    currentAnswers: {},
                });
            },

            clearCurrentQA: () => set({
                currentQuestion: null,
                currentAnswers: {},
            }),

            // Resume & Context
            setResume: (resume) => set({ resume }),
            setJobDescription: (description) => set({ jobDescription: description }),
            setCompanyName: (name) => set({ companyName: name }),

            // Settings
            updateSettings: (newSettings) => set((state) => ({
                settings: { ...state.settings, ...newSettings },
            })),
            resetSettings: () => set({ settings: DEFAULT_SETTINGS }),

            // UI State
            toggleOverlay: () => set((state) => ({ isOverlayVisible: !state.isOverlayVisible })),
            setOverlayVisible: (visible) => set({ isOverlayVisible: visible }),
            setScreenSharing: (isSharing) => {
                const { settings } = get();
                set({
                    isScreenSharing: isSharing,
                    // Auto-hide overlay when screen sharing if enabled
                    isOverlayVisible: isSharing && settings.autoHideOnScreenShare
                        ? false
                        : get().isOverlayVisible,
                });
            },

            // Processing State
            setProcessing: (processing) => set({ isProcessing: processing }),
            setGenerating: (generating) => set({ isGenerating: generating }),

            // Screen Analysis
            setCapturedScreen: (imageBase64) => set({ capturedScreen: imageBase64 }),
            setScreenAnalysis: (analysis) => set({ screenAnalysis: analysis }),
            setAnalyzingScreen: (analyzing) => set({ isAnalyzingScreen: analyzing }),
            clearScreenAnalysis: () => set({
                capturedScreen: null,
                screenAnalysis: null,
                isAnalyzingScreen: false,
            }),

            // Error Handling
            setError: (error) => set({ error }),
            clearError: () => set({ error: null }),

            // Reset
            reset: () => set(INITIAL_STATE),
        }),
        {
            name: 'redparrot-interview-store',
            partialize: (state) => ({
                // Only persist these fields
                settings: state.settings,
                resume: state.resume,
                jobDescription: state.jobDescription,
                companyName: state.companyName,
            }),
        }
    )
);

// Export type for use in components
export type InterviewStore = InterviewState & InterviewActions;
