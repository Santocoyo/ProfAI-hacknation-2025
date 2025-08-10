// server-minimal.js - MAKIA Oracle Minimum Backend (English Only)
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const speech = require('@google-cloud/speech');
const TextToSpeechAPI = require('@google-cloud/text-to-speech');
const OpenAI = require('openai');

// Load environment variables
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Multer configuration for uploads
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/webm'];
    cb(null, allowedTypes.includes(file.mimetype));
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Initialize API clients
const speechClient = new speech.SpeechClient({
  keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE,
});

const ttsClient = new TextToSpeechAPI.TextToSpeechClient({
  keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE,
});

// ✅ API key from environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Check that environment variables are set
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ ERROR: OPENAI_API_KEY is not set in .env');
  process.exit(1);
}

if (!process.env.GOOGLE_CLOUD_KEY_FILE) {
  console.error('❌ ERROR: GOOGLE_CLOUD_KEY_FILE is not set in .env');
  process.exit(1);
}

// Temporary memory
let sessionData = new Map();

// Professors configuration (ENGLISH ONLY)
const professors = {
  maki: {
    name: 'MAKI',
    systemPrompt: 'You are MAKI, an AI professor with a nerdy personality. You explain technical concepts in a detailed and enthusiastic way. You always respond in English.',
    voice: { languageCode: 'en-US', name: 'en-US-Neural2-B', ssmlGender: 'MALE' },
  },
  kukulcan: {
    name: 'KUKULCAN',
    systemPrompt: 'You are KUKULCAN, a relaxed professor. You explain concepts in a simple and accessible way, using everyday examples. You always respond in English.',
    voice: { languageCode: 'en-US', name: 'en-US-Neural2-C', ssmlGender: 'MALE' },
  },
  chac: {
    name: 'CHAC',
    systemPrompt: 'You are CHAC, a strict and academic professor. You are direct, formal, and focused on excellence. You always respond in formal English.',
    voice: { languageCode: 'en-US', name: 'en-US-Neural2-D', ssmlGender: 'MALE' },
  },
};

// Helper functions
function analyzeSentiment(text) {
  const confusedWords = ['confused', "don't understand", 'help', 'difficult'];
  const curiousWords = ['interesting', 'learn', 'explain', 'what is'];
  
  const lowerText = text.toLowerCase();
  const hasConfusedWords = confusedWords.some(word => lowerText.includes(word));
  const hasCuriousWords = curiousWords.some(word => lowerText.includes(word));
  
  if (hasConfusedWords) return 'confused';
  if (hasCuriousWords) return 'curious';
  return 'neutral';
}

async function speechToText(audioFilePath) {
  try {
    const audioBytes = fs.readFileSync(audioFilePath).toString('base64');
    
    const request = {
      audio: { content: audioBytes },
      config: {
        encoding: 'WEBM_OPUS',
        sampleRateHertz: 48000,
        languageCode: 'en-US',
        alternativeLanguageCodes: ['es-ES', 'en-US'],
        enableAutomaticPunctuation: true,
      },
    };

    const [response] = await speechClient.recognize(request);
    return response.results
      .map(result => result.alternatives[0].transcript)
      .join('\n');
  } catch (error) {
    console.error('STT Error:', error);
    throw new Error('Could not process audio');
  }
}

async function generateAIResponse(userMessage, professor, sentiment) {
  try {
    const professorConfig = professors[professor];
    let contextPrompt = professorConfig.systemPrompt;
    
    if (sentiment === 'confused') {
      contextPrompt += '\n\nThe user is confused. Please explain very clearly step by step.';
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: contextPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('AI Error:', error);
    return 'Sorry, there was an error processing your request.';
  }
}

async function textToSpeech(text, professor) {
  try {
    const professorVoice = professors[professor].voice;
    
    const request = {
      input: { text: text },
      voice: professorVoice,
      audioConfig: { audioEncoding: 'MP3' },
    };

    const [response] = await ttsClient.synthesizeSpeech(request);

    const audioFileName = `response_${uuidv4()}.mp3`;
    const audioFilePath = path.join('public', 'audio', audioFileName);

    const audioDir = path.dirname(audioFilePath);
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }
    
    fs.writeFileSync(audioFilePath, response.audioContent, 'binary');
    return `/audio/${audioFileName}`;
  } catch (error) {
    console.error('TTS Error:', error);
    throw new Error('Could not generate audio');
  }
}

// API routes
app.post('/api/voice', upload.single('audio'), async (req, res) => {
  try {
    const { professor = 'maki', sessionId } = req.body;
    const audioFile = req.file;
    
    if (!audioFile) {
      return res.status(400).json({ error: 'No audio file received' });
    }

    console.log('Processing audio...');
    
    const transcribedText = await speechToText(audioFile.path);
    if (!transcribedText.trim()) {
      return res.status(400).json({ error: 'No voice detected' });
    }

    const sentiment = analyzeSentiment(transcribedText);
    const aiResponse = await generateAIResponse(transcribedText, professor, sentiment);
    const audioUrl = await textToSpeech(aiResponse, professor);
    
    const basePoints = 50;
    const sentimentBonus = sentiment === 'confused' ? 25 : 0;
    const totalPoints = basePoints + sentimentBonus;
    
    if (sessionId) {
      if (!sessionData.has(sessionId)) {
        sessionData.set(sessionId, {
          messages: [],
          totalPoints: 0,
          professor,
        });
      }
      
      const session = sessionData.get(sessionId);
      session.messages.push({
        user: transcribedText,
        bot: aiResponse,
        timestamp: new Date(),
        points: totalPoints,
      });
      session.totalPoints += totalPoints;
    }
    
    fs.unlinkSync(audioFile.path);

    res.json({
      success: true,
      transcription: transcribedText,
      response: aiResponse,
      audioUrl,
      sentiment,
      pointsEarned: totalPoints,
      professor: professors[professor].name,
    });

  } catch (error) {
    console.error('Error processing voice:', error);
    res.status(500).json({
      error: 'Error processing audio',
      details: error.message,
    });
  }
});

app.post('/api/text', async (req, res) => {
  try {
    const { message, professor = 'maki', sessionId } = req.body;
    
    if (!message?.trim()) {
      return res.status(400).json({ error: 'Empty message' });
    }

    const sentiment = analyzeSentiment(message);
    const aiResponse = await generateAIResponse(message, professor, sentiment);
    const totalPoints = 25;
    
    if (sessionId) {
      if (!sessionData.has(sessionId)) {
        sessionData.set(sessionId, {
          messages: [],
          totalPoints: 0,
          professor,
        });
      }
      
      const session = sessionData.get(sessionId);
      session.messages.push({
        user: message,
        bot: aiResponse,
        timestamp: new Date(),
        points: totalPoints,
      });
      session.totalPoints += totalPoints;
    }

    res.json({
      success: true,
      response: aiResponse,
      sentiment,
      pointsEarned: totalPoints,
      professor: professors[professor].name,
    });

  } catch (error) {
    console.error('Error processing text:', error);
    res.status(500).json({
      error: 'Error processing message',
      details: error.message,
    });
  }
});

app.get('/api/professors', (req, res) => {
  const professorList = Object.keys(professors).map(key => ({
    id: key,
    name: professors[key].name,
    personality: key === 'maki' ? 'nerd' : key === 'kukulcan' ? 'cool' : 'strict'
  }));
  
  res.json({ professors: professorList });
});

// Clean up memory every hour
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [sessionId, session] of sessionData.entries()) {
    const lastMessage = session.messages[session.messages.length - 1];
    if (lastMessage && new Date(lastMessage.timestamp).getTime() < oneHourAgo) {
      sessionData.delete(sessionId);
      console.log(`Session ${sessionId} cleared from memory`);
    }
  }
}, 60 * 60 * 1000);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 MAKIA Oracle MINIMAL running on port ${PORT}`);
  console.log(`🎤 Voice APIs configured`);
  console.log(
    `🤖 OpenAI integrated with API key: ${
      process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing'
    }`
  );
  console.log(`💾 NO database - temporary in-memory storage only`);
  console.log(`📊 Data is deleted every hour or on restart`);
});

module.exports = app;
