// ============================================================================
// RedParrot - Main App Component (Parakeet AI Style)
// Entry point with overlay-first design like Parakeet AI
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FiPlay, FiPause, FiSettings, FiUser, FiMic, FiMicOff,
    FiMonitor, FiUpload, FiCheck, FiAlertCircle
} from 'react-icons/fi';
import { Toaster, toast } from 'react-hot-toast';
import { useInterviewStore } from '@/stores/interview-store';
import { getInterviewPipeline, InterviewPipeline } from '@/services/interview-pipeline';
import OverlayWindow from '@/components/Overlay/OverlayWindow';
import SettingsPanel from '@/components/Settings/SettingsPanel';
import ResumeUpload from '@/components/ResumeUpload/ResumeUpload';

// Check if we're in overlay mode
const isOverlayMode = window.location.hash === '#overlay' || window.location.hash === '#/overlay';

// Default Groq API key from environment (set in .env file or Settings)
const DEFAULT_GROQ_KEY = '';

type TabId = 'interview' | 'resume' | 'settings';

const App: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabId>('interview');
    const [pipeline, setPipeline] = useState<InterviewPipeline | null>(null);
    const [showOverlayInMain, setShowOverlayInMain] = useState(true);

    const {
        isInterviewActive,
        isListening,
        startInterview,
        endInterview,
        startListening,
        stopListening,
        settings,
        updateSettings,
        currentQuestion,
        currentAnswers,
        selectedAnswerLength,
        audioLevel,
        error,
        clearError,
        isOverlayVisible,
    } = useInterviewStore();

    // Auto-set API key from environment on mount
    useEffect(() => {
        if (!settings.groqApiKey && DEFAULT_GROQ_KEY) {
            updateSettings({ groqApiKey: DEFAULT_GROQ_KEY });
        }
    }, [settings.groqApiKey, updateSettings]);

    // Initialize pipeline on mount
    useEffect(() => {
        if (isOverlayMode) return;

        const apiKey = settings.groqApiKey || DEFAULT_GROQ_KEY;
        if (!apiKey) return;

        const pipelineInstance = getInterviewPipeline(
            {
                groqApiKey: apiKey,
                aiProvider: settings.aiProvider,
                asrProvider: settings.asrProvider,
                language: settings.language,
                defaultAnswerLength: settings.defaultAnswerLength,
                audioSource: settings.audioSource,
            },
            {
                onTranscription: (result) => {
                    console.log('[App] Transcription:', result.text);
                },
                onQuestionDetected: (question) => {
                    toast.success(`Question detected: ${question.type}`, {
                        duration: 3000,
                        icon: '💬'
                    });
                },
                onAnswerGenerated: (answer) => {
                    toast.success('Answer ready!', {
                        duration: 2000,
                        icon: '⭐'
                    });
                },
                onError: (err) => {
                    toast.error(err.message);
                },
            }
        );
        setPipeline(pipelineInstance);
    }, [settings]);

    // Handle interview start/stop
    const handleToggleInterview = useCallback(async () => {
        if (!pipeline) {
            toast.error('Pipeline not ready, please wait...');
            return;
        }

        const apiKey = settings.groqApiKey || DEFAULT_GROQ_KEY;
        if (!apiKey) {
            toast.error('Please add your Groq API key in Settings');
            setActiveTab('settings');
            return;
        }

        if (isInterviewActive) {
            pipeline.stop();
            stopListening();
            endInterview();
            toast.success('Interview ended', { icon: '⏹️' });
        } else {
            startInterview();
            const started = await pipeline.start();
            if (started) {
                startListening();
                toast.success('Listening for questions...', { icon: '🎤' });
            } else {
                endInterview();
                toast.error('Failed to start audio capture. Please check microphone permissions.');
            }
        }
    }, [pipeline, settings.groqApiKey, isInterviewActive, startInterview, endInterview, startListening, stopListening]);

    // Show error toast
    useEffect(() => {
        if (error) {
            toast.error(error);
            clearError();
        }
    }, [error, clearError]);

    // Render overlay mode only
    if (isOverlayMode) {
        return <OverlayWindow isOverlayMode={true} />;
    }

    const currentAnswer = currentAnswers[selectedAnswerLength];

    return (
        <div className="h-screen flex bg-[#080812] text-white overflow-hidden">
            <Toaster
                position="top-right"
                toastOptions={{
                    style: {
                        background: '#0d0d1a',
                        color: '#f8fafc',
                        border: '1px solid rgba(255,255,255,0.08)',
                    },
                }}
            />

            {/* Sidebar - Premium Glassmorphism Design */}
            <div className="w-72 h-full flex flex-col relative" style={{
                background: 'linear-gradient(180deg, rgba(20,10,25,0.98) 0%, rgba(15,8,20,0.99) 100%)',
                borderRight: '1px solid rgba(255,255,255,0.05)'
            }}>
                {/* Decorative glow behind logo */}
                <div className="absolute top-12 left-1/2 -translate-x-1/2 w-32 h-32 rounded-full blur-3xl opacity-30"
                    style={{ background: 'radial-gradient(circle, #dc2626 0%, transparent 70%)' }}
                />

                {/* Logo Section with Glow */}
                <div className="p-6 pb-4 relative z-10">
                    <div className="flex flex-col items-center text-center">
                        <div className="relative group">
                            {/* Logo glow ring */}
                            <div className="absolute -inset-1 bg-gradient-to-r from-red-600 via-red-500 to-orange-500 rounded-2xl blur-sm opacity-60 group-hover:opacity-80 transition-opacity" />
                            <img
                                src="/logo.jpg"
                                alt="RedParrot"
                                className="relative w-20 h-20 rounded-2xl object-cover shadow-2xl ring-2 ring-white/10"
                            />
                        </div>
                        <h1 className="mt-4 font-bold text-2xl bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                            RedParrot
                        </h1>
                        <p className="text-xs text-gray-500 mt-1 tracking-wider uppercase">AI Interview Copilot</p>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-4 py-2 space-y-2">
                    {[
                        { id: 'interview' as TabId, icon: FiMonitor, label: 'Interview', desc: 'Start session' },
                        { id: 'resume' as TabId, icon: FiUser, label: 'Resume', desc: 'Your profile' },
                        { id: 'settings' as TabId, icon: FiSettings, label: 'Settings', desc: 'Preferences' },
                    ].map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-300 group ${activeTab === item.id
                                ? 'shadow-lg shadow-red-900/30'
                                : 'hover:bg-white/5'
                                }`}
                            style={activeTab === item.id ? {
                                background: 'linear-gradient(135deg, rgba(220,38,38,0.9) 0%, rgba(153,27,27,0.9) 100%)',
                            } : {}}
                        >
                            <div className={`p-2 rounded-lg transition-colors ${activeTab === item.id
                                ? 'bg-white/20'
                                : 'bg-white/5 group-hover:bg-white/10'}`}>
                                <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-white' : 'text-gray-400 group-hover:text-white'}`} />
                            </div>
                            <div className="text-left">
                                <span className={`text-sm font-semibold ${activeTab === item.id ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>
                                    {item.label}
                                </span>
                                <p className={`text-[10px] ${activeTab === item.id ? 'text-white/70' : 'text-gray-500'}`}>
                                    {item.desc}
                                </p>
                            </div>
                        </button>
                    ))}
                </nav>

                {/* Bottom Section */}
                <div className="p-4 mx-4 mb-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    {/* API Status */}
                    <div className="flex items-center gap-2 text-xs mb-4">
                        {settings.groqApiKey || DEFAULT_GROQ_KEY ? (
                            <>
                                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                                <span className="text-emerald-400 font-medium">Groq AI Connected</span>
                            </>
                        ) : (
                            <>
                                <div className="w-2 h-2 bg-amber-400 rounded-full" />
                                <span className="text-amber-400 font-medium">API Key Required</span>
                            </>
                        )}
                    </div>

                    {/* Start/Stop Interview Button */}
                    <button
                        onClick={handleToggleInterview}
                        className={`w-full flex items-center justify-center gap-3 py-3.5 rounded-xl font-semibold transition-all duration-300 ${isInterviewActive
                            ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700'
                            : 'text-white shadow-lg shadow-red-900/40 hover:shadow-red-900/60 hover:scale-[1.02]'
                            }`}
                        style={!isInterviewActive ? {
                            background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 50%, #991b1b 100%)',
                        } : {}}
                    >
                        {isInterviewActive ? (
                            <>
                                <FiPause className="w-5 h-5" />
                                <span>End Session</span>
                            </>
                        ) : (
                            <>
                                <FiPlay className="w-5 h-5" />
                                <span>Start Interview</span>
                            </>
                        )}
                    </button>

                    {/* Listening Status */}
                    {isListening && (
                        <div className="mt-3 flex items-center justify-center gap-2 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                            <div className="relative">
                                <FiMic className="w-4 h-4 text-red-400" />
                                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-ping" />
                            </div>
                            <span className="text-sm text-red-400 font-medium">Listening...</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Tab Content */}
                <div className="flex-1 overflow-hidden">
                    <AnimatePresence mode="wait">
                        {activeTab === 'interview' && (
                            <motion.div
                                key="interview"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="h-full p-6 overflow-y-auto"
                            >
                                {/* Interview Dashboard */}
                                <div className="max-w-3xl mx-auto space-y-6">
                                    {/* Header */}
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">Interview Session</h2>
                                            <p className="text-gray-500 text-sm mt-1">
                                                {isInterviewActive ? 'Listening for interview questions...' : 'Ready to start your interview'}
                                            </p>
                                        </div>
                                        <div className={`px-4 py-2 rounded-full text-sm font-medium ${isInterviewActive
                                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                            : 'bg-gray-800/50 text-gray-400 border border-gray-700/50'
                                            }`}>
                                            {isInterviewActive ? '● Active' : '○ Inactive'}
                                        </div>
                                    </div>

                                    {/* Main Status Card */}
                                    <div className="rounded-2xl p-6 border border-white/5 relative overflow-hidden" style={{ background: 'linear-gradient(145deg, rgba(18,12,22,0.9) 0%, rgba(15,10,18,0.95) 100%)' }}>
                                        {/* Card decorative glow */}
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-20 bg-red-500/5 blur-3xl" />
                                        {isInterviewActive ? (
                                            <div className="space-y-6">
                                                {/* Audio Level Visualization */}
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{
                                                        background: 'linear-gradient(135deg, #e91e63 0%, #9c27b0 100%)'
                                                    }}>
                                                        <FiMic className="w-6 h-6 text-white" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-white font-medium mb-2">Audio Input</p>
                                                        <div className="h-2 bg-[#1a1a2e] rounded-full overflow-hidden">
                                                            <motion.div
                                                                className="h-full rounded-full"
                                                                style={{ background: 'linear-gradient(90deg, #e91e63, #9c27b0)' }}
                                                                animate={{ width: `${Math.max(10, audioLevel * 100)}%` }}
                                                                transition={{ duration: 0.1 }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Current Question */}
                                                {currentQuestion && (
                                                    <div className="p-4 rounded-xl" style={{ background: '#1a1a2e' }}>
                                                        <div className="flex items-start gap-2 mb-2">
                                                            <span className="text-blue-400">💬</span>
                                                            <span className="text-blue-400 text-sm font-medium">Detected Question:</span>
                                                        </div>
                                                        <p className="text-white font-medium ml-6">
                                                            {currentQuestion.text}
                                                        </p>
                                                        <div className="ml-6 mt-2">
                                                            <span className="inline-block px-2 py-0.5 bg-pink-500/20 text-pink-400 text-xs rounded-full">
                                                                {currentQuestion.type}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Answer Preview */}
                                                {currentAnswer && (
                                                    <div className="p-4 rounded-xl border border-pink-500/20" style={{ background: 'rgba(233,30,99,0.05)' }}>
                                                        <div className="flex items-start gap-2 mb-2">
                                                            <span className="text-yellow-400">⭐</span>
                                                            <span className="text-yellow-400 text-sm font-medium">Answer Ready:</span>
                                                        </div>
                                                        <p className="text-gray-300 text-sm ml-6 line-clamp-4">
                                                            {currentAnswer.text}
                                                        </p>
                                                        <p className="text-gray-500 text-xs ml-6 mt-2">
                                                            View full answer in the overlay window
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            /* Modern Ready to Start Section */
                                            <div className="text-center py-16">
                                                {/* Logo with animated glow */}
                                                <div className="relative inline-block mb-8">
                                                    {/* Outer glow ring */}
                                                    <div className="absolute -inset-4 bg-gradient-to-r from-red-600 via-red-500 to-orange-500 rounded-full blur-xl opacity-40 animate-pulse" />
                                                    {/* Middle glow */}
                                                    <div className="absolute -inset-2 bg-gradient-to-r from-red-600 to-red-500 rounded-3xl blur-md opacity-50" />
                                                    {/* Logo container */}
                                                    <div className="relative">
                                                        <img
                                                            src="/logo.jpg"
                                                            alt="RedParrot"
                                                            className="w-28 h-28 rounded-3xl object-cover shadow-2xl ring-2 ring-white/10"
                                                        />
                                                        {/* Mic badge */}
                                                        <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl flex items-center justify-center shadow-lg border border-white/10">
                                                            <FiMicOff className="w-5 h-5 text-gray-400" />
                                                        </div>
                                                    </div>
                                                </div>

                                                <h3 className="text-2xl font-bold bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent mb-3">
                                                    Ready to Start
                                                </h3>
                                                <p className="text-gray-500 max-w-md mx-auto leading-relaxed">
                                                    Click "Start Interview" to begin listening. RedParrot will detect questions
                                                    and provide AI-powered answers in real-time.
                                                </p>

                                                {/* Feature badges */}
                                                <div className="flex items-center justify-center gap-3 mt-6">
                                                    <span className="px-3 py-1.5 text-xs font-medium text-red-400 border border-red-500/30 rounded-full bg-red-500/10">
                                                        🎯 Real-time Detection
                                                    </span>
                                                    <span className="px-3 py-1.5 text-xs font-medium text-emerald-400 border border-emerald-500/30 rounded-full bg-emerald-500/10">
                                                        ⚡ AI-Powered
                                                    </span>
                                                    <span className="px-3 py-1.5 text-xs font-medium text-blue-400 border border-blue-500/30 rounded-full bg-blue-500/10">
                                                        🔒 100% Private
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Quick Tips - Modern Cards */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-5 rounded-2xl border border-white/5 relative overflow-hidden" style={{ background: 'linear-gradient(145deg, rgba(20,15,25,0.8) 0%, rgba(15,10,20,0.9) 100%)' }}>
                                            {/* Decorative corner glow */}
                                            <div className="absolute top-0 right-0 w-20 h-20 bg-red-500/10 blur-2xl" />
                                            <div className="relative">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500/20 to-red-600/20 flex items-center justify-center">
                                                        <span className="text-lg">🎤</span>
                                                    </div>
                                                    <h3 className="font-semibold text-white">Audio Tips</h3>
                                                </div>
                                                <ul className="text-sm text-gray-400 space-y-2">
                                                    <li className="flex items-start gap-2">
                                                        <span className="text-red-400 mt-0.5">•</span>
                                                        Position microphone close to audio source
                                                    </li>
                                                    <li className="flex items-start gap-2">
                                                        <span className="text-red-400 mt-0.5">•</span>
                                                        Minimize background noise
                                                    </li>
                                                    <li className="flex items-start gap-2">
                                                        <span className="text-red-400 mt-0.5">•</span>
                                                        System audio works with virtual meetings
                                                    </li>
                                                </ul>
                                            </div>
                                        </div>
                                        <div className="p-5 rounded-2xl border border-white/5 relative overflow-hidden" style={{ background: 'linear-gradient(145deg, rgba(20,15,25,0.8) 0%, rgba(15,10,20,0.9) 100%)' }}>
                                            {/* Decorative corner glow */}
                                            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 blur-2xl" />
                                            <div className="relative">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center">
                                                        <span className="text-lg">⌨️</span>
                                                    </div>
                                                    <h3 className="font-semibold text-white">Keyboard Shortcuts</h3>
                                                </div>
                                                <ul className="text-sm text-gray-400 space-y-2">
                                                    <li className="flex items-center gap-2">
                                                        <kbd className="px-2 py-0.5 text-xs bg-gray-800/80 text-gray-300 rounded border border-gray-700">⌘⇧O</kbd>
                                                        <span>Toggle overlay</span>
                                                    </li>
                                                    <li className="flex items-center gap-2">
                                                        <kbd className="px-2 py-0.5 text-xs bg-gray-800/80 text-gray-300 rounded border border-gray-700">⌘⇧H</kbd>
                                                        <span>Hide all windows</span>
                                                    </li>
                                                    <li className="flex items-center gap-2">
                                                        <kbd className="px-2 py-0.5 text-xs bg-gray-800/80 text-gray-300 rounded border border-gray-700">⌘⇧C</kbd>
                                                        <span>Click-through mode</span>
                                                    </li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'resume' && (
                            <motion.div
                                key="resume"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="h-full overflow-y-auto"
                            >
                                <ResumeUpload />
                            </motion.div>
                        )}

                        {activeTab === 'settings' && (
                            <motion.div
                                key="settings"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="h-full overflow-y-auto"
                            >
                                <SettingsPanel />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Overlay Preview in Main Window */}
                {showOverlayInMain && isOverlayVisible && activeTab === 'interview' && (
                    <div className="w-[540px] p-4 border-l border-white/10 overflow-hidden" style={{ background: '#0d0d1f' }}>
                        <div className="h-full overflow-y-auto">
                            <OverlayWindow isOverlayMode={false} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default App;
