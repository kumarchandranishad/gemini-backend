const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenAI, Modality } = require('@google/genai');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// CORS Configuration - आपका domain added
app.use(cors({
  origin: [
    'https://ddmalarfun.net',           // ✅ आपका domain
    'http://localhost:3000',
    'http://localhost:5000',
    '*'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Additional CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://ddmalarfun.net');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json({ limit: '10mb' }));

// Increase timeout
app.use((req, res, next) => {
  req.setTimeout(120000); // 2 minutes
  res.setTimeout(120000); // 2 minutes
  next();
});

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
    repository: 'gemini-backend',
    cors: 'Enabled for ddmalarfun.net',
    model: 'gemini-2.0-flash-preview-image-generation',
    endpoints: {
      health: '/health',
      generate: '/generate',
      generateMultiple: '/generate-multiple'
    },
    version: '2.0.0'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    apiKeySet: !!process.env.GEMINI_API_KEY,
    model: 'gemini-2.0-flash-preview-image-generation',
    cors: 'Enabled',
    allowedOrigin: 'https://ddmalarfun.net'
  });
});

// Single image generation endpoint - FIXED MODEL
app.post('/generate', async (req, res) => {
  const startTime = Date.now();
  const { prompt, style } = req.body;
  
  console.log('📝 Generate request received:', { 
    prompt: prompt?.substring(0, 50) + '...', 
    style,
    timestamp: new Date().toISOString()
  });
  
  if (!prompt || prompt.trim() === '') {
    console.log('❌ No prompt provided');
    return res.status(400).json({ 
      success: false,
      error: 'Prompt is required and cannot be empty'
    });
  }

  const finalPrompt = style ? `${prompt.trim()}, ${style.trim()}` : prompt.trim();
  console.log('🎯 Final prompt:', finalPrompt.substring(0, 100) + '...');
  
  try {
    console.log('🎨 Calling Gemini API with model: gemini-2.0-flash-preview-image-generation');
    console.log('⏰ Request start time:', new Date().toISOString());
    
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-preview-image-generation", // ✅ CORRECT MODEL NAME
      contents: finalPrompt,
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE], // ✅ REQUIRED FOR IMAGES
      },
    });

    console.log('✅ Gemini API responded successfully');
    console.log('📊 Response received in:', Date.now() - startTime, 'ms');

    // Extract image from response
    if (response.candidates && response.candidates[0] && response.candidates[0].content) {
      console.log('🔍 Checking response parts for image data...');
      
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          const imageData = part.inlineData.data;
          const imageUrl = `data:image/png;base64,${imageData}`;
          
          const processingTime = Date.now() - startTime;
          console.log('🖼️ Image extracted successfully!');
          console.log('📏 Image data size:', imageData.length, 'characters');
          console.log('⏱️ Total processing time:', processingTime, 'ms');
          
          return res.json({
            success: true,
            imageUrl: imageUrl,
            data: [{ url: imageUrl }],
            images: [imageUrl],
            prompt: finalPrompt,
            provider: "Google Gemini API",
            model: "gemini-2.0-flash-preview-image-generation",
            processingTime: processingTime,
            generated_at: new Date().toISOString(),
            repository: 'gemini-backend'
          });
        }
      }
    }
    
    console.log('❌ No image found in Gemini response');
    console.log('📋 Response structure:', JSON.stringify(response.candidates?.[0]?.content?.parts, null, 2));
    
    res.status(500).json({ 
      success: false,
      error: 'No image generated in response',
      details: 'Response received but no image data found'
    });
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('❌ Gemini API Error Details:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      processingTime: processingTime,
      timestamp: new Date().toISOString()
    });
    
    let errorMessage = 'Failed to generate image';
    let statusCode = 500;
    
    if (error.message.includes('rate limit') || error.message.includes('429')) {
      errorMessage = 'Rate limit exceeded. Please try again in a moment.';
      statusCode = 429;
    } else if (error.message.includes('API key') || error.message.includes('401')) {
      errorMessage = 'API key configuration error';
      statusCode = 401;
    } else if (error.message.includes('quota') || error.message.includes('403')) {
      errorMessage = 'API quota exceeded';
      statusCode = 429;
    } else if (error.message.includes('model')) {
      errorMessage = 'Invalid model specified';
      statusCode = 400;
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Request timeout - please try again';
      statusCode = 408;
    }
    
    res.status(statusCode).json({ 
      success: false,
      error: errorMessage,
      details: error.message,
      processingTime: processingTime,
      timestamp: new Date().toISOString()
    });
  }
});

// Multiple image generation endpoint - FIXED MODEL
app.post('/generate-multiple', async (req, res) => {
  const startTime = Date.now();
  const { prompt, style, count = 2 } = req.body;
  
  console.log('📝 Multiple generate request:', { 
    prompt: prompt?.substring(0, 50) + '...', 
    style,
    count,
    timestamp: new Date().toISOString()
  });
  
  if (!prompt || prompt.trim() === '') {
    return res.status(400).json({ 
      success: false,
      error: 'Prompt is required'
    });
  }

  const maxCount = 3;
  const imageCount = Math.min(parseInt(count), maxCount);
  const images = [];
  const errors = [];

  console.log(`🎨 Starting generation of ${imageCount} images...`);

  for (let i = 0; i < imageCount; i++) {
    try {
      const finalPrompt = style 
        ? `${prompt.trim()}, ${style.trim()}, variation ${i + 1}` 
        : `${prompt.trim()}, variation ${i + 1}`;

      console.log(`🎨 Generating image ${i + 1}/${imageCount} with prompt: ${finalPrompt.substring(0, 50)}...`);
      
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-preview-image-generation", // ✅ CORRECT MODEL NAME
        contents: finalPrompt,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE], // ✅ REQUIRED FOR IMAGES
        },
      });

      // Extract image
      let imageFound = false;
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          const imageData = part.inlineData.data;
          const imageUrl = `data:image/png;base64,${imageData}`;
          images.push(imageUrl);
          imageFound = true;
          console.log(`✅ Image ${i + 1} generated successfully`);
          break;
        }
      }

      if (!imageFound) {
        console.log(`❌ Image ${i + 1}: No image in response`);
        errors.push(`Image ${i + 1}: No image in response`);
      }

      // Delay between requests to avoid rate limiting
      if (i < imageCount - 1) {
        console.log(`⏳ Waiting 2 seconds before next generation...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (error) {
      console.error(`❌ Error generating image ${i + 1}:`, error.message);
      errors.push(`Image ${i + 1}: ${error.message}`);
    }
  }

  const processingTime = Date.now() - startTime;
  console.log(`🖼️ Generated ${images.length}/${imageCount} images in ${processingTime}ms`);

  res.json({
    success: images.length > 0,
    data: images.map(url => ({ url })),
    images: images,
    generated: images.length,
    requested: imageCount,
    errors: errors.length > 0 ? errors : undefined,
    processingTime: processingTime,
    generated_at: new Date().toISOString(),
    repository: 'gemini-backend'
  });
});

// Global error handling
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    availableEndpoints: ['/', '/health', '/generate', '/generate-multiple'],
    repository: 'gemini-backend'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Gemini Backend running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🎨 Generate endpoint: http://localhost:${PORT}/generate`);
  console.log(`🔑 API Key configured: ${!!process.env.GEMINI_API_KEY}`);
  console.log(`🌐 CORS enabled for: https://ddmalarfun.net`);
  console.log(`🤖 Model: gemini-2.0-flash-preview-image-generation`);
  console.log(`🌟 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📁 Repository: gemini-backend`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down server gracefully...');
  process.exit(0);
});
