// ============================================================================
// RedParrot - Resume Upload Component
// Upload and parse resumes for context
// ============================================================================

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FiUpload, FiFile, FiCheck, FiX, FiEdit2, FiTrash2, FiUser
} from 'react-icons/fi';
import { useInterviewStore } from '@/stores/interview-store';
import { resumeParser, ParsedResume } from '@/services/resume-parser';

const ResumeUpload: React.FC = () => {
    const { resume, setResume, jobDescription, setJobDescription, companyName, setCompanyName } = useInterviewStore();
    const [isUploading, setIsUploading] = useState(false);
    const [parsedResume, setParsedResume] = useState<ParsedResume | null>(null);
    const [error, setError] = useState<string | null>(null);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (!file) return;

        setIsUploading(true);
        setError(null);

        try {
            const parsed = await resumeParser.parseFile(file);
            setParsedResume(parsed);
            setResume(parsed);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to parse resume');
        } finally {
            setIsUploading(false);
        }
    }, [setResume]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'application/msword': ['.doc'],
            'text/plain': ['.txt'],
        },
        maxFiles: 1,
        maxSize: 10 * 1024 * 1024, // 10MB
    });

    const handleClearResume = () => {
        setParsedResume(null);
        setResume(undefined as any);
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <FiUser className="w-6 h-6 text-primary-500" />
                <h2 className="text-xl font-semibold text-white">Resume & Job Context</h2>
            </div>

            {/* Resume Upload */}
            <div className="space-y-4">
                <h3 className="text-sm font-medium text-dark-200">Your Resume</h3>

                {!parsedResume ? (
                    <div
                        {...getRootProps()}
                        className={`
              border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
              ${isDragActive
                                ? 'border-primary-500 bg-primary-500/10'
                                : 'border-dark-600 hover:border-dark-500 hover:bg-dark-800/50'
                            }
            `}
                    >
                        <input {...getInputProps()} />
                        {isUploading ? (
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                                <p className="text-dark-300">Parsing resume...</p>
                            </div>
                        ) : (
                            <>
                                <FiUpload className="w-10 h-10 text-dark-400 mx-auto mb-3" />
                                <p className="text-dark-300 mb-1">
                                    {isDragActive
                                        ? 'Drop your resume here'
                                        : 'Drag & drop your resume, or click to browse'
                                    }
                                </p>
                                <p className="text-xs text-dark-500">Supports PDF, DOCX, DOC, TXT (max 10MB)</p>
                            </>
                        )}
                    </div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 bg-dark-800 rounded-xl border border-dark-700"
                    >
                        {/* Resume Header */}
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-primary-500/20 rounded-lg flex items-center justify-center">
                                    <FiFile className="w-5 h-5 text-primary-500" />
                                </div>
                                <div>
                                    <p className="font-medium text-white">{parsedResume.name || 'Resume'}</p>
                                    <p className="text-sm text-dark-400">{parsedResume.title || 'Professional'}</p>
                                </div>
                            </div>
                            <button
                                onClick={handleClearResume}
                                className="p-2 text-dark-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            >
                                <FiTrash2 className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Parse Confidence */}
                        <div className="mb-4">
                            <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-dark-400">Parse Confidence</span>
                                <span className="text-dark-300">{Math.round(parsedResume.parseConfidence * 100)}%</span>
                            </div>
                            <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary-500 rounded-full transition-all"
                                    style={{ width: `${parsedResume.parseConfidence * 100}%` }}
                                />
                            </div>
                        </div>

                        {/* Extracted Data Summary */}
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            {parsedResume.experience && parsedResume.experience.length > 0 && (
                                <div className="p-2 bg-dark-700/50 rounded-lg">
                                    <span className="text-dark-400">Experience</span>
                                    <p className="text-white font-medium">{parsedResume.experience.length} positions</p>
                                </div>
                            )}
                            {parsedResume.skills && parsedResume.skills.length > 0 && (
                                <div className="p-2 bg-dark-700/50 rounded-lg">
                                    <span className="text-dark-400">Skills</span>
                                    <p className="text-white font-medium">{parsedResume.skills.length} skills</p>
                                </div>
                            )}
                            {parsedResume.education && parsedResume.education.length > 0 && (
                                <div className="p-2 bg-dark-700/50 rounded-lg">
                                    <span className="text-dark-400">Education</span>
                                    <p className="text-white font-medium">{parsedResume.education.length} degrees</p>
                                </div>
                            )}
                            {parsedResume.projects && parsedResume.projects.length > 0 && (
                                <div className="p-2 bg-dark-700/50 rounded-lg">
                                    <span className="text-dark-400">Projects</span>
                                    <p className="text-white font-medium">{parsedResume.projects.length} projects</p>
                                </div>
                            )}
                        </div>

                        {/* Skills Preview */}
                        {parsedResume.skills && parsedResume.skills.length > 0 && (
                            <div className="mt-4">
                                <p className="text-xs text-dark-400 mb-2">Top Skills</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {parsedResume.skills.slice(0, 10).map((skill, i) => (
                                        <span
                                            key={i}
                                            className="px-2 py-0.5 text-xs bg-dark-700 text-dark-300 rounded-full"
                                        >
                                            {skill}
                                        </span>
                                    ))}
                                    {parsedResume.skills.length > 10 && (
                                        <span className="px-2 py-0.5 text-xs text-dark-500">
                                            +{parsedResume.skills.length - 10} more
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}

                {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                        {error}
                    </div>
                )}
            </div>

            {/* Job Description */}
            <div className="space-y-2">
                <label className="text-sm font-medium text-dark-200">Job Description (Optional)</label>
                <textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Paste the job description here for better tailored answers..."
                    className="input-field min-h-[120px] resize-y"
                />
                <p className="text-xs text-dark-500">
                    Adding the job description helps generate more relevant answers.
                </p>
            </div>

            {/* Company Name */}
            <div className="space-y-2">
                <label className="text-sm font-medium text-dark-200">Company Name (Optional)</label>
                <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g., Google, Meta, Amazon"
                    className="input-field"
                />
            </div>

            {/* Tips */}
            <div className="p-4 bg-dark-800 rounded-xl">
                <h4 className="font-medium text-white mb-2">💡 Tips for Better Answers</h4>
                <ul className="text-sm text-dark-400 space-y-1">
                    <li>• Upload your latest resume for personalized answers</li>
                    <li>• Add the job description to tailor responses</li>
                    <li>• Include specific achievements with metrics</li>
                    <li>• The AI will use your experience for STAR-format answers</li>
                </ul>
            </div>
        </div>
    );
};

export default ResumeUpload;
