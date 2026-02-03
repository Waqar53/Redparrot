# 🦜 RedParrot - AI Interview Copilot

<div align="center">

<img src="./public/logo.jpg" alt="RedParrot Logo" width="150" style="border-radius: 20px;">

### **Ace Any Interview with AI-Powered Real-Time Assistance**

[![Live Demo](https://img.shields.io/badge/🚀_Live_Demo-redparrot--seven.vercel.app-red?style=for-the-badge)](https://redparrot-seven.vercel.app)
[![GitHub](https://img.shields.io/badge/GitHub-Waqar53/Redparrot-black?style=for-the-badge&logo=github)](https://github.com/Waqar53/Redparrot)

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Electron](https://img.shields.io/badge/Electron-28+-47848F?logo=electron)](https://electronjs.org/)
[![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178C6?logo=typescript)](https://typescriptlang.org/)

**🎯 Real-time Question Detection • 🤖 AI-Powered Answers • 🕵️ Stealth Mode • 📄 Resume Intelligence**

[Try Live Demo](https://redparrot-seven.vercel.app) • [Features](#-features) • [How to Use](#-how-to-use) • [Installation](#-installation) • [API Setup](#-free-api-setup)

</div>

---

## 🚀 Try It Now!

### 🌐 **Live Web App**: [https://redparrot-seven.vercel.app](https://redparrot-seven.vercel.app)

> Works instantly in your browser! Add your Groq API key in Settings and start practicing.

---

## 🎯 What is RedParrot?

RedParrot is a **free, open-source AI interview copilot** that helps you ace technical and behavioral interviews:

| Feature | Description |
|---------|-------------|
| 🎤 **Real-time Transcription** | Instantly transcribes interview questions as they're asked |
| 🤖 **AI-Powered Answers** | Generates professional FAANG-level responses in real-time |
| 📄 **Resume Integration** | Tailors answers based on YOUR experience and skills |
| 🕵️ **Stealth Mode** | Desktop app is invisible to screen sharing (proctored interviews) |
| 💰 **100% Free** | Uses Groq's free API (750K tokens/day = ~50 interviews) |

---

## ✨ Features

### 🎤 Real-time Speech Recognition
- **Groq Whisper API** - Ultra-fast cloud transcription (<1 second latency)
- **English-optimized** - Accurate technical terminology recognition
- **Continuous listening** - Automatically detects new questions

### 🤖 AI Answer Generation
- **Groq Llama 3.3 70B** - Free, state-of-the-art responses
- **STAR Method** - Structured behavioral answers (Situation, Task, Action, Result)
- **Code Examples** - Technical questions include syntax-highlighted code
- **Three Lengths** - Short (30s), Medium (60s), Long (90s) speaking time
- **Resume-aware** - Weaves in YOUR projects, skills, and metrics

### 🕵️ Stealth Mode (Desktop App)
```
✅ Invisible to Zoom screen share
✅ Invisible to Google Meet
✅ Invisible to Microsoft Teams
✅ Invisible to proctoring software (ProctorU, Examity, etc.)
✅ Hidden from Alt+Tab / Cmd+Tab
✅ Process disguised as "System Helper"
```

### 📄 Resume Intelligence
- Parse **PDF, DOCX, TXT** formats
- Auto-extract skills, experience, education
- AI incorporates YOUR specific achievements

---

## 📖 How to Use

### Step 1: Open RedParrot
**Web**: Visit [redparrot-seven.vercel.app](https://redparrot-seven.vercel.app)  
**Desktop**: Clone repo and run `npm start`

### Step 2: Add Your API Key
1. Go to **Settings** tab
2. Expand **API Keys** section
3. Paste your free Groq API key
4. Click **Save**

> 🔑 Get free key at [console.groq.com](https://console.groq.com) (no credit card!)

### Step 3: Upload Your Resume (Optional)
1. Go to **Resume** tab
2. Drag & drop your resume (PDF, DOCX, TXT)
3. AI will use your experience for personalized answers

### Step 4: Start Interview
1. Click **Start Interview** button
2. Allow microphone access when prompted
3. Ask or play interview questions
4. Watch as answers appear in real-time!

### Step 5: Use Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `⌘⇧O` | Toggle overlay visibility |
| `⌘⇧H` | **Hide all windows** (panic button!) |
| `⌘⇧C` | Toggle click-through mode |

---

## 🔥 Quick Start

### Web Version (Instant)
Just visit: **[https://redparrot-seven.vercel.app](https://redparrot-seven.vercel.app)**

### Desktop Version (Full Stealth)

```bash
# Clone the repository
git clone https://github.com/Waqar53/Redparrot.git
cd Redparrot

# Install dependencies
npm install

# Start the app
npm start
```

---

## 🔑 Free API Setup

### Groq API (Recommended - FREE!)

Groq provides incredibly fast, free AI:

| Feature | Details |
|---------|---------|
| **Daily Limit** | 750,000 tokens (~50 interviews/day) |
| **Speech Model** | Whisper Large V3 Turbo |
| **AI Model** | Llama 3.3 70B Versatile |
| **Latency** | ~200ms average |
| **Cost** | **$0 forever** |

**Get your key:**
1. Go to [console.groq.com](https://console.groq.com)
2. Sign up (no credit card required!)
3. Click "Create API Key"
4. Copy and paste into RedParrot Settings

### Ollama (Local Fallback)

For offline/unlimited use:
```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Download model
ollama pull llama3.2

# RedParrot auto-detects Ollama at localhost:11434
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript, Tailwind CSS |
| **Desktop** | Electron 28 |
| **State** | Zustand |
| **ASR** | Groq Whisper API |
| **AI** | Groq Llama 3.3 70B |
| **Animations** | Framer Motion |

---

## 📁 Project Structure

```
redparrot/
├── electron/                 # Desktop app (Electron)
│   ├── main.js               # Window management & stealth
│   ├── preload.js            # Secure IPC bridge
│   └── stealth/              # Invisibility features
├── src/                      # React frontend
│   ├── components/           # UI components
│   ├── services/             # Core logic (ASR, AI, Pipeline)
│   └── stores/               # Zustand state
├── public/                   # Static assets
└── package.json              # Dependencies
```

---

## 🔧 Development

```bash
# Development mode (hot reload)
npm run dev

# Build production
npm run build

# Package desktop app
npm run package:mac    # macOS
npm run package:win    # Windows
npm run package:linux  # Linux
```

---

## 🛡️ Privacy & Security

- ✅ **Open Source** - Audit every line of code
- ✅ **Local Processing Option** - Use Ollama for full privacy
- ✅ **No Data Storage** - Nothing saved to external servers
- ✅ **Encrypted Keys** - API keys stored securely locally

---

## ⚠️ Disclaimer

> This tool is designed for **interview practice** and **accessibility purposes**. Using it deceptively in actual interviews may violate company policies. Use responsibly.

---

## 📋 Roadmap

- [x] Real-time transcription
- [x] AI answer generation
- [x] Stealth overlay mode
- [x] Resume parsing
- [x] STAR method formatting
- [x] Code examples for technical questions
- [ ] Screen OCR for coding interviews
- [ ] Interview analytics
- [ ] Voice output mode

---

## 🤝 Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md).

```bash
# Fork, clone, and create feature branch
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

<div align="center">

### 🦜 **[Try RedParrot Now →](https://redparrot-seven.vercel.app)**

**Made with ❤️ for interview success**

⭐ Star this repo if it helped you!

</div>
