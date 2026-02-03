// ============================================================================
// RedParrot - Question Detection Service
// Detects interview questions from transcribed text
// ============================================================================

export type QuestionType =
    | 'behavioral'
    | 'technical'
    | 'situational'
    | 'competency'
    | 'coding'
    | 'system-design'
    | 'general'
    | 'clarification';

export interface DetectedQuestion {
    text: string;
    type: QuestionType;
    confidence: number;
    keywords: string[];
    suggestedAnswerFormat: 'STAR' | 'technical' | 'concise' | 'detailed';
    timestamp: number;
}

// Question pattern matchers
const QUESTION_PATTERNS = {
    // Behavioral questions (STAR method recommended)
    behavioral: [
        /tell me about a time when/i,
        /describe a situation where/i,
        /give me an example of/i,
        /have you ever had to/i,
        /can you share an experience/i,
        /walk me through a time/i,
        /describe a challenge you faced/i,
        /tell me about your experience with/i,
        /how did you handle/i,
        /what did you do when/i,
        /describe the most difficult/i,
        /tell me about a project/i,
    ],

    // Technical questions
    technical: [
        /how does .+ work/i,
        /what is the difference between/i,
        /explain .+ to me/i,
        /how would you implement/i,
        /what are the advantages of/i,
        /can you explain/i,
        /what is your understanding of/i,
        /describe how .+ works/i,
        /what happens when/i,
        /why would you use/i,
        /compare .+ and/i,
        /what's the time complexity/i,
        /how do you optimize/i,
    ],

    // Situational/hypothetical questions
    situational: [
        /what would you do if/i,
        /how would you approach/i,
        /imagine you/i,
        /suppose you/i,
        /if you were/i,
        /how would you handle/i,
        /what if/i,
        /let's say/i,
        /hypothetically/i,
    ],

    // Competency/skill assessment
    competency: [
        /what are your strengths/i,
        /what is your greatest/i,
        /how do you prioritize/i,
        /how do you manage/i,
        /what's your approach to/i,
        /how do you stay/i,
        /what motivates you/i,
        /how do you deal with/i,
    ],

    // Coding questions
    coding: [
        /write a function/i,
        /implement .+ algorithm/i,
        /solve this problem/i,
        /code a solution/i,
        /write code to/i,
        /can you code/i,
        /leetcode/i,
        /hackerrank/i,
        /data structure/i,
        /reverse .+ string/i,
        /find .+ in .+ array/i,
        /sort .+ array/i,
    ],

    // System design questions
    'system-design': [
        /design a system/i,
        /how would you design/i,
        /architect .+ solution/i,
        /scale .+ to/i,
        /design .+ like/i,
        /build .+ from scratch/i,
        /high-level design/i,
        /system architecture/i,
    ],
};

// Keywords that indicate a question
const QUESTION_INDICATORS = [
    'what', 'why', 'how', 'when', 'where', 'who', 'which',
    'can you', 'could you', 'would you', 'do you', 'did you',
    'tell me', 'describe', 'explain', 'share', 'walk me through',
];

// Keywords that indicate end of question
const QUESTION_END_INDICATORS = [
    '?',
    'please',
    'thank you',
    'go ahead',
];

export class QuestionDetectorService {
    private transcriptionBuffer: string = '';
    private lastQuestionTime: number = 0;
    private minQuestionGapMs: number = 2000; // Reduced to 2 seconds for faster response
    private detectedQuestions: DetectedQuestion[] = [];
    private lastProcessedText: string = ''; // Track what we've already processed

    constructor() { }

    /**
     * Process new transcription text and detect questions
     */
    detectQuestion(transcriptionText: string): DetectedQuestion | null {
        // Skip if this is the same text we just processed
        if (transcriptionText === this.lastProcessedText) {
            return null;
        }
        this.lastProcessedText = transcriptionText;

        // Add ONLY the new text to buffer (avoid duplicates)
        if (!this.transcriptionBuffer.includes(transcriptionText)) {
            this.transcriptionBuffer += ' ' + transcriptionText;
        }

        // Clean buffer - trim and limit length
        this.transcriptionBuffer = this.transcriptionBuffer.trim();

        // If buffer is getting too long, keep only the last portion
        if (this.transcriptionBuffer.length > 400) {
            // Keep the last 300 characters to maintain context
            this.transcriptionBuffer = this.transcriptionBuffer.slice(-300);
        }

        // Check if we have a complete sentence/question
        if (!this.isCompleteSentence(this.transcriptionBuffer)) {
            return null;
        }

        // Check for question patterns
        const question = this.analyzeForQuestion(this.transcriptionBuffer);

        if (question) {
            // Check minimum gap between questions
            const now = Date.now();
            if (now - this.lastQuestionTime < this.minQuestionGapMs) {
                // Too soon after last question, might be part of same question
                return null;
            }

            this.lastQuestionTime = now;
            this.detectedQuestions.push(question);

            // CRITICAL: Clear buffer completely after detecting a question
            this.transcriptionBuffer = '';
            this.lastProcessedText = '';

            return question;
        }

        return null;
    }

    /**
     * Force clear the buffer (call this when starting a new question)
     */
    clearBuffer(): void {
        this.transcriptionBuffer = '';
        this.lastProcessedText = '';
        console.log('[QuestionDetector] Buffer cleared');
    }

    /**
     * Check if text appears to be a complete sentence
     */
    private isCompleteSentence(text: string): boolean {
        const trimmed = text.trim();

        // Check for ending punctuation
        if (/[.?!]$/.test(trimmed)) {
            return true;
        }

        // Check for question end indicators
        for (const indicator of QUESTION_END_INDICATORS) {
            if (trimmed.toLowerCase().includes(indicator)) {
                return true;
            }
        }

        // Check if text is long enough to likely be complete
        const words = trimmed.split(/\s+/);
        if (words.length >= 8) {
            // Check if it starts with a question word
            const firstWord = words[0].toLowerCase();
            if (QUESTION_INDICATORS.some(q => firstWord.includes(q))) {
                return true;
            }
        }

        return false;
    }

    /**
     * Analyze text for question patterns
     */
    private analyzeForQuestion(text: string): DetectedQuestion | null {
        const normalizedText = text.trim().toLowerCase();

        // Check if it looks like a question at all
        if (!this.looksLikeQuestion(normalizedText)) {
            return null;
        }

        // Determine question type
        let matchedType: QuestionType = 'general';
        let highestConfidence = 0;
        let matchedKeywords: string[] = [];

        for (const [type, patterns] of Object.entries(QUESTION_PATTERNS)) {
            for (const pattern of patterns) {
                if (pattern.test(normalizedText)) {
                    const confidence = this.calculateConfidence(normalizedText, pattern);
                    if (confidence > highestConfidence) {
                        highestConfidence = confidence;
                        matchedType = type as QuestionType;
                        matchedKeywords = this.extractKeywords(normalizedText, pattern);
                    }
                }
            }
        }

        // If no specific pattern matched but it looks like a question
        if (highestConfidence === 0 && this.looksLikeQuestion(normalizedText)) {
            highestConfidence = 0.5;
        }

        // Minimum confidence threshold
        if (highestConfidence < 0.3) {
            return null;
        }

        // Determine suggested answer format
        const suggestedFormat = this.getSuggestedFormat(matchedType);

        return {
            text: this.cleanQuestionText(text),
            type: matchedType,
            confidence: highestConfidence,
            keywords: matchedKeywords,
            suggestedAnswerFormat: suggestedFormat,
            timestamp: Date.now(),
        };
    }

    /**
     * Check if text looks like a question
     */
    private looksLikeQuestion(text: string): boolean {
        // Contains question mark
        if (text.includes('?')) {
            return true;
        }

        // Starts with question word/phrase
        for (const indicator of QUESTION_INDICATORS) {
            if (text.startsWith(indicator + ' ') || text.startsWith(indicator + ',')) {
                return true;
            }
        }

        // Contains common interview question phrases
        const interviewPhrases = [
            'tell me about',
            'walk me through',
            'describe',
            'explain',
            'what is your',
            'how do you',
            'why do you',
        ];

        for (const phrase of interviewPhrases) {
            if (text.includes(phrase)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Calculate confidence score for a pattern match
     */
    private calculateConfidence(text: string, pattern: RegExp): number {
        const match = text.match(pattern);
        if (!match) return 0;

        let confidence = 0.6; // Base confidence for pattern match

        // Increase confidence based on text characteristics
        if (text.includes('?')) {
            confidence += 0.2;
        }

        // Check for multiple keywords
        const questionWords = text.match(/\b(what|how|why|when|where|who|which|tell|describe|explain)\b/gi);
        if (questionWords && questionWords.length > 1) {
            confidence += 0.1;
        }

        // Decrease confidence for very short text
        if (text.split(' ').length < 5) {
            confidence -= 0.2;
        }

        return Math.min(1, Math.max(0, confidence));
    }

    /**
     * Extract relevant keywords from question
     */
    private extractKeywords(text: string, pattern: RegExp): string[] {
        const keywords: string[] = [];

        // Extract words after pattern match
        const match = text.match(pattern);
        if (match) {
            const afterMatch = text.slice(text.indexOf(match[0]) + match[0].length);
            const words = afterMatch.split(/\s+/).filter(w =>
                w.length > 3 &&
                !['the', 'and', 'for', 'with', 'that', 'this', 'your', 'about'].includes(w)
            );
            keywords.push(...words.slice(0, 5));
        }

        // Extract technical terms
        const technicalTerms = text.match(/\b(api|database|algorithm|function|class|system|design|performance|security|testing|deployment)\b/gi);
        if (technicalTerms) {
            keywords.push(...technicalTerms.map(t => t.toLowerCase()));
        }

        // Remove duplicates
        return [...new Set(keywords)];
    }

    /**
     * Clean and format question text
     */
    private cleanQuestionText(text: string): string {
        let cleaned = text.trim();

        // Capitalize first letter
        cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

        // Ensure ends with question mark if it's a question
        if (!cleaned.endsWith('?') && !cleaned.endsWith('.') && !cleaned.endsWith('!')) {
            cleaned += '?';
        }

        return cleaned;
    }

    /**
     * Get suggested answer format based on question type
     */
    private getSuggestedFormat(type: QuestionType): 'STAR' | 'technical' | 'concise' | 'detailed' {
        switch (type) {
            case 'behavioral':
            case 'situational':
                return 'STAR';
            case 'technical':
            case 'coding':
                return 'technical';
            case 'system-design':
                return 'detailed';
            case 'competency':
            case 'clarification':
            case 'general':
            default:
                return 'concise';
        }
    }

    /**
     * Get recent detected questions
     */
    getRecentQuestions(count: number = 10): DetectedQuestion[] {
        return this.detectedQuestions.slice(-count);
    }

    /**
     * Clear question history
     */
    clearHistory(): void {
        this.detectedQuestions = [];
        this.transcriptionBuffer = '';
    }

    /**
     * Get question type display name
     */
    static getQuestionTypeLabel(type: QuestionType): string {
        const labels: Record<QuestionType, string> = {
            behavioral: 'Behavioral',
            technical: 'Technical',
            situational: 'Situational',
            competency: 'Competency',
            coding: 'Coding',
            'system-design': 'System Design',
            general: 'General',
            clarification: 'Clarification',
        };
        return labels[type] || 'Unknown';
    }
}

// Export singleton instance
export const questionDetector = new QuestionDetectorService();
