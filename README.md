# 🎓 MAKIA Oracle - AI Professor Backend

An intelligent educational platform featuring AI professors that interact through voice and text, providing personalized learning experiences in English.

## 🌟 Features

- **3 AI Professors** with distinct personalities:
  - **MAKI**: Nerdy, enthusiastic, technical explanations
  - **KUKULCAN**: Relaxed, simple, everyday examples
  - **CHAC**: Strict, formal, academic excellence
- **Voice Interaction**: Speech-to-Text and Text-to-Speech
- **Text Chat**: Real-time AI conversations
- **Sentiment Analysis**: Adaptive responses based on user mood
- **Point System**: Gamified learning experience
- **Session Management**: Temporary in-memory storage
- **English Only**: All responses guaranteed in English

## 📋 Prerequisites

- **Node.js** 16.0.0 or higher
- **npm** or **yarn**
- **OpenAI API Key** (required)
- **Google Cloud Credentials** (optional, for voice features)

## 🚀 Quick Start

### 1. Clone and Install

```bash
# Clone the repository
git clone <your-repo-url>
cd makia-oracle-backend

# Install dependencies
npm install
```

### 2. Environment Setup

Create a `.env` file in the root directory:

```env
# Required - OpenAI API Key
OPENAI_API_KEY=sk-your-openai-api-key-here

# Optional - Google Cloud (for voice features)
GOOGLE_CLOUD_KEY_FILE=./path/to/google-credentials.json

# Server Configuration
PORT=5000
NODE_ENV=development
```

### 3. Run the Server

```bash
# Production
npm start

# Development (with auto-restart)
npm run dev
```

## 🔧 Installation Guide

### Step 1: Dependencies

```bash
npm install express cors multer uuid dotenv
npm install @google-cloud/speech @google-cloud/text-to-speech openai
```

### Step 2: OpenAI Setup

1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create a new API key
3. Add it to your `.env` file as `OPENAI_API_KEY`

### Step 3: Google Cloud Setup (Optional)

> **Note**: Voice features work without Google Cloud, but audio will be disabled.

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable these APIs:
   - Cloud Speech-to-Text API
   - Cloud Text-to-Speech API
4. Create a service account
5. Download the JSON credentials file
6. Update `GOOGLE_CLOUD_KEY_FILE` in `.env`

### Step 4: Directory Structure

The server automatically creates these directories:

```
backend/
├── uploads/          # Temporary audio files
├── public/
│   └── audio/       # Generated audio responses
├── .env             # Environment variables
├── server-minimal.js # Main server file
└── package.json     # Dependencies
```

## 📡 API Endpoints

### Health Check
```http
GET /health
```
**Response:**
```json
{
  "status": "healthy",
  "services": {
    "openai": true,
    "speech": true,
    "tts": true
  },
  "timestamp": "2025-08-10T..."
}
```

### Get Professors
```http
GET /api/professors
```
**Response:**
```json
{
  "success": true,
  "professors": [
    {
      "id": "maki",
      "name": "MAKI",
      "personality": "nerd"
    },
    {
      "id": "kukulcan", 
      "name": "KUKULCAN",
      "personality": "cool"
    },
    {
      "id": "chac",
      "name": "CHAC", 
      "personality": "strict"
    }
  ]
}
```

### Text Interaction
```http
POST /api/text
Content-Type: application/json

{
  "message": "Explain machine learning",
  "professor": "maki",
  "sessionId": "user123"
}
```
**Response:**
```json
{
  "success": true,
  "response": "Machine learning is...",
  "sentiment": "curious",
  "pointsEarned": 25,
  "professor": "MAKI"
}
```

### Voice Interaction
```http
POST /api/voice
Content-Type: multipart/form-data

audio: [audio file]
professor: "maki"
sessionId: "user123"
```
**Response:**
```json
{
  "success": true,
  "transcription": "Hello, explain AI",
  "response": "Artificial Intelligence is...",
  "audioUrl": "/audio/response_123.mp3",
  "sentiment": "curious",
  "pointsEarned": 50,
  "professor": "MAKI"
}
```

## 🧪 Testing

### Test with cURL

**Health Check:**
```bash
curl http://localhost:5000/health
```

**Text Interaction:**
```bash
curl -X POST http://localhost:5000/api/text \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello, explain quantum computing",
    "professor": "maki"
  }'
```

**Get Professors:**
```bash
curl http://localhost:5000/api/professors
```

### Test with JavaScript (Frontend)

```javascript
// Text interaction
const response = await fetch('/api/text', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: 'Explain neural networks',
    professor: 'maki',
    sessionId: 'user123'
  })
});

const data = await response.json();
console.log(data.response); // AI professor response

// Voice interaction
const formData = new FormData();
formData.append('audio', audioBlob);
formData.append('professor', 'kukulcan');
formData.append('sessionId', 'user123');

const voiceResponse = await fetch('/api/voice', {
  method: 'POST',
  body: formData
});

const voiceData = await voiceResponse.json();
console.log(voiceData.transcription); // What user said
console.log(voiceData.response);      // AI response
console.log(voiceData.audioUrl);      // Audio file URL
```

## 🎯 Professor Personalities

### MAKI (Nerdy Professor)
- **Style**: Enthusiastic, technical, detailed
- **Best for**: Complex topics, programming, science
- **Response example**: "Oh wow! Machine learning is absolutely fascinating! Let me break down the mathematical foundations..."

### KUKULCAN (Cool Professor)  
- **Style**: Relaxed, simple, everyday examples
- **Best for**: Basic concepts, analogies, casual learning
- **Response example**: "Hey! Think of machine learning like teaching your brain to recognize patterns, just like how you learned to recognize faces..."

### CHAC (Strict Professor)
- **Style**: Formal, direct, academic
- **Best for**: Structured learning, formal education, discipline
- **Response example**: "Machine learning is a systematic approach to pattern recognition. The fundamental principle involves..."

## 🎮 Point System

| Action | Base Points | Bonus |
|--------|-------------|-------|
| Text message | 25 | +10 (curious), +15 (confused) |
| Voice message | 50 | +15 (curious), +25 (confused) |

**Sentiment Detection:**
- **Curious**: "interesting", "learn", "explain", "what is"
- **Confused**: "confused", "don't understand", "help", "difficult"
- **Neutral**: Default state

## 📁 Project Structure

```
backend/
├── server-minimal.js      # Main server file
├── package.json          # Dependencies and scripts
├── .env                  # Environment variables
├── README.md            # This file
├── uploads/             # Temporary audio uploads
├── public/              # Static files
│   └── audio/          # Generated audio responses
└── node_modules/       # Dependencies
```

## 🔧 Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | ✅ Required | OpenAI API key for AI responses |
| `GOOGLE_CLOUD_KEY_FILE` | ⚠️ Optional | Path to Google Cloud credentials JSON |
| `PORT` | ⚠️ Optional | Server port (default: 5000) |
| `NODE_ENV` | ⚠️ Optional | Environment (development/production) |

### Supported Audio Formats

- **Input**: WAV, MP3, MP4, WebM, OGG
- **Output**: MP3
- **Max file size**: 10MB
- **Encoding**: WebM Opus (recommended)

## 🛠️ Troubleshooting

### Common Issues

#### Error 500 on Voice Requests
**Problem**: Server crashes when processing audio
**Solutions:**
1. Check Google Cloud credentials
2. Verify audio file format
3. Check file size (max 10MB)
4. Ensure proper file permissions

#### "OpenAI API key not found"
**Problem**: Missing or invalid OpenAI API key
**Solutions:**
1. Verify `.env` file exists
2. Check API key format: `sk-...`
3. Ensure API key has credits
4. Restart server after changing `.env`

#### "No speech detected"
**Problem**: Audio file doesn't contain recognizable speech
**Solutions:**
1. Check audio quality
2. Speak clearly and loudly
3. Use supported audio formats
4. Ensure microphone permissions

#### Path-to-regexp errors
**Problem**: Version conflicts with Express dependencies
**Solutions:**
```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### Debug Mode

Enable detailed logging:
```bash
NODE_ENV=development npm start
```

### Logs to Monitor

```bash
# Success indicators
✅ Google Cloud clients initialized
✅ OpenAI initialized  
✅ Voice request completed
✅ Transcribed: "user message"
✅ AI response generated

# Warning indicators  
⚠️ Google Cloud not configured
⚠️ TTS not available
⚠️ Audio generation failed

# Error indicators
❌ OPENAI_API_KEY required
❌ STT Error: ...
❌ Voice error: ...
```

## 🚀 Deployment

### Local Development
```bash
npm run dev  # Auto-restart on changes
```

### Production
```bash
npm start
```

### Docker (Optional)
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

### Environment Specific Settings

**Development:**
- Detailed error messages
- File cleanup every 30 minutes
- Session cleanup every hour

**Production:**
- Generic error messages
- File cleanup every 15 minutes  
- Session cleanup every 30 minutes

## 🔒 Security Notes

- **API Keys**: Never commit `.env` files to version control
- **File Uploads**: Automatic cleanup prevents disk space issues
- **CORS**: Configured for development (adjust for production)
- **Rate Limiting**: Not implemented (add if needed)
- **Authentication**: Not implemented (add if needed)

## 📝 API Response Examples

### Successful Text Response
```json
{
  "success": true,
  "response": "Machine learning is a subset of artificial intelligence that enables computers to learn and improve from experience without being explicitly programmed...",
  "sentiment": "curious",
  "pointsEarned": 35,
  "professor": "MAKI"
}
```

### Successful Voice Response
```json
{
  "success": true,
  "transcription": "Can you explain neural networks?",
  "response": "Neural networks are computing systems inspired by biological neural networks...",
  "audioUrl": "/audio/response_abc123.mp3",
  "sentiment": "curious", 
  "pointsEarned": 65,
  "professor": "MAKI"
}
```

### Error Response
```json
{
  "success": false,
  "error": "No speech detected in audio",
  "details": "The uploaded audio file did not contain recognizable speech"
}
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit pull request

## 📄 License

This project is licensed under the MIT License.

## 📞 Support

- **Documentation**: This README
- **Issues**: Create GitHub issues for bugs
- **Features**: Submit feature requests via GitHub
- **Questions**: Contact development team

---

**Made with ❤️ for educational excellence**

🎓 **MAKIA Oracle** - Where AI meets education
