// ============================================================================
// RedParrot - Overlay Window Component (Parakeet AI Style)
// Matches the exact UI/UX of Parakeet AI from the demo video
// ============================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useDragControls } from 'framer-motion';
import {
    FiVolume2, FiVolumeX, FiChevronLeft, FiChevronRight,
    FiMonitor, FiMic, FiCopy, FiCheck, FiMaximize2, FiCamera, FiRefreshCw, FiSend
} from 'react-icons/fi';
import { useInterviewStore } from '@/stores/interview-store';
import { AIAnswerService, AnswerLength } from '@/services/ai-service';

interface OverlayWindowProps {
    isOverlayMode?: boolean;
}

// Initialize AI service with default Groq key
const DEFAULT_GROQ_KEY = '';

// Code syntax highlighting component
const CodeBlock: React.FC<{ code: string; language?: string }> = ({ code, language = 'javascript' }) => {
    // Simple syntax highlighting
    const highlightCode = (text: string) => {
        return text
            .replace(/\b(var|let|const|function|return|if|else|for|while|class|new|this)\b/g, '<span class="text-pink-400">$1</span>')
            .replace(/\b(true|false|null|undefined)\b/g, '<span class="text-yellow-400">$1</span>')
            .replace(/("[^"]*"|'[^']*'|`[^`]*`)/g, '<span class="text-green-400">$1</span>')
            .replace(/\b(\d+)\b/g, '<span class="text-orange-400">$1</span>')
            .replace(/(\/\/[^\n]*)/g, '<span class="text-gray-500">$1</span>')
            .replace(/\b(Error|TypeError|ReferenceError)\b/g, '<span class="text-red-400">$1</span>');
    };

    return (
        <div className="my-2 bg-[#1a1a2e] rounded-lg p-3 overflow-x-auto">
            <div className="text-xs text-gray-500 mb-1">{language}</div>
            <pre
                className="text-sm font-mono text-gray-200"
                dangerouslySetInnerHTML={{ __html: highlightCode(code) }}
            />
        </div>
    );
};

// Parse answer text to extract code blocks
const parseAnswerWithCode = (text: string) => {
    const parts: Array<{ type: 'text' | 'code'; content: string; language?: string }> = [];

    // Split by code blocks (```language ... ```)
    const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
        // Add text before code block
        if (match.index > lastIndex) {
            parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
        }
        // Add code block
        parts.push({ type: 'code', content: match[2].trim(), language: match[1] || 'javascript' });
        lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
        parts.push({ type: 'text', content: text.slice(lastIndex) });
    }

    return parts.length > 0 ? parts : [{ type: 'text' as const, content: text }];
};

const OverlayWindow: React.FC<OverlayWindowProps> = ({ isOverlayMode = false }) => {
    const dragControls = useDragControls();
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Store state
    const {
        currentQuestion,
        currentAnswers,
        selectedAnswerLength,
        isListening,
        isGenerating,
        currentTranscription,
        isOverlayVisible,
        isScreenSharing,
        settings,
        setOverlayVisible,
        setCurrentQuestion,
        setCurrentAnswers,
        setGenerating,
        capturedScreen,
        screenAnalysis,
        isAnalyzingScreen,
        setCapturedScreen,
        setScreenAnalysis,
        setAnalyzingScreen,
        clearScreenAnalysis,
    } = useInterviewStore();

    // Local state
    const [isHidden, setIsHidden] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState<'answer' | 'screen'>('answer');
    const [manualInput, setManualInput] = useState('');
    const [isGeneratingLocal, setIsGeneratingLocal] = useState(false);

    // AI Service reference
    const aiServiceRef = useRef<AIAnswerService | null>(null);

    // Initialize AI service
    useEffect(() => {
        const apiKey = settings.groqApiKey || DEFAULT_GROQ_KEY;
        if (apiKey) {
            aiServiceRef.current = new AIAnswerService({
                provider: 'groq',
                groqApiKey: apiKey,
            });
        }
    }, [settings.groqApiKey]);

    // Get current answer based on selected length
    const currentAnswer = currentAnswers[selectedAnswerLength];

    // Handle copy to clipboard
    const handleCopy = useCallback(() => {
        if (currentAnswer?.text) {
            navigator.clipboard.writeText(currentAnswer.text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }, [currentAnswer]);

    // Handle hide
    const handleHide = () => {
        setIsHidden(!isHidden);
        window.electronAPI?.toggleOverlay();
    };

    // Generate AI answer from manual input or current transcription
    const handleGenerateAnswer = useCallback(async (text?: string) => {
        const questionText = text || manualInput || currentTranscription;
        if (!questionText.trim() || !aiServiceRef.current) return;

        setIsGeneratingLocal(true);
        setGenerating(true);

        try {
            // Set the question in store
            setCurrentQuestion({
                text: questionText,
                type: 'behavioral',
                confidence: 1.0,
                keywords: questionText.split(' ').slice(0, 5),
                suggestedAnswerFormat: 'concise',
                timestamp: Date.now(),
            });

            // Generate all three answer lengths
            const [short, medium, long] = await Promise.all([
                aiServiceRef.current.generateAnswerFromText(questionText, 'short'),
                aiServiceRef.current.generateAnswerFromText(questionText, 'medium'),
                aiServiceRef.current.generateAnswerFromText(questionText, 'long'),
            ]);

            setCurrentAnswers({ short, medium, long });
            setManualInput('');
        } catch (error) {
            console.error('[Overlay] Failed to generate answer:', error);
        } finally {
            setIsGeneratingLocal(false);
            setGenerating(false);
        }
    }, [manualInput, currentTranscription, setCurrentQuestion, setCurrentAnswers, setGenerating]);

    // Handle Enter key in input
    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleGenerateAnswer();
        }
    };

    // Capture and analyze screen
    const handleCaptureScreen = useCallback(async () => {
        if (!window.electronAPI?.captureScreen || !aiServiceRef.current) {
            console.error('[Overlay] Screen capture not available');
            return;
        }

        setAnalyzingScreen(true);
        clearScreenAnalysis();

        try {
            // Capture screen via Electron
            const screenshot = await window.electronAPI.captureScreen();
            if (!screenshot) {
                throw new Error('Failed to capture screen');
            }

            setCapturedScreen(screenshot);

            // Analyze with AI (coding context for interview scenarios)
            const analysis = await aiServiceRef.current.analyzeImage(screenshot, 'coding');
            setScreenAnalysis(analysis);
        } catch (error) {
            console.error('[Overlay] Screen capture/analysis failed:', error);
            setScreenAnalysis('Failed to analyze screen. Please try again.');
        } finally {
            setAnalyzingScreen(false);
        }
    }, [setAnalyzingScreen, clearScreenAnalysis, setCapturedScreen, setScreenAnalysis]);

    // Listen for screen share detection
    useEffect(() => {
        const unsubscribe = window.electronAPI?.onScreenShareDetected?.((isSharing) => {
            if (isSharing && settings.autoHideOnScreenShare) {
                setOverlayVisible(false);
            }
        });

        return () => unsubscribe?.();
    }, [settings.autoHideOnScreenShare, setOverlayVisible]);

    // Don't render if not visible
    if (!isOverlayVisible || isHidden) {
        return null;
    }

    const showGenerating = isGenerating || isGeneratingLocal;

    return (
        <motion.div
            ref={containerRef}
            className="fixed select-none"
            style={{
                top: '80px',
                left: '50px',
                zIndex: 9999,
            }}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            drag
            dragControls={dragControls}
            dragMomentum={false}
            dragElastic={0}
        >
            {/* Main Container - Premium Dark Glass */}
            <div className="w-[540px] overflow-hidden rounded-2xl shadow-2xl" style={{
                background: 'linear-gradient(145deg, rgba(15,10,20,0.97) 0%, rgba(10,8,15,0.98) 100%)',
                border: '1px solid rgba(255,255,255,0.06)',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8), 0 0 40px rgba(220,38,38,0.1)'
            }}>

                {/* Header Bar - Premium with Logo Glow */}
                <div
                    className="px-4 py-3 flex items-center justify-between cursor-move relative"
                    style={{
                        background: 'linear-gradient(90deg, rgba(20,10,15,0.95) 0%, rgba(30,12,18,0.95) 50%, rgba(20,10,15,0.95) 100%)',
                        borderBottom: '1px solid rgba(220,38,38,0.2)'
                    }}
                    onPointerDown={(e) => dragControls.start(e)}
                >
                    {/* Left side - Logo with glow and name */}
                    <div className="flex items-center gap-3">
                        <div className="relative group">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-red-600 to-red-500 rounded-lg blur-sm opacity-50 group-hover:opacity-70 transition-opacity" />
                            <img
                                src="/logo.jpg"
                                alt="RedParrot"
                                className="relative w-9 h-9 rounded-lg object-cover ring-1 ring-white/10"
                            />
                        </div>
                        <div>
                            <span className="text-white font-bold text-sm">RedParrot</span>
                            <p className="text-[9px] text-gray-500 -mt-0.5">AI Interview Copilot</p>
                        </div>

                        {/* Audio indicator */}
                        <button
                            onClick={() => setIsMuted(!isMuted)}
                            className="ml-1 p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            {isMuted ? (
                                <FiVolumeX className="w-4 h-4 text-red-400" />
                            ) : (
                                <FiVolume2 className="w-4 h-4 text-emerald-400" />
                            )}
                        </button>
                    </div>

                    {/* Right side - Controls */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={handleHide}
                            className="px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all font-medium"
                        >
                            Hide
                        </button>
                        <button className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                            <FiMaximize2 className="w-4 h-4 text-gray-400" />
                        </button>
                    </div>
                </div>

                {/* Transcription Bar */}
                {currentTranscription && (
                    <div className="px-4 py-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                            <p className="text-xs text-gray-400 italic truncate">
                                {currentTranscription.slice(-150)}
                            </p>
                        </div>
                    </div>
                )}

                {/* Tab Buttons - AI Answer / Analyse Screen */}
                <div className="px-4 py-2 flex items-center gap-2 bg-[#0d0d18] border-b border-white/5">
                    <button
                        onClick={() => setActiveTab('answer')}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${activeTab === 'answer'
                            ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                            : 'bg-[#1a1a2a] text-gray-400 hover:text-white hover:bg-[#252535]'
                            }`}
                    >
                        <span className="text-lg">✨</span>
                        AI Answer
                    </button>
                    <button
                        onClick={() => setActiveTab('screen')}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${activeTab === 'screen'
                            ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                            : 'bg-[#1a1a2a] text-gray-400 hover:text-white hover:bg-[#252535]'
                            }`}
                    >
                        <FiMonitor className="w-4 h-4" />
                        Analyse Screen
                    </button>

                    {/* Manual message input */}
                    <div className="flex-1 ml-2 flex gap-1">
                        <input
                            ref={inputRef}
                            type="text"
                            value={manualInput}
                            onChange={(e) => setManualInput(e.target.value)}
                            onKeyDown={handleKeyPress}
                            placeholder="Type question or click ✨ to use transcription..."
                            className="w-full px-3 py-1.5 text-xs bg-[#1a1a2a] border border-white/10 rounded-lg text-gray-300 placeholder-gray-500 focus:outline-none focus:border-red-600/50"
                        />
                        <button
                            onClick={() => handleGenerateAnswer()}
                            disabled={showGenerating}
                            className="px-2 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                            title="Generate AI Answer"
                        >
                            {showGenerating ? (
                                <FiRefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <FiSend className="w-4 h-4" />
                            )}
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="px-4 py-3 max-h-[450px] overflow-y-auto" style={{ background: '#1a1a2e' }}>

                    {activeTab === 'answer' ? (
                        <>
                            {/* Navigation Arrows */}
                            {currentQuestion && (
                                <div className="flex items-center gap-2 mb-3">
                                    <button className="p-1.5 bg-[#2a2a4a] hover:bg-[#3a3a5a] rounded-lg transition-colors">
                                        <FiChevronLeft className="w-4 h-4 text-gray-400" />
                                    </button>
                                    <button className="p-1.5 bg-[#2a2a4a] hover:bg-[#3a3a5a] rounded-lg transition-colors">
                                        <FiChevronRight className="w-4 h-4 text-gray-400" />
                                    </button>
                                </div>
                            )}

                            {/* Summarized Question */}
                            {currentQuestion && (
                                <div className="mb-4">
                                    <div className="flex items-start gap-2">
                                        <span className="text-blue-400 text-lg">💬</span>
                                        <div>
                                            <span className="text-blue-400 font-medium text-sm">Question:</span>
                                            <span className="text-white ml-2 text-sm">
                                                {currentQuestion.text}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Answer Section */}
                            {showGenerating ? (
                                <div className="py-4">
                                    <div className="flex items-center gap-2 text-red-400">
                                        <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                        <span className="text-sm font-medium">Generating answer...</span>
                                    </div>
                                </div>
                            ) : currentAnswer ? (
                                <div className="space-y-3">
                                    {/* Answer Header */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-yellow-400 text-lg">⭐</span>
                                        <span className="text-yellow-400 font-medium">Answer:</span>
                                    </div>

                                    {/* Answer Content with Code Highlighting */}
                                    <div className="text-gray-200 text-sm leading-relaxed space-y-3">
                                        {parseAnswerWithCode(currentAnswer.text).map((part, index) => (
                                            part.type === 'code' ? (
                                                <CodeBlock key={index} code={part.content} language={part.language} />
                                            ) : (
                                                <div key={index} className="whitespace-pre-wrap">
                                                    {part.content.split('\n').map((line, i) => {
                                                        // Check for inline code
                                                        const codeMatch = line.match(/`([^`]+)`/g);
                                                        if (codeMatch) {
                                                            const parts = line.split(/`([^`]+)`/);
                                                            return (
                                                                <p key={i} className="leading-relaxed">
                                                                    {parts.map((p, j) =>
                                                                        j % 2 === 1 ? (
                                                                            <code key={j} className="px-1.5 py-0.5 bg-[#1a1a2a] text-red-300 rounded text-xs font-mono">{p}</code>
                                                                        ) : p
                                                                    )}
                                                                </p>
                                                            );
                                                        }

                                                        // Regular text
                                                        return line ? <p key={i} className="leading-relaxed">{line}</p> : <br key={i} />;
                                                    })}
                                                </div>
                                            )
                                        ))}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handleCopy}
                                            className="flex items-center gap-2 px-3 py-1.5 text-xs bg-[#2a2a4a] hover:bg-[#3a3a5a] text-gray-300 rounded-lg transition-colors"
                                        >
                                            {copied ? (
                                                <>
                                                    <FiCheck className="w-3.5 h-3.5 text-green-400" />
                                                    <span className="text-green-400">Copied!</span>
                                                </>
                                            ) : (
                                                <>
                                                    <FiCopy className="w-3.5 h-3.5" />
                                                    <span>Copy answer</span>
                                                </>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => handleGenerateAnswer(currentQuestion?.text)}
                                            className="flex items-center gap-2 px-3 py-1.5 text-xs bg-[#2a2a4a] hover:bg-[#3a3a5a] text-gray-300 rounded-lg transition-colors"
                                        >
                                            <FiRefreshCw className="w-3.5 h-3.5" />
                                            <span>Regenerate</span>
                                        </button>
                                    </div>
                                </div>
                            ) : isListening ? (
                                <div className="py-8 text-center">
                                    <div className="flex items-center justify-center gap-2 text-red-400 mb-2">
                                        <FiMic className="w-5 h-5" />
                                        <span className="text-sm font-medium">Listening for questions...</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mb-4">
                                        The interviewer's question will appear here
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        Or type a question above and press Send ➜
                                    </p>
                                </div>
                            ) : (
                                <div className="py-8 text-center">
                                    <p className="text-gray-500 text-sm mb-2">
                                        Start the interview to see AI-powered answers
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        Or type a question above and click Send to get an answer
                                    </p>
                                </div>
                            )}
                        </>
                    ) : (
                        /* Analyse Screen Tab */
                        <div className="py-4">
                            {isAnalyzingScreen ? (
                                <div className="text-center py-8">
                                    <div className="flex items-center justify-center gap-2 text-red-400 mb-2">
                                        <div className="w-5 h-5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                        <span className="text-sm font-medium">Analyzing screen...</span>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Capturing and analyzing with AI
                                    </p>
                                </div>
                            ) : screenAnalysis ? (
                                <div className="space-y-3">
                                    {/* Captured Screenshot Thumbnail */}
                                    {capturedScreen && (
                                        <div className="mb-3">
                                            <img
                                                src={capturedScreen}
                                                alt="Captured screen"
                                                className="w-full h-24 object-cover rounded-lg opacity-50"
                                            />
                                        </div>
                                    )}

                                    {/* Analysis Result */}
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-green-400 text-lg">🔍</span>
                                        <span className="text-green-400 font-medium">Screen Analysis:</span>
                                    </div>

                                    <div className="text-gray-200 text-sm leading-relaxed space-y-3">
                                        {parseAnswerWithCode(screenAnalysis).map((part, index) => (
                                            part.type === 'code' ? (
                                                <CodeBlock key={index} code={part.content} language={part.language} />
                                            ) : (
                                                <div key={index} className="whitespace-pre-wrap">
                                                    {part.content.split('\n').map((line, i) => (
                                                        line ? <p key={i} className="leading-relaxed">{line}</p> : <br key={i} />
                                                    ))}
                                                </div>
                                            )
                                        ))}
                                    </div>

                                    {/* Recapture Button */}
                                    <button
                                        onClick={handleCaptureScreen}
                                        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
                                    >
                                        <FiCamera className="w-4 h-4" />
                                        Capture Again
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <FiMonitor className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                                    <h3 className="text-white font-medium mb-2">Screen Analysis</h3>
                                    <p className="text-gray-500 text-sm mb-4">
                                        Capture and analyze coding problems from your screen
                                    </p>
                                    <button
                                        onClick={handleCaptureScreen}
                                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors flex items-center gap-2 mx-auto"
                                    >
                                        <FiCamera className="w-4 h-4" />
                                        Capture Screen
                                    </button>
                                    <p className="text-xs text-gray-500 mt-3">
                                        📝 The capture is stealth - it won't show up in screen shares
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Status Bar */}
                <div className="px-4 py-2 bg-[#151528] border-t border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className={`w-2 h-2 rounded-full ${isListening ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
                        <span>{isListening ? 'Active' : 'Idle'}</span>
                    </div>
                    {isScreenSharing && (
                        <span className="text-xs text-yellow-500">⚠️ Screen sharing detected</span>
                    )}
                    <span className="text-xs text-gray-600">RedParrot v1.0</span>
                </div>
            </div>
        </motion.div>
    );
};

export default OverlayWindow;
