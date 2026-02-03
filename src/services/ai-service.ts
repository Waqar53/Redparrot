// ============================================================================
// RedParrot - AI Answer Generation Service
// Uses Groq (FREE) and Ollama (local) for generating interview answers
// ============================================================================

import { QuestionType, DetectedQuestion } from './question-detector';

export type AnswerLength = 'short' | 'medium' | 'long';

export interface GeneratedAnswer {
    text: string;
    length: AnswerLength;
    estimatedDuration: number; // seconds
    format: string;
    generatedAt: number;
}

export interface AnswerContext {
    resume?: ResumeData;
    jobDescription?: string;
    companyName?: string;
    previousQA?: Array<{ question: string; answer: string }>;
    customInstructions?: string;
}

export interface ResumeData {
    name?: string;
    title?: string;
    summary?: string;
    experience?: Array<{
        company: string;
        role: string;
        duration: string;
        highlights: string[];
    }>;
    skills?: string[];
    education?: Array<{
        institution: string;
        degree: string;
        year: string;
    }>;
    projects?: Array<{
        name: string;
        description: string;
        technologies: string[];
    }>;
}

export interface AIServiceConfig {
    provider: 'groq' | 'ollama' | 'auto';
    groqApiKey: string;
    ollamaBaseUrl: string;
    ollamaModel: string;
    temperature: number;
    maxTokens: number;
}

const DEFAULT_CONFIG: AIServiceConfig = {
    provider: 'groq',
    groqApiKey: '',
    ollamaBaseUrl: 'http://localhost:11434',
    ollamaModel: 'llama3.2',
    temperature: 0.7,
    maxTokens: 1024,
};

// Answer length configurations
const LENGTH_CONFIG: Record<AnswerLength, { words: number; duration: number }> = {
    short: { words: 75, duration: 30 },
    medium: { words: 150, duration: 60 },
    long: { words: 225, duration: 90 },
};

export class AIAnswerService {
    private config: AIServiceConfig;
    private context: AnswerContext = {};

    constructor(config: Partial<AIServiceConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Set context for answer generation
     */
    setContext(context: AnswerContext): void {
        this.context = { ...this.context, ...context };
    }

    /**
     * Update resume data
     */
    setResume(resume: ResumeData): void {
        this.context.resume = resume;
    }

    /**
     * Generate answer for a detected question
     */
    async generateAnswer(
        question: DetectedQuestion,
        length: AnswerLength = 'medium'
    ): Promise<GeneratedAnswer> {
        const prompt = this.buildPrompt(question, length);

        let responseText: string;

        switch (this.config.provider) {
            case 'groq':
                responseText = await this.generateWithGroq(prompt);
                break;
            case 'ollama':
                responseText = await this.generateWithOllama(prompt);
                break;
            case 'auto':
                try {
                    responseText = await this.generateWithGroq(prompt);
                } catch {
                    responseText = await this.generateWithOllama(prompt);
                }
                break;
            default:
                throw new Error('Invalid AI provider');
        }

        return {
            text: this.formatAnswer(responseText),
            length,
            estimatedDuration: LENGTH_CONFIG[length].duration,
            format: question.suggestedAnswerFormat,
            generatedAt: Date.now(),
        };
    }

    /**
     * Generate multiple answer versions
     */
    async generateAllLengths(
        question: DetectedQuestion
    ): Promise<Record<AnswerLength, GeneratedAnswer>> {
        const [short, medium, long] = await Promise.all([
            this.generateAnswer(question, 'short'),
            this.generateAnswer(question, 'medium'),
            this.generateAnswer(question, 'long'),
        ]);

        return { short, medium, long };
    }

    /**
     * Build prompt for answer generation - generates FAANG-level interview answers
     */
    private buildPrompt(question: DetectedQuestion, length: AnswerLength): string {
        const lengthConfig = LENGTH_CONFIG[length];

        let prompt = `You are an elite interview coach who has helped candidates get offers at Google, Amazon, Meta, Apple, and top startups. Your answers are famous for being specific, memorable, and impossible to forget.

=== CRITICAL RULES FOR EXCEPTIONAL ANSWERS ===

1. SPECIFICITY IS EVERYTHING
   - Never use generic phrases like "I have experience in X"
   - Always include: specific technologies, team sizes, timelines, metrics
   - Example: Instead of "I improved performance" say "I reduced API latency from 800ms to 120ms by implementing Redis caching, which increased user engagement by 23%"

2. STRUCTURE FOR IMPACT
   - Start with a hook that directly addresses the question
   - Use the CAR format: Context → Action → Result
   - End with forward-looking enthusiasm about the role

3. SOUND LIKE A TOP PERFORMER
   - Use power verbs: "architected", "spearheaded", "drove", "optimized"
   - Show ownership: "I led", "I identified", "I implemented"
   - Demonstrate impact: always quantify when possible

4. ANSWER LENGTH: ${length} (${lengthConfig.words} words, ~${lengthConfig.duration} seconds speaking time)

5. AVOID THESE MISTAKES:
   - No hedging words: "I think", "maybe", "kind of"
   - No generic buzzwords without context
   - No rambling - every sentence must add value
   - No obvious filler content

`;

        // Add format-specific instructions
        if (question.suggestedAnswerFormat === 'STAR') {
            prompt += `
=== USE STAR METHOD (Behavioral Question) ===
S - Situation: Set the scene in 1-2 sentences (company, project, challenge)
T - Task: Your specific responsibility (not the team's)
A - Action: 3-4 specific things YOU did (technical details, decisions, leadership)
R - Result: Quantified impact (%, $, time saved, users affected)
`;
        } else if (question.suggestedAnswerFormat === 'technical') {
            prompt += `
=== TECHNICAL ANSWER FORMAT (MUST INCLUDE CODE) ===
1. Clear, accurate definition first (1-2 sentences max)
2. Key differences with a COMPARISON TABLE if comparing two things
3. **ALWAYS INCLUDE CODE EXAMPLES** - Show practical code snippets with:
   - Clean, working code in JavaScript/TypeScript/Python as appropriate
   - Comments explaining key parts
   - Real-world use case
4. Performance/complexity considerations (Big O if relevant)
5. When to use each (decision criteria)

EXAMPLE CODE FORMAT:
\`\`\`javascript
// Brief explanation of what this demonstrates
const example = () => {
    // Key implementation detail
};
\`\`\`
`;
        } else if (question.suggestedAnswerFormat === 'detailed') {
            prompt += `
=== SYSTEM DESIGN / DETAILED FORMAT ===
1. Clarify requirements and constraints briefly
2. High-level architecture with component breakdown
3. **INCLUDE CODE/PSEUDOCODE** for critical paths
4. Database schema or API design if relevant
5. Scaling considerations with specific numbers
`;
        } else {
            // Default to include code if question mentions programming/coding terms
            prompt += `
=== ANSWER GUIDELINES ===
- If this is a coding/programming question: ALWAYS include code examples
- If comparing technologies: include a brief comparison
- Be specific and technical - interviewers want depth
`;
        }

        // Add resume context
        if (this.context.resume) {
            prompt += `
=== YOUR BACKGROUND (weave this in naturally) ===
${this.buildResumeContext()}
`;
        }

        // Add job context
        if (this.context.jobDescription) {
            prompt += `
=== TARGET ROLE CONTEXT ===
${this.context.jobDescription}
`;
        }

        if (this.context.companyName) {
            prompt += `
TARGET COMPANY: ${this.context.companyName} - Show enthusiasm for this specific company
`;
        }

        // Add custom instructions
        if (this.context.customInstructions) {
            prompt += `
=== ADDITIONAL INSTRUCTIONS ===
${this.context.customInstructions}
`;
        }

        // Add the question with formatting
        prompt += `
=== THE QUESTION ===
Type: ${question.type}
Question: "${question.text}"

=== GENERATE YOUR ANSWER NOW ===
CRITICAL INSTRUCTIONS:
1. Begin directly with your answer - NO intro phrases like "Great question" or "Sure"
2. For ANY technical/coding question: INCLUDE CODE EXAMPLES with proper formatting
3. Make it sound natural yet impressive - like a senior engineer explaining to a peer
4. Include specific numbers, technologies, and measurable outcomes
5. For comparisons: start with the KEY difference, then explain WHY it matters

OUTPUT FORMAT:
- Use markdown code blocks with language tags: \`\`\`javascript, \`\`\`python, etc.
- Use bullet points for listing multiple items
- Keep code examples concise but complete enough to be useful
`;

        return prompt;
    }

    /**
     * Build resume context string
     */
    private buildResumeContext(): string {
        const resume = this.context.resume;
        if (!resume) return 'No resume provided';

        let context = '';

        if (resume.name) context += `Name: ${resume.name}\n`;
        if (resume.title) context += `Current Role: ${resume.title}\n`;
        if (resume.summary) context += `Summary: ${resume.summary}\n`;

        if (resume.experience && resume.experience.length > 0) {
            context += '\nRecent Experience:\n';
            for (const exp of resume.experience.slice(0, 3)) {
                context += `- ${exp.role} at ${exp.company} (${exp.duration})\n`;
                if (exp.highlights.length > 0) {
                    context += `  Key achievements: ${exp.highlights.slice(0, 2).join('; ')}\n`;
                }
            }
        }

        if (resume.skills && resume.skills.length > 0) {
            context += `\nSkills: ${resume.skills.slice(0, 15).join(', ')}\n`;
        }

        if (resume.projects && resume.projects.length > 0) {
            context += '\nKey Projects:\n';
            for (const project of resume.projects.slice(0, 2)) {
                context += `- ${project.name}: ${project.description}\n`;
            }
        }

        return context;
    }

    /**
     * Generate answer using Groq API (FREE - Llama 3.3 70B)
     */
    private async generateWithGroq(prompt: string): Promise<string> {
        if (!this.config.groqApiKey) {
            throw new Error('Groq API key not configured');
        }

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.groqApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile', // FREE model
                messages: [
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
                temperature: this.config.temperature,
                max_tokens: this.config.maxTokens,
                stream: false,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Groq API error: ${response.status} - ${error}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
    }

    /**
     * Generate answer using local Ollama
     */
    private async generateWithOllama(prompt: string): Promise<string> {
        try {
            const response = await fetch(`${this.config.ollamaBaseUrl}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: this.config.ollamaModel,
                    prompt: prompt,
                    stream: false,
                    options: {
                        temperature: this.config.temperature,
                        num_predict: this.config.maxTokens,
                    },
                }),
            });

            if (!response.ok) {
                throw new Error(`Ollama error: ${response.status}`);
            }

            const data = await response.json();
            return data.response || '';
        } catch (error) {
            console.error('[AI] Ollama error:', error);
            throw error;
        }
    }

    /**
     * Stream answer generation (for faster TTFT)
     */
    async *streamAnswer(
        question: DetectedQuestion,
        length: AnswerLength = 'medium'
    ): AsyncGenerator<string> {
        const prompt = this.buildPrompt(question, length);

        if (this.config.provider === 'groq' || this.config.provider === 'auto') {
            yield* this.streamWithGroq(prompt);
        } else {
            yield* this.streamWithOllama(prompt);
        }
    }

    /**
     * Stream from Groq API
     */
    private async *streamWithGroq(prompt: string): AsyncGenerator<string> {
        if (!this.config.groqApiKey) {
            throw new Error('Groq API key not configured');
        }

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.groqApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: prompt }],
                temperature: this.config.temperature,
                max_tokens: this.config.maxTokens,
                stream: true,
            }),
        });

        if (!response.ok) {
            throw new Error(`Groq API error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim() !== '');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices?.[0]?.delta?.content;
                        if (content) {
                            yield content;
                        }
                    } catch {
                        // Skip invalid JSON
                    }
                }
            }
        }
    }

    /**
     * Stream from Ollama
     */
    private async *streamWithOllama(prompt: string): AsyncGenerator<string> {
        const response = await fetch(`${this.config.ollamaBaseUrl}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: this.config.ollamaModel,
                prompt: prompt,
                stream: true,
                options: {
                    temperature: this.config.temperature,
                    num_predict: this.config.maxTokens,
                },
            }),
        });

        if (!response.ok) {
            throw new Error(`Ollama error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim() !== '');

            for (const line of lines) {
                try {
                    const parsed = JSON.parse(line);
                    if (parsed.response) {
                        yield parsed.response;
                    }
                } catch {
                    // Skip invalid JSON
                }
            }
        }
    }

    /**
     * Format answer text
     */
    private formatAnswer(text: string): string {
        let formatted = text.trim();

        // Remove common AI artifacts
        formatted = formatted.replace(/^(Here's|Here is|Sure,|Of course,|Certainly,)\s*/i, '');
        formatted = formatted.replace(/^(I'd be happy to|I'll|Let me)\s*/i, '');

        // Ensure proper capitalization
        formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);

        return formatted;
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<AIServiceConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Check if Ollama is available
     */
    async checkOllamaAvailability(): Promise<boolean> {
        try {
            const response = await fetch(`${this.config.ollamaBaseUrl}/api/tags`);
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Get available Ollama models
     */
    async getOllamaModels(): Promise<string[]> {
        try {
            const response = await fetch(`${this.config.ollamaBaseUrl}/api/tags`);
            if (!response.ok) return [];

            const data = await response.json();
            return data.models?.map((m: { name: string }) => m.name) || [];
        } catch {
            return [];
        }
    }

    /**
     * Analyze an image (screenshot) for coding problems or interview content
     */
    async analyzeImage(imageBase64: string, context: 'coding' | 'interview' | 'general' = 'general'): Promise<string> {
        if (!this.config.groqApiKey) {
            throw new Error('Groq API key not configured');
        }

        const prompts = {
            coding: `You are an expert programmer helping in a coding interview. Analyze this screenshot and:
1. Identify any coding problem or question shown
2. Explain the problem clearly
3. Provide a step-by-step solution approach
4. Give the complete code solution with comments
5. Explain time and space complexity

Be concise but thorough. Format code properly.`,
            interview: `You are an interview coach. Analyze this screenshot and:
1. Identify any interview question or scenario shown
2. Provide a clear, professional answer
3. Include specific examples if relevant
4. Keep the answer natural and conversational

Format your response clearly.`,
            general: `Analyze this screenshot and describe:
1. What is being shown
2. Any questions or problems visible
3. A helpful response or solution if applicable

Be concise and helpful.`
        };

        try {
            // Use Groq's llama-3.2-90b-vision-preview for image analysis
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.config.groqApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'llama-3.2-90b-vision-preview',
                    messages: [
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'text',
                                    text: prompts[context],
                                },
                                {
                                    type: 'image_url',
                                    image_url: {
                                        url: imageBase64.startsWith('data:')
                                            ? imageBase64
                                            : `data:image/png;base64,${imageBase64}`,
                                    },
                                },
                            ],
                        },
                    ],
                    temperature: 0.5,
                    max_tokens: 2048,
                }),
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Groq Vision API error: ${response.status} - ${error}`);
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || 'Unable to analyze the image.';
        } catch (error) {
            console.error('[AI] Image analysis error:', error);
            throw error;
        }
    }

    /**
     * Generate answer from manual text input (for when transcription wasn't auto-detected as question)
     */
    async generateAnswerFromText(text: string, length: AnswerLength = 'medium'): Promise<GeneratedAnswer> {
        // Create a detected question object from the text
        const question: DetectedQuestion = {
            text: text,
            type: 'behavioral' as QuestionType,
            confidence: 1.0,
            keywords: text.split(' ').slice(0, 5),
            suggestedAnswerFormat: 'concise',
            timestamp: Date.now(),
        };

        return this.generateAnswer(question, length);
    }
}

// Export singleton instance
export const aiAnswerService = new AIAnswerService();
