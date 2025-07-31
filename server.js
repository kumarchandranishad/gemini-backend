const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenAI } = require('@google/genai');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// Enhanced CORS Configuration - CRITICAL FIX
app.use(cors({
  origin: [
    'https://ddmalarfun.net',           // Your domain
    'http://localhost:3000',
    'http://localhost:5000',
    '*'                                // Allow all for testing
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Additional CORS headers - BACKUP SOLUTION
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(express.json({ limit: '10mb' }));

// Increase timeout for image generation
app.use((req, res, next) => {
  req.setTimeout(120000); // 2 minutes
  res.setTimeout(120000);
  next();
});

// Initialize Google Gemini AI with error handling
let ai;
try {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }
  
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
  });
  
  console.log('✅ Gemini AI initialized successfully');
  console.log('🔑 API Key length:', process.env.GEMINI_API_KEY?.length || 0);
} catch (error) {
  console.error('❌ Failed to initialize Gemini AI:', error.message);
  process.exit(1);
}

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Gemini Backend - AI Image Generator',
    status: 'Running',
    cors: 'Enabled for ddmalarfun.net',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// Health check endpoint - FIXED
app.get('/health', (req, res) => {
  console.log('🔍 Health check requested from:', req.get('Origin') || 'Unknown');
  res.status(200).json({ 
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    cors: 'Enabled',
    apiKeySet: !!process.env.GEMINI_API_KEY,
    allowedOrigin: 'https://ddmalarfun.net'
  });
});

// Image generation endpoint - COMPLETELY FIXED
app.post('/generate', async (req, res) => {
  const startTime = Date.now();
  const { prompt, style } = req.body;
  
  console.log('📝 Generate request received:', { 
    prompt: prompt?.substring(0, 50) + '...', 
    style,
    origin: req.get('Origin'),
    timestamp: new Date().toISOString()
  });
  
  if (!prompt || prompt.trim() === '') {
    return res.status(400).json({ 
      success: false,
      error: 'Prompt is required and cannot be empty'
    });
  }

  const finalPrompt = style ? `${prompt.trim()}, ${style.trim()}` : prompt.trim();
  
  try {
    console.log('🎨 Calling Gemini API with correct model...');
    
    // Using the correct Gemini API structure
    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash-preview-image-generation", // CORRECT MODEL NAME
      contents: [{ 
        parts: [{ text: finalPrompt }] 
      }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"] // REQUIRED FOR IMAGE GENERATION
      }
    });

    console.log('✅ Gemini API responded successfully');

    // Extract image from response - FIXED STRUCTURE
    if (result.response && result.response.candidates && result.response.candidates[0]) {
      const parts = result.response.candidates[0].content.parts;
      
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          const imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          
          const processingTime = Date.now() - startTime;
          console.log(`🖼️ Image generated successfully in ${processingTime}ms`);
          
          return res.json({
            success: true,
            imageUrl: imageUrl,
            data: [{ url: imageUrl }],
            images: [imageUrl],
            prompt: finalPrompt,
            processingTime: processingTime,
            generated_at: new Date().toISOString()
          });
        }
      }
    }
    
    console.log('❌ No image found in response');
    console.log('📋 Response structure:', JSON.stringify(result.response, null, 2));
    
    res.status(500).json({ 
      success: false,
      error: 'No image generated in response'
    });
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('❌ Generation Error Details:', {
      message: error.message,
      stack: error.stack,
      processingTime
    });
    
    let errorMessage = 'Failed to generate image';
    let statusCode = 500;
    
    if (error.message.includes('401') || error.message.includes('API key')) {
      errorMessage = 'API key error - please check your GEMINI_API_KEY';
      statusCode = 401;
    } else if (error.message.includes('rate limit') || error.message.includes('429')) {
      errorMessage = 'Rate limit exceeded - please try again in a moment';
      statusCode = 429;
    } else if (error.message.includes('quota')) {
      errorMessage = 'API quota exceeded';
      statusCode = 429;
    }
    
    res.status(statusCode).json({ 
      success: false,
      error: errorMessage,
      details: error.message,
      processingTime
    });
  }
});

// Global error handling
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler with detailed logging
app.use('*', (req, res) => {
  console.log('❌ 404 - Route not found:', req.originalUrl, 'Method:', req.method);
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    requestedPath: req.originalUrl,
    method: req.method,
    availableEndpoints: ['/', '/health', '/generate']
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Gemini Backend running on port ${PORT}`);
  console.log(`
