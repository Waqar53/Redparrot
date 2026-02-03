"""
============================================================================
RedParrot - FastAPI Backend Server
Main entry point with all routes
============================================================================
"""

from fastapi import FastAPI, HTTPException, Depends, File, UploadFile, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import uuid
import os
import jwt
from passlib.context import CryptContext

# ============================================================================
# App Configuration
# ============================================================================

app = FastAPI(
    title="RedParrot API",
    description="AI-Powered Interview Copilot Backend",
    version="1.0.0",
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify allowed origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
SECRET_KEY = os.getenv("SECRET_KEY", "redparrot-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

# ============================================================================
# Pydantic Models
# ============================================================================

class UserCreate(BaseModel):
    email: str
    password: str
    name: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    created_at: datetime
    credits: int = 100

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class TranscriptionRequest(BaseModel):
    audio_base64: str
    language: str = "auto"
    format: str = "wav"

class TranscriptionResponse(BaseModel):
    text: str
    language: str
    confidence: float
    duration: float

class QuestionDetectionRequest(BaseModel):
    text: str
    context: Optional[str] = None

class DetectedQuestion(BaseModel):
    text: str
    type: str
    confidence: float
    keywords: List[str]
    suggested_format: str

class AnswerGenerationRequest(BaseModel):
    question: str
    question_type: str
    length: str = "medium"  # short, medium, long
    resume_context: Optional[Dict[str, Any]] = None
    job_description: Optional[str] = None
    company_name: Optional[str] = None

class GeneratedAnswer(BaseModel):
    text: str
    length: str
    estimated_duration: int
    format: str

class ResumeParseRequest(BaseModel):
    content: str  # Base64 encoded file content
    file_type: str  # pdf, docx, txt

class ParsedResume(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    summary: Optional[str] = None
    experience: List[Dict[str, Any]] = []
    skills: List[str] = []
    education: List[Dict[str, Any]] = []
    projects: List[Dict[str, Any]] = []
    parse_confidence: float

class SessionCreate(BaseModel):
    company_name: Optional[str] = None
    job_title: Optional[str] = None

class SessionResponse(BaseModel):
    id: str
    user_id: str
    company_name: Optional[str] = None
    job_title: Optional[str] = None
    started_at: datetime
    ended_at: Optional[datetime] = None
    questions_count: int = 0

class QuestionAnswerPair(BaseModel):
    question: str
    question_type: str
    answer: str
    answer_length: str
    timestamp: datetime

# ============================================================================
# In-Memory Storage (Replace with PostgreSQL in production)
# ============================================================================

users_db: Dict[str, Dict] = {}
sessions_db: Dict[str, Dict] = {}
qa_history_db: Dict[str, List[Dict]] = {}

# ============================================================================
# Authentication Helpers
# ============================================================================

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme)) -> Dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None or user_id not in users_db:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        return users_db[user_id]
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid credentials")

# ============================================================================
# Routes: Health Check
# ============================================================================

@app.get("/")
async def root():
    return {"status": "ok", "message": "RedParrot API v1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

# ============================================================================
# Routes: Authentication
# ============================================================================

@app.post("/api/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    # Check if user exists
    for user in users_db.values():
        if user["email"] == user_data.email:
            raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": user_data.email,
        "password_hash": get_password_hash(user_data.password),
        "name": user_data.name,
        "created_at": datetime.utcnow(),
        "credits": 100,  # Free credits
    }
    users_db[user_id] = user
    
    # Generate token
    access_token = create_access_token(
        data={"sub": user_id},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    return Token(
        access_token=access_token,
        user=UserResponse(
            id=user_id,
            email=user["email"],
            name=user["name"],
            created_at=user["created_at"],
            credits=user["credits"],
        )
    )

@app.post("/api/auth/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    # Find user
    user = None
    for u in users_db.values():
        if u["email"] == form_data.username:
            user = u
            break
    
    if not user or not verify_password(form_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Generate token
    access_token = create_access_token(
        data={"sub": user["id"]},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    return Token(
        access_token=access_token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            created_at=user["created_at"],
            credits=user["credits"],
        )
    )

@app.get("/api/auth/me", response_model=UserResponse)
async def get_me(current_user: Dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        name=current_user["name"],
        created_at=current_user["created_at"],
        credits=current_user["credits"],
    )

# ============================================================================
# Routes: Transcription
# ============================================================================

@app.post("/api/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(
    request: TranscriptionRequest,
    current_user: Dict = Depends(get_current_user)
):
    """
    Transcribe audio using Groq Whisper API
    This endpoint is optional - the Electron app can call Groq directly
    """
    import base64
    import httpx
    
    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not configured")
    
    try:
        # Decode audio
        audio_data = base64.b64decode(request.audio_base64)
        
        # Call Groq Whisper API
        async with httpx.AsyncClient() as client:
            files = {"file": ("audio.wav", audio_data, "audio/wav")}
            data = {"model": "whisper-large-v3"}
            
            if request.language != "auto":
                data["language"] = request.language
            
            response = await client.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {groq_api_key}"},
                files=files,
                data=data,
                timeout=30.0
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=500, detail=f"Groq API error: {response.text}")
            
            result = response.json()
            
            # Deduct credits
            users_db[current_user["id"]]["credits"] -= 1
            
            return TranscriptionResponse(
                text=result.get("text", ""),
                language=result.get("language", "unknown"),
                confidence=1.0,
                duration=len(audio_data) / 32000  # Approximate
            )
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# Routes: Question Detection
# ============================================================================

@app.post("/api/detect-question", response_model=Optional[DetectedQuestion])
async def detect_question(
    request: QuestionDetectionRequest,
    current_user: Dict = Depends(get_current_user)
):
    """
    Detect if text contains an interview question
    """
    from services.question_detector import QuestionDetectorService
    
    detector = QuestionDetectorService()
    result = detector.detect_question(request.text)
    
    if result:
        return DetectedQuestion(
            text=result["text"],
            type=result["type"],
            confidence=result["confidence"],
            keywords=result["keywords"],
            suggested_format=result["suggested_format"]
        )
    
    return None

# ============================================================================
# Routes: Answer Generation
# ============================================================================

@app.post("/api/generate-answer", response_model=GeneratedAnswer)
async def generate_answer(
    request: AnswerGenerationRequest,
    current_user: Dict = Depends(get_current_user)
):
    """
    Generate answer using Groq Llama 3.3 70B
    """
    import httpx
    
    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY not configured")
    
    # Build prompt
    length_config = {
        "short": {"words": 75, "duration": 30},
        "medium": {"words": 150, "duration": 60},
        "long": {"words": 225, "duration": 90}
    }
    
    config = length_config.get(request.length, length_config["medium"])
    
    prompt = f"""You are an expert interview coach helping a candidate answer interview questions.

Generate a {request.length} answer (approximately {config['words']} words, {config['duration']} seconds of speaking).
Sound natural and conversational. Use first person. Include specific examples.

Question Type: {request.question_type}
Question: {request.question}
"""

    if request.resume_context:
        prompt += f"\nCandidate Background:\n{request.resume_context}"
    
    if request.job_description:
        prompt += f"\nJob Context:\n{request.job_description}"
    
    if request.company_name:
        prompt += f"\nCompany: {request.company_name}"
    
    prompt += "\n\nGenerate the answer now. Start directly with the response."
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {groq_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.7,
                    "max_tokens": 1024
                },
                timeout=60.0
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=500, detail=f"Groq API error: {response.text}")
            
            result = response.json()
            answer_text = result["choices"][0]["message"]["content"]
            
            # Deduct credits
            users_db[current_user["id"]]["credits"] -= 2
            
            return GeneratedAnswer(
                text=answer_text.strip(),
                length=request.length,
                estimated_duration=config["duration"],
                format="STAR" if request.question_type == "behavioral" else "technical"
            )
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# Routes: Resume Parsing
# ============================================================================

@app.post("/api/parse-resume", response_model=ParsedResume)
async def parse_resume(
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """
    Parse uploaded resume file
    """
    from services.resume_parser import ResumeParserService
    
    # Read file
    content = await file.read()
    
    # Determine file type
    file_type = "txt"
    if file.filename.endswith(".pdf"):
        file_type = "pdf"
    elif file.filename.endswith((".docx", ".doc")):
        file_type = "docx"
    
    # Parse
    parser = ResumeParserService()
    
    try:
        result = await parser.parse_bytes(content, file_type)
        return ParsedResume(**result)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse resume: {str(e)}")

# ============================================================================
# Routes: Interview Sessions
# ============================================================================

@app.post("/api/sessions", response_model=SessionResponse)
async def create_session(
    session_data: SessionCreate,
    current_user: Dict = Depends(get_current_user)
):
    """Create a new interview session"""
    session_id = str(uuid.uuid4())
    session = {
        "id": session_id,
        "user_id": current_user["id"],
        "company_name": session_data.company_name,
        "job_title": session_data.job_title,
        "started_at": datetime.utcnow(),
        "ended_at": None,
        "questions_count": 0
    }
    sessions_db[session_id] = session
    qa_history_db[session_id] = []
    
    return SessionResponse(**session)

@app.get("/api/sessions", response_model=List[SessionResponse])
async def get_sessions(current_user: Dict = Depends(get_current_user)):
    """Get all sessions for current user"""
    user_sessions = [
        SessionResponse(**s) 
        for s in sessions_db.values() 
        if s["user_id"] == current_user["id"]
    ]
    return sorted(user_sessions, key=lambda x: x.started_at, reverse=True)

@app.get("/api/sessions/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get session by ID"""
    if session_id not in sessions_db:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions_db[session_id]
    if session["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return SessionResponse(**session)

@app.post("/api/sessions/{session_id}/end", response_model=SessionResponse)
async def end_session(
    session_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """End an interview session"""
    if session_id not in sessions_db:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions_db[session_id]
    if session["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    session["ended_at"] = datetime.utcnow()
    session["questions_count"] = len(qa_history_db.get(session_id, []))
    
    return SessionResponse(**session)

@app.post("/api/sessions/{session_id}/qa")
async def add_qa_pair(
    session_id: str,
    qa_pair: QuestionAnswerPair,
    current_user: Dict = Depends(get_current_user)
):
    """Add a question-answer pair to session"""
    if session_id not in sessions_db:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions_db[session_id]
    if session["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if session_id not in qa_history_db:
        qa_history_db[session_id] = []
    
    qa_history_db[session_id].append(qa_pair.dict())
    
    return {"status": "ok", "count": len(qa_history_db[session_id])}

@app.get("/api/sessions/{session_id}/qa", response_model=List[QuestionAnswerPair])
async def get_qa_history(
    session_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Get Q&A history for session"""
    if session_id not in sessions_db:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions_db[session_id]
    if session["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return qa_history_db.get(session_id, [])

# ============================================================================
# Routes: User Credits
# ============================================================================

@app.get("/api/credits")
async def get_credits(current_user: Dict = Depends(get_current_user)):
    """Get remaining credits"""
    return {"credits": current_user["credits"]}

# ============================================================================
# Run Server
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
