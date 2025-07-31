const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenAI } = require('@google/genai');

dotenv.config();
const app = express(); // ✅ यह line missing थी
const PORT = process.env.PORT || 3000;

// CORS Configuration
app.use(cors({
  origin: [
    'https://ddmalarfun.net',
    'http://localhost:3000',
    '*'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '10mb' }));

// Initialize Google Gemini AI
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

// Health check endpoint
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

// Image generation endpoint
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
    console.log('🎨 Calling Gemini API with correct model and modalities...');
    
    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash-preview-image-generation",
      contents: [{
        parts: [{ text: finalPrompt }]
      }],
      config: {
        responseModalities: ["IMAGE", "TEXT"]
      }
    });

    console.log('✅ Gemini API responded successfully');
    
    // Enhanced response parsing
    console.log('🔍 Analyzing response structure...');
    
    if (result.response && result.response.candidates && result.response.candidates[0]) {
      const candidate = result.response.candidates[0];
      
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData && part.inlineData.data) {
            const imageData = part.inlineData.data;
            const mimeType = part.inlineData.mimeType || 'image/png';
            const imageUrl = `data:${mimeType};base64,${imageData}`;
            
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
    }
    
    console.log('❌ No image found in response');
    res.status(500).json({ 
      success: false,
      error: 'No image generated in response'
    });
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('❌ Generation Error Details:', {
      message: error.message,
      processingTime
    });
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to generate image: ' + error.message,
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

// 404 handler
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
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🎨 Generate endpoint: http://localhost:${PORT}/generate`);
  console.log(`🔑 API Key configured: ${!!process.env.GEMINI_API_KEY ? 'SET' : 'MISSING'}`);
  console.log(`🌐 CORS enabled for: https://ddmalarfun.net`);
  console.log(`🤖 Model: gemini-2.0-flash-preview-image-generation`);
  console.log(`🌟 Environment: ${process.env.NODE_ENV || 'development'}`);
});
