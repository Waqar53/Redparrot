"""
============================================================================
RedParrot - Question Detector Service (Python)
Detects interview questions from transcribed text
============================================================================
"""

import re
from typing import Optional, Dict, List, Any

# Question pattern matchers
QUESTION_PATTERNS = {
    "behavioral": [
        r"tell me about a time when",
        r"describe a situation where",
        r"give me an example of",
        r"have you ever had to",
        r"can you share an experience",
        r"walk me through a time",
        r"describe a challenge you faced",
        r"tell me about your experience with",
        r"how did you handle",
        r"what did you do when",
        r"describe the most difficult",
        r"tell me about a project",
    ],
    "technical": [
        r"how does .+ work",
        r"what is the difference between",
        r"explain .+ to me",
        r"how would you implement",
        r"what are the advantages of",
        r"can you explain",
        r"what is your understanding of",
        r"describe how .+ works",
        r"what happens when",
        r"why would you use",
        r"compare .+ and",
        r"what's the time complexity",
        r"how do you optimize",
    ],
    "situational": [
        r"what would you do if",
        r"how would you approach",
        r"imagine you",
        r"suppose you",
        r"if you were",
        r"how would you handle",
        r"what if",
        r"let's say",
        r"hypothetically",
    ],
    "competency": [
        r"what are your strengths",
        r"what is your greatest",
        r"how do you prioritize",
        r"how do you manage",
        r"what's your approach to",
        r"how do you stay",
        r"what motivates you",
        r"how do you deal with",
    ],
    "coding": [
        r"write a function",
        r"implement .+ algorithm",
        r"solve this problem",
        r"code a solution",
        r"write code to",
        r"can you code",
        r"leetcode",
        r"hackerrank",
        r"data structure",
        r"reverse .+ string",
        r"find .+ in .+ array",
        r"sort .+ array",
    ],
    "system-design": [
        r"design a system",
        r"how would you design",
        r"architect .+ solution",
        r"scale .+ to",
        r"design .+ like",
        r"build .+ from scratch",
        r"high-level design",
        r"system architecture",
    ],
}

QUESTION_INDICATORS = [
    "what", "why", "how", "when", "where", "who", "which",
    "can you", "could you", "would you", "do you", "did you",
    "tell me", "describe", "explain", "share", "walk me through",
]


class QuestionDetectorService:
    """
    Detects interview questions from transcribed text
    """
    
    def __init__(self):
        self.transcription_buffer = ""
        self.last_question_time = 0
        self.min_question_gap_ms = 5000
        self.detected_questions: List[Dict] = []
    
    def detect_question(self, text: str) -> Optional[Dict[str, Any]]:
        """
        Process new transcription text and detect questions
        """
        # Add to buffer
        self.transcription_buffer = (self.transcription_buffer + " " + text).strip()
        
        # Check if we have a complete sentence
        if not self._is_complete_sentence(self.transcription_buffer):
            return None
        
        # Analyze for question
        question = self._analyze_for_question(self.transcription_buffer)
        
        if question:
            self.detected_questions.append(question)
            self.transcription_buffer = ""
            return question
        
        # Clear buffer if too long
        if len(self.transcription_buffer) > 500:
            self.transcription_buffer = text
        
        return None
    
    def _is_complete_sentence(self, text: str) -> bool:
        """Check if text appears to be complete"""
        text = text.strip()
        
        # Ends with punctuation
        if re.search(r'[.?!]$', text):
            return True
        
        # Long enough and starts with question word
        words = text.split()
        if len(words) >= 8:
            first_word = words[0].lower()
            for indicator in QUESTION_INDICATORS:
                if first_word.startswith(indicator.split()[0]):
                    return True
        
        return False
    
    def _analyze_for_question(self, text: str) -> Optional[Dict[str, Any]]:
        """Analyze text for question patterns"""
        lower_text = text.lower().strip()
        
        # Check if it looks like a question
        if not self._looks_like_question(lower_text):
            return None
        
        # Determine question type
        matched_type = "general"
        highest_confidence = 0.0
        matched_keywords: List[str] = []
        
        for q_type, patterns in QUESTION_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, lower_text, re.IGNORECASE):
                    confidence = self._calculate_confidence(lower_text, pattern)
                    if confidence > highest_confidence:
                        highest_confidence = confidence
                        matched_type = q_type
                        matched_keywords = self._extract_keywords(lower_text, pattern)
        
        # If no specific pattern but looks like question
        if highest_confidence == 0 and self._looks_like_question(lower_text):
            highest_confidence = 0.5
        
        # Minimum threshold
        if highest_confidence < 0.3:
            return None
        
        # Clean and format question
        cleaned_text = self._clean_question_text(text)
        
        return {
            "text": cleaned_text,
            "type": matched_type,
            "confidence": highest_confidence,
            "keywords": matched_keywords,
            "suggested_format": self._get_suggested_format(matched_type),
        }
    
    def _looks_like_question(self, text: str) -> bool:
        """Check if text looks like a question"""
        if "?" in text:
            return True
        
        for indicator in QUESTION_INDICATORS:
            if text.startswith(indicator + " ") or text.startswith(indicator + ","):
                return True
        
        interview_phrases = [
            "tell me about", "walk me through", "describe",
            "explain", "what is your", "how do you", "why do you",
        ]
        
        for phrase in interview_phrases:
            if phrase in text:
                return True
        
        return False
    
    def _calculate_confidence(self, text: str, pattern: str) -> float:
        """Calculate confidence score"""
        confidence = 0.6
        
        if "?" in text:
            confidence += 0.2
        
        question_words = re.findall(
            r'\b(what|how|why|when|where|who|which|tell|describe|explain)\b',
            text, re.IGNORECASE
        )
        if len(question_words) > 1:
            confidence += 0.1
        
        if len(text.split()) < 5:
            confidence -= 0.2
        
        return min(1.0, max(0.0, confidence))
    
    def _extract_keywords(self, text: str, pattern: str) -> List[str]:
        """Extract relevant keywords"""
        keywords = []
        
        # Extract technical terms
        technical_terms = re.findall(
            r'\b(api|database|algorithm|function|class|system|design|performance|security|testing|deployment)\b',
            text, re.IGNORECASE
        )
        keywords.extend([t.lower() for t in technical_terms])
        
        return list(set(keywords))[:5]
    
    def _clean_question_text(self, text: str) -> str:
        """Clean and format question text"""
        cleaned = text.strip()
        
        # Capitalize first letter
        if cleaned:
            cleaned = cleaned[0].upper() + cleaned[1:]
        
        # Ensure ends with punctuation
        if not re.search(r'[.?!]$', cleaned):
            cleaned += "?"
        
        return cleaned
    
    def _get_suggested_format(self, q_type: str) -> str:
        """Get suggested answer format"""
        format_map = {
            "behavioral": "STAR",
            "situational": "STAR",
            "technical": "technical",
            "coding": "technical",
            "system-design": "detailed",
            "competency": "concise",
            "general": "concise",
        }
        return format_map.get(q_type, "concise")
    
    def get_recent_questions(self, count: int = 10) -> List[Dict]:
        """Get recent detected questions"""
        return self.detected_questions[-count:]
    
    def clear_history(self):
        """Clear question history"""
        self.detected_questions = []
        self.transcription_buffer = ""
