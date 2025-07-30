const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenAI } = require('@google/genai');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// CORS Configuration
app.use(cors({
  origin: ['https://ddmalarfun.net', 'http://localhost:3000', '*'],
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

// Initialize Google Gemini AI
let ai;
try {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is required');
  }
  
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
  });
  
  console.log('✅ Gemini AI initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Gemini AI:', error.message);
  process.exit(1);
}

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Gemini Backend - AI Image Generator',
    status: 'Running',
    repository: 'gemini-backend',
    cors: 'Enabled for ddmalarfun.net',
    version: '2.0.0'
  });
});

// Health check endpoint - CRITICAL FIX
app.get('/health', (req, res) => {
  console.log('🔍 Health check requested');
  res.status(200).json({ 
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    apiKeySet: !!process.env.GEMINI_API_KEY,
    cors: 'Enabled',
    allowedOrigin: 'https://ddmalarfun.net'
  });
});

// Image generation endpoint - FIXED MODEL NAME
app.post('/generate', async (req, res) => {
  const startTime = Date.now();
  const { prompt, style } = req.body;
  
  console.log('📝 Generate request:', { prompt: prompt?.substring(0, 50) + '...', style });
  
  if (!prompt || prompt.trim() === '') {
    return res.status(400).json({ 
      success: false,
      error: 'Prompt is required'
    });
  }

  const finalPrompt = style ? `${prompt.trim()}, ${style.trim()}` : prompt.trim();
  
  try {
    console.log('🎨 Calling Gemini API...');
    
    // Using correct method from official docs
    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash-preview-image-generation",
      contents: [{ 
        parts: [{ text: finalPrompt }] 
      }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"]
      }
    });

    console.log('✅ Gemini API responded');

    // Extract image from response
    if (result.response && result.response.candidates && result.response.candidates[0]) {
      const parts = result.response.candidates[0].content.parts;
      
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          const imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          
          console.log('🖼️ Image generated successfully');
          
          return res.json({
            success: true,
            imageUrl: imageUrl,
            data: [{ url: imageUrl }],
            images: [imageUrl],
            prompt: finalPrompt,
            processingTime: Date.now() - startTime,
            generated_at: new Date().toISOString()
          });
        }
      }
    }
    
    console.log('❌ No image found in response');
    res.status(500).json({ 
      success: false,
      error: 'No image generated'
    });
    
  } catch (error) {
    console.error('❌ Generation Error:', error);
    
    let errorMessage = 'Failed to generate image';
    if (error.message.includes('401')) {
      errorMessage = 'API key error - please check your GEMINI_API_KEY';
    } else if (error.message.includes('rate limit')) {
      errorMessage = 'Rate limit exceeded - please try again later';
    }
    
    res.status(500).json({ 
      success: false,
      error: errorMessage,
      details: error.message
    });
  }
});

// Error handling
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  console.log('❌ 404 - Route not found:', req.originalUrl);
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    requestedPath: req.originalUrl,
    availableEndpoints: ['/', '/health', '/generate']
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Gemini Backend running on port ${PORT}`);
  console.log(`🔗 Health: http://localhost:${PORT}/health`);
  console.log(`🎨 Generate: http://localhost:${PORT}/generate`);
  console.log(`🔑 API Key: ${!!process.env.GEMINI_API_KEY ? 'SET' : 'MISSING'}`);
  console.log(`🌐 CORS: Enabled for ddmalarfun.net`);
});
