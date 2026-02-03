"""
============================================================================
RedParrot - Resume Parser Service (Python)
Parses PDF and DOCX resumes to extract structured data
============================================================================
"""

import re
from typing import Optional, Dict, List, Any
from io import BytesIO

# Skill keywords for extraction
SKILL_KEYWORDS = [
    # Programming Languages
    "javascript", "typescript", "python", "java", "c++", "c#", "ruby", "go", "rust", "swift",
    "kotlin", "php", "scala", "r", "matlab", "perl", "sql", "html", "css", "sass", "less",
    # Frameworks
    "react", "angular", "vue", "node.js", "express", "django", "flask", "spring", "rails",
    "next.js", "nuxt", "svelte", "jquery", "bootstrap", "tailwind", "material-ui", "redux",
    # Cloud & DevOps
    "aws", "azure", "gcp", "docker", "kubernetes", "terraform", "jenkins", "gitlab", "github",
    "circleci", "ansible", "puppet", "chef", "nginx", "apache", "linux", "unix", "bash",
    # Databases
    "postgresql", "mysql", "mongodb", "redis", "elasticsearch", "cassandra", "dynamodb",
    "oracle", "sqlite", "neo4j", "graphql", "rest", "api",
    # AI/ML
    "machine learning", "deep learning", "tensorflow", "pytorch", "keras", "scikit-learn",
    "nlp", "computer vision", "data science", "pandas", "numpy", "jupyter",
]

EXPERIENCE_HEADERS = [
    "experience", "work experience", "professional experience", "employment history",
    "work history", "career history", "professional background",
]


class ResumeParserService:
    """
    Parses resumes from PDF and DOCX files
    """
    
    def __init__(self):
        self.max_experience_items = 5
        self.max_skills = 30
    
    async def parse_bytes(self, content: bytes, file_type: str) -> Dict[str, Any]:
        """Parse resume from bytes content"""
        if file_type == "pdf":
            text = await self._extract_pdf(content)
        elif file_type in ("docx", "doc"):
            text = await self._extract_docx(content)
        else:
            text = content.decode("utf-8", errors="ignore")
        
        return self.parse_text(text, file_type)
    
    async def _extract_pdf(self, content: bytes) -> str:
        """Extract text from PDF"""
        try:
            import pdfplumber
            
            with pdfplumber.open(BytesIO(content)) as pdf:
                text = ""
                for page in pdf.pages:
                    text += page.extract_text() or ""
                    text += "\n"
            return text
        except ImportError:
            # Fallback: try PyPDF2
            try:
                from PyPDF2 import PdfReader
                reader = PdfReader(BytesIO(content))
                text = ""
                for page in reader.pages:
                    text += page.extract_text() or ""
                return text
            except ImportError:
                return "[PDF parsing requires pdfplumber or PyPDF2]"
    
    async def _extract_docx(self, content: bytes) -> str:
        """Extract text from DOCX"""
        try:
            import docx
            doc = docx.Document(BytesIO(content))
            text = "\n".join([para.text for para in doc.paragraphs])
            return text
        except ImportError:
            return "[DOCX parsing requires python-docx]"
    
    def parse_text(self, raw_text: str, file_type: str = "txt") -> Dict[str, Any]:
        """Parse resume from raw text"""
        normalized = self._normalize_text(raw_text)
        
        name = self._extract_name(normalized)
        title = self._extract_title(normalized)
        summary = self._extract_summary(normalized)
        experience = self._extract_experience(normalized)
        skills = self._extract_skills(normalized)
        education = self._extract_education(normalized)
        projects = self._extract_projects(normalized)
        
        # Calculate confidence
        parse_confidence = self._calculate_confidence({
            "name": name,
            "title": title,
            "experience": experience,
            "skills": skills,
            "education": education,
        })
        
        return {
            "raw_text": raw_text,
            "file_type": file_type,
            "parse_confidence": parse_confidence,
            "name": name,
            "title": title,
            "summary": summary,
            "experience": experience,
            "skills": skills,
            "education": education,
            "projects": projects,
        }
    
    def _normalize_text(self, text: str) -> str:
        """Normalize text for parsing"""
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        text = text.replace("\t", " ")
        text = re.sub(r" +", " ", text)
        text = re.sub(r"\n\s*\n", "\n\n", text)
        return text.strip()
    
    def _extract_name(self, text: str) -> Optional[str]:
        """Extract name from resume"""
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        
        for line in lines[:5]:
            # Skip contact info
            if self._is_contact_info(line):
                continue
            if self._is_section_header(line):
                continue
            
            # Name pattern: 2-4 capitalized words
            if re.match(r'^([A-Z][a-z]+\s+){1,3}[A-Z][a-z]+$', line):
                return line
            
            # Fallback: first short line without special chars
            if 3 < len(line) < 50 and "@" not in line:
                return line
        
        return None
    
    def _extract_title(self, text: str) -> Optional[str]:
        """Extract job title"""
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        
        title_patterns = [
            r"senior|junior|lead|principal|staff|engineer|developer|manager|director|analyst|designer|architect|consultant"
        ]
        
        for line in lines[:10]:
            if 5 < len(line) < 80:
                for pattern in title_patterns:
                    if re.search(pattern, line, re.IGNORECASE) and not self._is_contact_info(line):
                        return line
        
        return None
    
    def _extract_summary(self, text: str) -> Optional[str]:
        """Extract professional summary"""
        headers = ["summary", "professional summary", "about", "profile", "objective"]
        
        for header in headers:
            pattern = rf"(?:{header})[:\s]*([\s\S]*?)(?=\n\n|experience|education|skills|$)"
            match = re.search(pattern, text, re.IGNORECASE)
            
            if match and match.group(1):
                summary = match.group(1).strip()
                if 50 < len(summary) < 1000:
                    return summary
        
        return None
    
    def _extract_experience(self, text: str) -> List[Dict[str, Any]]:
        """Extract work experience"""
        experiences = []
        
        # Find experience section
        pattern = rf"(?:{'|'.join(EXPERIENCE_HEADERS)})[:\s]*([\s\S]*?)(?=\n(?:education|skills|projects|certifications)|$)"
        match = re.search(pattern, text, re.IGNORECASE)
        
        if not match:
            return experiences
        
        exp_section = match.group(1)
        
        # Parse individual experiences
        exp_pattern = r"([A-Z][^•\n]+)\s*[|•\-–]\s*([^•\n]+)\s*[|•\-–]?\s*(\d{4}\s*[-–]\s*(?:\d{4}|present|current))?"
        
        for match in re.finditer(exp_pattern, exp_section, re.IGNORECASE):
            company, role, duration = match.groups()
            
            if company and role and len(experiences) < self.max_experience_items:
                experiences.append({
                    "company": company.strip(),
                    "role": role.strip(),
                    "duration": duration.strip() if duration else "",
                    "highlights": [],
                })
        
        return experiences
    
    def _extract_skills(self, text: str) -> List[str]:
        """Extract skills"""
        skills = set()
        lower_text = text.lower()
        
        # Extract from skills section
        pattern = r"(?:skills|technical skills|technologies)[:\s]*([^\n]+(?:\n[^\n]+)*?)(?=\n\n|experience|education|$)"
        match = re.search(pattern, text, re.IGNORECASE)
        
        if match:
            skills_text = match.group(1)
            items = re.split(r"[,•|;]", skills_text)
            
            for item in items:
                skill = item.strip().lower()
                if 1 < len(skill) < 50:
                    skills.add(skill)
        
        # Scan for known skills
        for skill in SKILL_KEYWORDS:
            if skill.lower() in lower_text:
                skills.add(skill)
        
        return list(skills)[:self.max_skills]
    
    def _extract_education(self, text: str) -> List[Dict[str, Any]]:
        """Extract education"""
        education = []
        
        pattern = r"(?:education|academic)[:\s]*([\s\S]*?)(?=\n\n|experience|skills|$)"
        match = re.search(pattern, text, re.IGNORECASE)
        
        if not match:
            return education
        
        edu_section = match.group(1)
        
        # Look for degree patterns
        degree_pattern = r"(bachelor|master|phd|doctorate|mba|bs|ba|ms|ma|bsc|msc)[^\n]*(?:in|of)?\s*([^\n,]*)"
        
        for match in re.finditer(degree_pattern, edu_section, re.IGNORECASE):
            if len(education) < 3:
                degree, field = match.groups()
                
                # Extract year
                year_match = re.search(r"\b(19|20)\d{2}\b", match.group(0))
                year = year_match.group(0) if year_match else ""
                
                education.append({
                    "institution": "",
                    "degree": f"{degree} {field}".strip(),
                    "year": year,
                })
        
        return education
    
    def _extract_projects(self, text: str) -> List[Dict[str, Any]]:
        """Extract projects"""
        projects = []
        
        pattern = r"(?:projects|personal projects|side projects)[:\s]*([\s\S]*?)(?=\n\n|experience|education|skills|$)"
        match = re.search(pattern, text, re.IGNORECASE)
        
        if not match:
            return projects
        
        project_section = match.group(1)
        lines = [l.strip() for l in project_section.split("\n") if l.strip()]
        
        for line in lines:
            if len(line) < 10 or len(projects) >= 5:
                continue
            
            # Extract project name
            name_match = re.match(r"^[•\-\*]?\s*([^:–-]+)", line)
            if name_match:
                projects.append({
                    "name": name_match.group(1).strip(),
                    "description": line,
                    "technologies": self._extract_technologies(line),
                })
        
        return projects
    
    def _extract_technologies(self, text: str) -> List[str]:
        """Extract technologies from text"""
        technologies = []
        lower_text = text.lower()
        
        for skill in SKILL_KEYWORDS:
            if skill.lower() in lower_text:
                technologies.append(skill)
        
        return technologies[:10]
    
    def _is_contact_info(self, line: str) -> bool:
        """Check if line is contact info"""
        patterns = [
            r"@",  # Email
            r"\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}",  # Phone
            r"linkedin\.com",
            r"github\.com",
            r"http",
        ]
        return any(re.search(p, line, re.IGNORECASE) for p in patterns)
    
    def _is_section_header(self, line: str) -> bool:
        """Check if line is section header"""
        headers = [
            *EXPERIENCE_HEADERS,
            "education", "skills", "projects", "certifications", "awards",
            "summary", "objective", "contact", "references",
        ]
        lower = line.lower().strip()
        return any(lower == h or lower.startswith(h + ":") for h in headers)
    
    def _calculate_confidence(self, data: Dict) -> float:
        """Calculate parsing confidence"""
        score = 0.0
        
        if data.get("name"):
            score += 0.2
        if data.get("title"):
            score += 0.15
        if data.get("experience"):
            score += 0.25
        if data.get("skills"):
            score += 0.2
        if data.get("education"):
            score += 0.2
        
        return min(1.0, score)
