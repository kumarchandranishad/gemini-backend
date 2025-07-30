const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenAI, Modality } = require('@google/genai');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// 🎯 CORS Configuration - यहाँ आपका domain add करें
app.use(cors({
  origin: [
    'https://ddmalarfun.net',           // ✅ आपका actual domain
    'http://localhost:3000',           // Local development
    'http://localhost:5000',
    '*'                                // All origins (less secure)
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// 🔧 Additional CORS headers (backup solution)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://ddmalarfun.net');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json({ limit: '10mb' }));

// Rest of your existing code...
let ai;
try {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
  });
  console.log('✅ Gemini AI initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Gemini AI:', error.message);
  process.exit(1);
}

// Your existing endpoints...
app.get('/', (req, res) => {
  res.json({ 
    message: 'Gemini Backend - AI Image Generator',
    status: 'Running',
    cors: 'Enabled for ddmalarfun.net',
    repository: 'gemini-backend',
    version: '2.0.0'
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    cors: 'Enabled',
    allowedOrigin: 'https://ddmalarfun.net'
  });
});

// Your generate endpoints...
app.post('/generate', async (req, res) => {
  // Your existing generation code
});

app.listen(PORT, () => {
  console.log(`🚀 Gemini Backend running on port ${PORT}`);
  console.log(`🌐 CORS enabled for: https://ddmalarfun.net`);
});
