# 🦜 RedParrot - AI Interview Copilot

<div align="center">

![RedParrot Logo](./assets/logo.png)

**The Ultimate Free, Stealth AI Interview Assistant**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Electron](https://img.shields.io/badge/Electron-26+-47848F?logo=electron)](https://electronjs.org/)
[![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178C6?logo=typescript)](https://typescriptlang.org/)
[![Groq](https://img.shields.io/badge/Groq-Free%20API-FF6B35)](https://groq.com/)

[Features](#-features) • [Quick Start](#-quick-start) • [Free API Setup](#-free-api-setup) • [Documentation](#-documentation)

</div>

---

## 🎯 What is RedParrot?

RedParrot is a **100% free, open-source** AI-powered interview copilot that helps you ace any interview. It features:

- **Real-time transcription** of interview questions
- **Instant AI-powered answers** tailored to your resume
- **Undetectable stealth overlay** invisible to screen sharing
- **Zero cost** - uses free Groq API (750K tokens/day)

> ⚠️ **Disclaimer**: This tool is intended for interview practice and accessibility. Using it deceptively may violate company policies.

---

## ✨ Features

### 🎤 Real-time Speech Recognition
- **Groq Whisper API** - Free, fast cloud transcription (<1s latency)
- **Whisper.cpp** - Optional local processing for privacy
- Support for **50+ languages** including auto-detection

### 🤖 AI Answer Generation
- **Groq Llama 3.3 70B** - Free, state-of-the-art LLM
- **STAR method** formatting for behavioral questions
- Three answer lengths: Short (30s), Medium (60s), Long (90s)
- Context-aware answers using your resume

### 🕵️ Stealth Mode (Undetectable Overlay)
- **Transparent overlay** excluded from screen capture
- **Auto-hide** when screen sharing is detected
- **Process obfuscation** - appears as "System Helper"
- **No dock/taskbar icon** - completely hidden
- **Click-through regions** for seamless interaction

### 📄 Resume Intelligence
- Parse **PDF, DOCX, TXT** resumes
- Extract skills, experience, education automatically
- Personalized answers based on your background

### 🔌 100% Free APIs
| Service | API | Free Tier |
|---------|-----|-----------|
| Speech-to-Text | Groq Whisper | Unlimited |
| AI Answers | Groq Llama 3.3 70B | 750K tokens/day (~50 interviews) |
| Local Fallback | Ollama | Free (runs locally) |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** and **npm**
- **macOS 11+** or **Windows 10+**
- **Groq API Key** (free at [console.groq.com](https://console.groq.com))

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/redparrot.git
cd redparrot

# Install dependencies
npm install

# Start development
npm run dev
```

### Get Your Free API Key

1. Go to [console.groq.com](https://console.groq.com)
2. Sign up for free (no credit card required)
3. Create an API key
4. Add it in RedParrot Settings

---

## 🔑 Free API Setup

### Groq API (Recommended)
Groq provides incredibly fast inference with a generous free tier:

```
Daily Limit: 750,000 tokens (enough for ~50 interviews)
Models: Whisper Large V3, Llama 3.3 70B Versatile
Latency: ~200ms average
```

1. Create free account at [groq.com](https://console.groq.com)
2. Generate API key
3. Add to RedParrot Settings

### Ollama (Local Fallback)
For offline use or unlimited usage:

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Download Llama 3.2
ollama pull llama3.2

# RedParrot will auto-detect Ollama
```

---

## 📁 Project Structure

```
redparrot/
├── electron/                # Electron main process
│   ├── main.js              # App entry, window management
│   ├── preload.js           # Secure IPC bridge
│   └── stealth/             # Stealth utilities
│       ├── process-hide.js  # Process obfuscation
│       ├── window-exclude.js# Screen capture exclusion
│       └── screen-detect.js # Screen share detection
├── src/                     # React frontend
│   ├── App.tsx              # Main application
│   ├── components/          # React components
│   │   ├── Overlay/         # Stealth overlay window
│   │   ├── Settings/        # Configuration panel
│   │   └── ResumeUpload/    # Resume parser UI
│   ├── services/            # Core services
│   │   ├── audio-capture.ts # Microphone/system audio
│   │   ├── asr-service.ts   # Speech recognition
│   │   ├── question-detector.ts # Question classification
│   │   ├── ai-service.ts    # Answer generation
│   │   ├── resume-parser.ts # Resume extraction
│   │   └── interview-pipeline.ts # Orchestrator
│   └── stores/              # Zustand state management
├── backend/                 # FastAPI backend (optional)
│   ├── main.py              # API routes
│   └── services/            # Python services
├── docker-compose.yml       # Docker configuration
└── package.json             # Project configuration
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘⇧O` / `Ctrl+Shift+O` | Toggle overlay |
| `⌘⇧R` / `Ctrl+Shift+R` | Toggle main window |
| `⌘⇧H` / `Ctrl+Shift+H` | Hide all windows |
| `⌘⇧C` / `Ctrl+Shift+C` | Toggle click-through mode |

---

## 🛡️ Privacy & Security

- **Local-first**: Audio processed locally by default
- **No data storage**: Conversations aren't saved to cloud
- **Encrypted settings**: API keys stored securely
- **Open source**: Full transparency, audit the code

---

## 🔧 Development

### Run in Development
```bash
# Start Vite dev server + Electron
npm run dev

# Start only frontend
npm run dev:web

# Start backend (optional)
cd backend && pip install -r requirements.txt && uvicorn main:app --reload
```

### Build for Production
```bash
# Build and package
npm run build

# Package for distribution
npm run package

# Create installer
npm run make
```

### Docker Deployment
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend
```

---

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

---

## 📋 Roadmap

- [x] Real-time transcription (Groq Whisper)
- [x] AI answer generation (Groq Llama)
- [x] Stealth overlay mode
- [x] Resume parsing
- [x] STAR method formatting
- [ ] Coding interview support (screen OCR)
- [ ] Interview analytics dashboard
- [ ] Multi-language UI
- [ ] Voice output mode
- [ ] Mobile companion app

---

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

```bash
# Fork and clone
git clone https://github.com/yourusername/redparrot.git

# Create feature branch
git checkout -b feature/amazing-feature

# Make changes and commit
git commit -m "Add amazing feature"

# Push and create PR
git push origin feature/amazing-feature
```

---

## 📝 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgements

- [Groq](https://groq.com) - Free, blazing-fast API
- [Electron](https://electronjs.org) - Cross-platform desktop apps
- [React](https://reactjs.org) - UI framework
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [OpenAI Whisper](https://github.com/openai/whisper) - Speech recognition

---

<div align="center">

**Made with ❤️ for interview preparation**

[⬆ Back to top](#-redparrot---ai-interview-copilot)

</div>
