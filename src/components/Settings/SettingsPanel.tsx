// ============================================================================
// RedParrot - Settings Panel Component
// Configure API keys, audio settings, and preferences
// ============================================================================

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    FiSettings, FiKey, FiMic, FiMonitor, FiEye, FiShield,
    FiSave, FiRefreshCw, FiCheck, FiX, FiChevronDown
} from 'react-icons/fi';
import { useInterviewStore } from '@/stores/interview-store';
import { ASRService } from '@/services/asr-service';
import { AIAnswerService } from '@/services/ai-service';

interface SettingsSectionProps {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    defaultOpen?: boolean;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({
    title, icon, children, defaultOpen = false
}) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="border border-dark-700 rounded-lg overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-4 py-3 flex items-center justify-between bg-dark-800 hover:bg-dark-750 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <span className="text-primary-500">{icon}</span>
                    <span className="font-medium text-white">{title}</span>
                </div>
                <FiChevronDown
                    className={`w-5 h-5 text-dark-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>
            {isOpen && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="p-4 space-y-4 bg-dark-850"
                >
                    {children}
                </motion.div>
            )}
        </div>
    );
};

interface InputFieldProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: 'text' | 'password' | 'number';
    placeholder?: string;
    helpText?: string;
}

const InputField: React.FC<InputFieldProps> = ({
    label, value, onChange, type = 'text', placeholder, helpText
}) => (
    <div className="space-y-1.5">
        <label className="block text-sm font-medium text-dark-200">{label}</label>
        <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="input-field"
        />
        {helpText && (
            <p className="text-xs text-dark-400">{helpText}</p>
        )}
    </div>
);

interface SelectFieldProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
    helpText?: string;
}

const SelectField: React.FC<SelectFieldProps> = ({
    label, value, onChange, options, helpText
}) => (
    <div className="space-y-1.5">
        <label className="block text-sm font-medium text-dark-200">{label}</label>
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="input-field"
        >
            {options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
        </select>
        {helpText && (
            <p className="text-xs text-dark-400">{helpText}</p>
        )}
    </div>
);

interface ToggleFieldProps {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    helpText?: string;
}

const ToggleField: React.FC<ToggleFieldProps> = ({
    label, checked, onChange, helpText
}) => (
    <div className="flex items-center justify-between">
        <div>
            <span className="text-sm font-medium text-dark-200">{label}</span>
            {helpText && (
                <p className="text-xs text-dark-400 mt-0.5">{helpText}</p>
            )}
        </div>
        <button
            onClick={() => onChange(!checked)}
            className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-primary-500' : 'bg-dark-600'
                }`}
        >
            <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'
                    }`}
            />
        </button>
    </div>
);

const SettingsPanel: React.FC = () => {
    const { settings, updateSettings, resetSettings } = useInterviewStore();
    const [saved, setSaved] = useState(false);
    const [ollamaAvailable, setOllamaAvailable] = useState(false);
    const [ollamaModels, setOllamaModels] = useState<string[]>([]);

    // Check Ollama availability on mount
    useEffect(() => {
        const checkOllama = async () => {
            const aiService = new AIAnswerService();
            const available = await aiService.checkOllamaAvailability();
            setOllamaAvailable(available);

            if (available) {
                const models = await aiService.getOllamaModels();
                setOllamaModels(models);
            }
        };
        checkOllama();
    }, []);

    const handleSave = () => {
        // Settings are auto-saved via Zustand persist, but show feedback
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);

        // Apply settings to Electron if available
        if (window.electronAPI) {
            window.electronAPI.saveSettings(settings);
        }
    };

    const languages = ASRService.getSupportedLanguages();

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <FiSettings className="w-6 h-6 text-primary-500" />
                        <h2 className="text-xl font-semibold text-white">Settings</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={resetSettings}
                            className="btn-ghost flex items-center gap-2"
                        >
                            <FiRefreshCw className="w-4 h-4" />
                            Reset
                        </button>
                        <button
                            onClick={handleSave}
                            className="btn-primary flex items-center gap-2"
                        >
                            {saved ? <FiCheck className="w-4 h-4" /> : <FiSave className="w-4 h-4" />}
                            {saved ? 'Saved!' : 'Save'}
                        </button>
                    </div>
                </div>

                {/* API Keys */}
                <SettingsSection
                    title="API Keys"
                    icon={<FiKey className="w-5 h-5" />}
                    defaultOpen={!settings.groqApiKey}
                >
                    <InputField
                        label="Groq API Key"
                        value={settings.groqApiKey}
                        onChange={(value) => updateSettings({ groqApiKey: value })}
                        type="password"
                        placeholder="gsk_..."
                        helpText="Get your free API key at console.groq.com (750K tokens/day free)"
                    />

                    <div className="p-3 bg-dark-800 rounded-lg">
                        <p className="text-sm text-dark-300">
                            <strong className="text-primary-400">Free Tier Benefits:</strong>
                        </p>
                        <ul className="text-sm text-dark-400 mt-2 space-y-1">
                            <li>• Whisper Large V3 for speech-to-text</li>
                            <li>• Llama 3.3 70B for answer generation</li>
                            <li>• 750,000 tokens per day (~50 interviews)</li>
                        </ul>
                    </div>
                </SettingsSection>

                {/* Speech Recognition */}
                <SettingsSection
                    title="Speech Recognition"
                    icon={<FiMic className="w-5 h-5" />}
                >
                    <SelectField
                        label="ASR Provider"
                        value={settings.asrProvider}
                        onChange={(value) => updateSettings({ asrProvider: value as any })}
                        options={[
                            { value: 'groq', label: 'Groq Whisper (Cloud - Recommended)' },
                            { value: 'whisper-local', label: 'Whisper.cpp (Local - Requires Setup)' },
                            { value: 'auto', label: 'Auto (Local with Cloud Fallback)' },
                        ]}
                        helpText="Choose your speech recognition provider"
                    />

                    <SelectField
                        label="Language"
                        value={settings.language}
                        onChange={(value) => updateSettings({ language: value })}
                        options={languages.map(l => ({ value: l.code, label: l.name }))}
                        helpText="Auto-detect works well for most cases"
                    />

                    <SelectField
                        label="Audio Source"
                        value={settings.audioSource}
                        onChange={(value) => updateSettings({ audioSource: value as any })}
                        options={[
                            { value: 'microphone', label: 'Microphone Only' },
                            { value: 'system', label: 'System Audio Only' },
                            { value: 'both', label: 'Both (Microphone + System)' },
                        ]}
                        helpText="System audio captures what you hear on calls"
                    />

                    <ToggleField
                        label="Noise Reduction"
                        checked={settings.enableNoiseReduction}
                        onChange={(checked) => updateSettings({ enableNoiseReduction: checked })}
                        helpText="Reduce background noise for better transcription"
                    />
                </SettingsSection>

                {/* AI Answer Generation */}
                <SettingsSection
                    title="AI Answer Generation"
                    icon={<FiMonitor className="w-5 h-5" />}
                >
                    <SelectField
                        label="AI Provider"
                        value={settings.aiProvider}
                        onChange={(value) => updateSettings({ aiProvider: value as any })}
                        options={[
                            { value: 'groq', label: 'Groq Llama 3.3 70B (Cloud - Recommended)' },
                            { value: 'ollama', label: `Ollama (Local)${ollamaAvailable ? '' : ' - Not Running'}` },
                            { value: 'auto', label: 'Auto (Cloud with Local Fallback)' },
                        ]}
                        helpText="Groq is free and fastest. Ollama requires local setup."
                    />

                    {settings.aiProvider === 'ollama' && (
                        <SelectField
                            label="Ollama Model"
                            value={settings.ollamaModel}
                            onChange={(value) => updateSettings({ ollamaModel: value })}
                            options={
                                ollamaModels.length > 0
                                    ? ollamaModels.map(m => ({ value: m, label: m }))
                                    : [{ value: 'llama3.2', label: 'llama3.2 (default)' }]
                            }
                            helpText="Select your locally installed model"
                        />
                    )}

                    <SelectField
                        label="Default Answer Length"
                        value={settings.defaultAnswerLength}
                        onChange={(value) => updateSettings({ defaultAnswerLength: value as any })}
                        options={[
                            { value: 'short', label: 'Short (~30 seconds)' },
                            { value: 'medium', label: 'Medium (~60 seconds)' },
                            { value: 'long', label: 'Long (~90 seconds)' },
                        ]}
                    />
                </SettingsSection>

                {/* Overlay Display */}
                <SettingsSection
                    title="Overlay Display"
                    icon={<FiEye className="w-5 h-5" />}
                >
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-dark-200">
                            Overlay Opacity: {Math.round(settings.overlayOpacity * 100)}%
                        </label>
                        <input
                            type="range"
                            min="30"
                            max="100"
                            value={settings.overlayOpacity * 100}
                            onChange={(e) => updateSettings({ overlayOpacity: parseInt(e.target.value) / 100 })}
                            className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
                        />
                    </div>

                    <ToggleField
                        label="Show Transcription"
                        checked={settings.showTranscription}
                        onChange={(checked) => updateSettings({ showTranscription: checked })}
                        helpText="Display real-time transcription in overlay"
                    />

                    <ToggleField
                        label="Show Question Type"
                        checked={settings.showQuestionType}
                        onChange={(checked) => updateSettings({ showQuestionType: checked })}
                        helpText="Display detected question type label"
                    />

                    <ToggleField
                        label="Auto-hide on Screen Share"
                        checked={settings.autoHideOnScreenShare}
                        onChange={(checked) => updateSettings({ autoHideOnScreenShare: checked })}
                        helpText="Automatically hide overlay when screen sharing is detected"
                    />
                </SettingsSection>

                {/* Stealth & Privacy */}
                <SettingsSection
                    title="Stealth & Privacy"
                    icon={<FiShield className="w-5 h-5" />}
                >
                    <ToggleField
                        label="Stealth Mode"
                        checked={settings.stealthMode}
                        onChange={(checked) => updateSettings({ stealthMode: checked })}
                        helpText="Enable all stealth features (process hiding, window exclusion)"
                    />

                    <ToggleField
                        label="Hide from Dock/Taskbar"
                        checked={settings.hideFromDock}
                        onChange={(checked) => updateSettings({ hideFromDock: checked })}
                        helpText="Hide app icon from dock (macOS) or taskbar (Windows)"
                    />

                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                        <p className="text-sm text-yellow-400">
                            <strong>⚠️ Important:</strong> These features are designed for practice and
                            accessibility. Using this tool deceptively in actual interviews may violate
                            company policies.
                        </p>
                    </div>
                </SettingsSection>

                {/* Keyboard Shortcuts */}
                <div className="p-4 bg-dark-800 rounded-lg">
                    <h3 className="font-medium text-white mb-3">Keyboard Shortcuts</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-dark-400">Toggle Overlay</span>
                            <kbd className="px-2 py-0.5 bg-dark-700 rounded text-dark-300">⌘⇧O</kbd>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-dark-400">Toggle Main Window</span>
                            <kbd className="px-2 py-0.5 bg-dark-700 rounded text-dark-300">⌘⇧R</kbd>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-dark-400">Hide All</span>
                            <kbd className="px-2 py-0.5 bg-dark-700 rounded text-dark-300">⌘⇧H</kbd>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-dark-400">Toggle Click-through</span>
                            <kbd className="px-2 py-0.5 bg-dark-700 rounded text-dark-300">⌘⇧C</kbd>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsPanel;
