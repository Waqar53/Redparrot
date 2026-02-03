// ============================================================================
// RedParrot - Resume Parser Service
// Extracts structured data from PDF and DOCX resumes
// ============================================================================

import { ResumeData } from './ai-service';

export interface ParsedResume extends ResumeData {
    rawText: string;
    fileType: 'pdf' | 'docx' | 'txt';
    parseConfidence: number;
    parsedAt: number;
}

export interface ParserConfig {
    extractSkills: boolean;
    extractEducation: boolean;
    extractExperience: boolean;
    extractProjects: boolean;
    maxExperienceItems: number;
    maxSkills: number;
}

const DEFAULT_CONFIG: ParserConfig = {
    extractSkills: true,
    extractEducation: true,
    extractExperience: true,
    extractProjects: true,
    maxExperienceItems: 5,
    maxSkills: 30,
};

// Common skill keywords
const SKILL_KEYWORDS = [
    // Programming Languages
    'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'ruby', 'go', 'rust', 'swift',
    'kotlin', 'php', 'scala', 'r', 'matlab', 'perl', 'sql', 'html', 'css', 'sass', 'less',

    // Frameworks & Libraries
    'react', 'angular', 'vue', 'node.js', 'express', 'django', 'flask', 'spring', 'rails',
    'next.js', 'nuxt', 'svelte', 'jquery', 'bootstrap', 'tailwind', 'material-ui', 'redux',

    // Cloud & DevOps
    'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'jenkins', 'gitlab', 'github',
    'circleci', 'ansible', 'puppet', 'chef', 'nginx', 'apache', 'linux', 'unix', 'bash',

    // Databases
    'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'cassandra', 'dynamodb',
    'oracle', 'sqlite', 'neo4j', 'graphql', 'rest', 'api',

    // AI/ML
    'machine learning', 'deep learning', 'tensorflow', 'pytorch', 'keras', 'scikit-learn',
    'nlp', 'computer vision', 'data science', 'pandas', 'numpy', 'jupyter',

    // Soft Skills (for comprehensive parsing)
    'leadership', 'communication', 'teamwork', 'problem solving', 'agile', 'scrum',
    'project management', 'mentoring', 'public speaking',
];

// Education keywords
const EDUCATION_KEYWORDS = [
    'bachelor', 'master', 'phd', 'doctorate', 'mba', 'bs', 'ba', 'ms', 'ma', 'bsc', 'msc',
    'university', 'college', 'institute', 'school', 'degree', 'major', 'minor',
    'computer science', 'engineering', 'business', 'mathematics', 'physics',
];

// Experience section headers
const EXPERIENCE_HEADERS = [
    'experience', 'work experience', 'professional experience', 'employment history',
    'work history', 'career history', 'professional background',
];

export class ResumeParserService {
    private config: ParserConfig;

    constructor(config: Partial<ParserConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Parse resume from File object
     */
    async parseFile(file: File): Promise<ParsedResume> {
        const fileType = this.getFileType(file.name);
        let rawText: string;

        switch (fileType) {
            case 'pdf':
                rawText = await this.extractTextFromPDF(file);
                break;
            case 'docx':
                rawText = await this.extractTextFromDOCX(file);
                break;
            case 'txt':
                rawText = await file.text();
                break;
            default:
                throw new Error(`Unsupported file type: ${file.name}`);
        }

        return this.parseText(rawText, fileType);
    }

    /**
     * Parse resume from raw text
     */
    parseText(rawText: string, fileType: 'pdf' | 'docx' | 'txt' = 'txt'): ParsedResume {
        const normalizedText = this.normalizeText(rawText);

        const name = this.extractName(normalizedText);
        const title = this.extractTitle(normalizedText);
        const summary = this.extractSummary(normalizedText);
        const experience = this.config.extractExperience
            ? this.extractExperience(normalizedText)
            : [];
        const skills = this.config.extractSkills
            ? this.extractSkills(normalizedText)
            : [];
        const education = this.config.extractEducation
            ? this.extractEducation(normalizedText)
            : [];
        const projects = this.config.extractProjects
            ? this.extractProjects(normalizedText)
            : [];

        // Calculate parse confidence based on extracted fields
        const parseConfidence = this.calculateConfidence({
            name, title, experience, skills, education
        });

        return {
            rawText,
            fileType,
            parseConfidence,
            parsedAt: Date.now(),
            name,
            title,
            summary,
            experience,
            skills,
            education,
            projects,
        };
    }

    /**
     * Get file type from filename
     */
    private getFileType(filename: string): 'pdf' | 'docx' | 'txt' {
        const ext = filename.toLowerCase().split('.').pop();
        if (ext === 'pdf') return 'pdf';
        if (ext === 'docx' || ext === 'doc') return 'docx';
        return 'txt';
    }

    /**
     * Extract text from PDF using pdf-parse (browser-compatible approach)
     */
    private async extractTextFromPDF(file: File): Promise<string> {
        try {
            // Dynamic import for pdf-parse
            // In Electron, we can use the Node.js version
            const arrayBuffer = await file.arrayBuffer();

            // For browser context, we'll use a simpler approach
            // In production, use PDF.js or pdf-parse
            if (typeof window !== 'undefined' && window.electronAPI) {
                // Parse via IPC to main process
                // This would be implemented in main process
                console.warn('[ResumeParser] PDF parsing requires main process handler');
            }

            // Placeholder - in production, implement proper PDF parsing
            return `[PDF Content from ${file.name}]`;
        } catch (error) {
            console.error('[ResumeParser] PDF extraction error:', error);
            throw error;
        }
    }

    /**
     * Extract text from DOCX using mammoth
     */
    private async extractTextFromDOCX(file: File): Promise<string> {
        try {
            // Dynamic import for mammoth
            const mammoth = await import('mammoth');
            const arrayBuffer = await file.arrayBuffer();

            const result = await mammoth.extractRawText({ arrayBuffer });
            return result.value;
        } catch (error) {
            console.error('[ResumeParser] DOCX extraction error:', error);
            throw error;
        }
    }

    /**
     * Normalize text for parsing
     */
    private normalizeText(text: string): string {
        return text
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/\t/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/\n\s*\n/g, '\n\n')
            .trim();
    }

    /**
     * Extract name from resume
     */
    private extractName(text: string): string | undefined {
        const lines = text.split('\n').filter(l => l.trim());

        // Name is usually in the first few lines
        for (const line of lines.slice(0, 5)) {
            const trimmed = line.trim();

            // Skip lines that look like headers or contact info
            if (this.isContactInfo(trimmed)) continue;
            if (this.isSectionHeader(trimmed)) continue;

            // Name pattern: 2-4 capitalized words
            const namePattern = /^([A-Z][a-z]+\s+){1,3}[A-Z][a-z]+$/;
            if (namePattern.test(trimmed)) {
                return trimmed;
            }

            // Fallback: first line that's not too long
            if (trimmed.length > 3 && trimmed.length < 50 && !trimmed.includes('@')) {
                return trimmed;
            }
        }

        return undefined;
    }

    /**
     * Extract job title from resume
     */
    private extractTitle(text: string): string | undefined {
        const lines = text.split('\n').filter(l => l.trim());

        const titlePatterns = [
            /senior|junior|lead|principal|staff|engineer|developer|manager|director|analyst|designer|architect|consultant/i,
        ];

        for (const line of lines.slice(0, 10)) {
            const trimmed = line.trim();

            if (trimmed.length > 5 && trimmed.length < 80) {
                for (const pattern of titlePatterns) {
                    if (pattern.test(trimmed) && !this.isContactInfo(trimmed)) {
                        return trimmed;
                    }
                }
            }
        }

        return undefined;
    }

    /**
     * Extract professional summary
     */
    private extractSummary(text: string): string | undefined {
        const summaryHeaders = ['summary', 'professional summary', 'about', 'profile', 'objective'];

        for (const header of summaryHeaders) {
            const pattern = new RegExp(`(?:${header})[:\\s]*([\\s\\S]*?)(?=\\n\\n|experience|education|skills|$)`, 'i');
            const match = text.match(pattern);

            if (match && match[1]) {
                const summary = match[1].trim();
                if (summary.length > 50 && summary.length < 1000) {
                    return summary;
                }
            }
        }

        return undefined;
    }

    /**
     * Extract work experience
     */
    private extractExperience(text: string): ParsedResume['experience'] {
        const experiences: ParsedResume['experience'] = [];

        // Find experience section
        const expPattern = new RegExp(
            `(?:${EXPERIENCE_HEADERS.join('|')})[:\\s]*([\\s\\S]*?)(?=\\n(?:education|skills|projects|certifications)|$)`,
            'i'
        );

        const match = text.match(expPattern);
        if (!match) return experiences;

        const expSection = match[1];

        // Parse individual experiences
        // Pattern: Company name followed by role and dates
        const expItemPattern = /([A-Z][^•\n]+)\s*[|•\-–]\s*([^•\n]+)\s*[|•\-–]?\s*(\d{4}\s*[-–]\s*(?:\d{4}|present|current))?/gi;

        let expMatch;
        while ((expMatch = expItemPattern.exec(expSection)) !== null && experiences.length < this.config.maxExperienceItems) {
            const [, company, role, duration] = expMatch;

            if (company && role) {
                experiences.push({
                    company: company.trim(),
                    role: role.trim(),
                    duration: duration?.trim() || '',
                    highlights: [],
                });
            }
        }

        return experiences;
    }

    /**
     * Extract skills
     */
    private extractSkills(text: string): string[] {
        const skills: Set<string> = new Set();
        const lowerText = text.toLowerCase();

        // Extract from skills section
        const skillsPattern = /(?:skills|technical skills|technologies)[:\s]*([^\n]+(?:\n[^\n]+)*?)(?=\n\n|experience|education|$)/i;
        const skillsMatch = text.match(skillsPattern);

        if (skillsMatch) {
            const skillsText = skillsMatch[1];
            const skillItems = skillsText.split(/[,•|;]/);

            for (const item of skillItems) {
                const skill = item.trim().toLowerCase();
                if (skill.length > 1 && skill.length < 50) {
                    skills.add(skill);
                }
            }
        }

        // Also scan entire document for known skills
        for (const skill of SKILL_KEYWORDS) {
            if (lowerText.includes(skill.toLowerCase())) {
                skills.add(skill);
            }
        }

        return Array.from(skills).slice(0, this.config.maxSkills);
    }

    /**
     * Extract education
     */
    private extractEducation(text: string): ParsedResume['education'] {
        const education: ParsedResume['education'] = [];

        const eduPattern = /(?:education|academic)[:\s]*([^\n]+(?:\n[^\n]+)*?)(?=\n\n|experience|skills|$)/i;
        const match = text.match(eduPattern);

        if (!match) return education;

        const eduSection = match[1];

        // Look for degree patterns
        const degreePattern = /(bachelor|master|phd|doctorate|mba|bs|ba|ms|ma|bsc|msc)[^\n]*(?:in|of)?\s*([^\n,]*)/gi;

        let eduMatch;
        while ((eduMatch = degreePattern.exec(eduSection)) !== null && education.length < 3) {
            const [fullMatch, degree, field] = eduMatch;

            // Try to extract institution and year
            const yearMatch = fullMatch.match(/\b(19|20)\d{2}\b/);
            const year = yearMatch ? yearMatch[0] : '';

            education.push({
                institution: '', // Would need more complex parsing
                degree: `${degree} ${field}`.trim(),
                year,
            });
        }

        return education;
    }

    /**
     * Extract projects
     */
    private extractProjects(text: string): ParsedResume['projects'] {
        const projects: ParsedResume['projects'] = [];

        const projectPattern = /(?:projects|personal projects|side projects)[:\s]*([^\n]+(?:\n[^\n]+)*?)(?=\n\n|experience|education|skills|$)/i;
        const match = text.match(projectPattern);

        if (!match) return projects;

        const projectSection = match[1];
        const lines = projectSection.split('\n').filter(l => l.trim());

        for (let i = 0; i < lines.length && projects.length < 5; i++) {
            const line = lines[i].trim();

            // Skip bullet points that are too short
            if (line.length < 10) continue;

            // Extract project name (usually at start of line or after bullet)
            const nameMatch = line.match(/^[•\-\*]?\s*([^:–-]+)/);
            if (nameMatch) {
                projects.push({
                    name: nameMatch[1].trim(),
                    description: line,
                    technologies: this.extractTechnologiesFromText(line),
                });
            }
        }

        return projects;
    }

    /**
     * Extract technologies mentioned in text
     */
    private extractTechnologiesFromText(text: string): string[] {
        const technologies: string[] = [];
        const lowerText = text.toLowerCase();

        for (const skill of SKILL_KEYWORDS) {
            if (lowerText.includes(skill.toLowerCase())) {
                technologies.push(skill);
            }
        }

        return technologies.slice(0, 10);
    }

    /**
     * Check if line is contact info
     */
    private isContactInfo(line: string): boolean {
        const patterns = [
            /@/, // Email
            /\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/, // Phone
            /linkedin\.com/i,
            /github\.com/i,
            /http/i,
        ];

        return patterns.some(p => p.test(line));
    }

    /**
     * Check if line is a section header
     */
    private isSectionHeader(line: string): boolean {
        const headers = [
            ...EXPERIENCE_HEADERS,
            'education', 'skills', 'projects', 'certifications', 'awards',
            'summary', 'objective', 'contact', 'references',
        ];

        const lowerLine = line.toLowerCase().trim();
        return headers.some(h => lowerLine === h || lowerLine.startsWith(h + ':'));
    }

    /**
     * Calculate parsing confidence
     */
    private calculateConfidence(data: Partial<ParsedResume>): number {
        let score = 0;

        if (data.name) score += 0.2;
        if (data.title) score += 0.15;
        if (data.experience && data.experience.length > 0) score += 0.25;
        if (data.skills && data.skills.length > 0) score += 0.2;
        if (data.education && data.education.length > 0) score += 0.2;

        return Math.min(1, score);
    }
}

// Export singleton instance
export const resumeParser = new ResumeParserService();
