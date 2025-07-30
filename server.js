const express = require('express');
const cors```require('cors');
const dotenv = require('dotenv');
const { GoogleGenAI, Modality } = require('@google/genai');

dotenv.config```
const app = express();
const PORT = process.env.PORT``` 3000;

// CORS Configuration
app.use(cors({
  origin: ['http://localhost:3000', 'https://your-domain.com', '*'],
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

// Initialize Google Gemini AI
let ai;
try {
  if (!process.env.GEMINI_API```Y) {
    throw new Error('GEMINI_API_``` environment variable is required');
  }
  ai = new GoogleGen```{
    apiKey: process.env.GEMINI_```_KEY
  });
  console.log('✅ Gemini AI initialized successfully');
} catch (error) {
  console```ror('❌ Failed to initialize Gemini AI:', error.```sage);
  process.exit(1);
}

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Nisha```emini AI Image Generator Backend',
    status: 'Running```    endpoints: {
      health: '/health',
      generate:```generate',
      generateMultiple: '/generate-multiple'```  },
    version: '2.0.0'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status```healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process```v.NODE_ENV || 'development```    apiKeySet: !!process.env.GEMINI```I_KEY,
    memoryUsage: process.memoryUsage()
  });
});

// Single```age generation endpoint
app.post('/generate', async (req, res) => {
  const startTime = Date.now();
  const { prompt, style } = req.body;
  
  console```g('📝 Generate request:', { 
    prompt: prompt?.substring(0, 50) + '...', 
    style,
    timestamp```ew Date().toISOString()
  });
  
  // Validation
  if (!prompt || prompt.trim() === '') {
    console```g('❌ No prompt provided');
    return res.status```0).json({ 
      success: false,
      error:```rompt is required and cannot be empty',```    code: 'MISSING_PROMPT'
    });
  }

  const finalPrompt = style ? `${prompt.trim```, ${style.trim()}` : prompt.trim();
  
  try {
    console.log('🎨 Calling```mini API...');
    
    const response = await ai.models```nerateContent({
      model: "gemini-2.0-flash-preview-image-generation",
      contents: finalPrompt,```    config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });

    console.log('✅ Gemini API responded');

    // Extract image from response
    if (response.candidates && response.```didates[0] && response.candidates[0].content) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.```a) {
          const imageData = part.inlineData.data```         const imageUrl = `data:image/png;base64,${imageData}`;
          
          const```ocessingTime = Date.now() - startTime;
          console.log(`🖼️ Image generated successfully in ${processingTime}ms`);
          
          return res.json({
            success: true,```          imageUrl: imageUrl,
            data: [{ url: imageUrl }],
            images:```mageUrl],
            prompt: finalPrompt,
            provider: "Google Gemini API",```          model: "gemini-2.0-flash-preview-image-generation```            processingTime: processingTime,
            generated_at: new Date```toISOString()
          });
        }
      }
    }
    
    console.```('❌ No image found in Gemini response');
    res.status(500).json({ 
      success: false,```    error: 'No image generated in response',
      code: ```_IMAGE_GENERATED'
    });
    
  } catch (error) {
    const```ocessingTime = Date.now() - startTime;
    console.error('❌ Gemini API```ror:', error);
    
    let errorMessage = 'Failed to```nerate image';
    let statusCode = 500;
    let errorCode = 'GENERATION_```LED';
    
    if (error.message.includes('rate limit```|| error.message.includes('429')) {
      errorMessage = ```te limit exceeded. Please try again in a moment.';
      status```e = 429;
      errorCode = 'RATE_```IT';
    } else if (error.message.includes('API key```|| error.message.includes('401')) {
      errorMessage = ```I key configuration error';
      statusCode = 401;
      errorCode = 'INVALID_API_KEY';
    } else if (error.message.includes('quota') || error.message.includes('403')) {
      errorMessage = 'API quota exceeded';
      status```e = 429;
      errorCode = 'QUOTA_```EEDED';
    }
    
    res.status(statusCode).json({ 
      success: false,
      error: errorMessage,```    code: errorCode,
      proces```gTime: processingTime,
      details: process.env.NODE_ENV === ```velopment' ? error.message : undefined
    });
  }
});

// Multiple```age generation endpoint
app.post('/generate-multiple', async (req, res) => {
  const startTime = Date.now();
  const { prompt, style, count = 2 } = req.body;```
  console.log('📝 Multiple generate request:', { 
    prompt: prompt?.substring(0, 50) + '...', 
    style,
    count,
    timestamp: new Date```toISOString()
  });
  
  if (!prompt || prompt.trim() === '') {
    return```s.status(400).json({ 
      success: false,```    error: 'Prompt is required',```    code: 'MISSING_PROMPT'
    });
  }

  const maxCount = ```  const imageCount = Math.min(parseInt```unt), maxCount);
  const images = [];
  const errors = [];

  for (let i = 0; i < imageCount; i++) {
    try {
      const finalPrompt = style ```      ? `${prompt.trim()}, ${style.trim()}, variation ${i + 1}` 
        : `${prompt.trim()}, variation ${i + 1}`;

      console.log(`🎨 Generating image ${i + 1}/${imageCount}...`);
      
      const```sponse = await ai.models.generateContent({
        model: "gem```-2.0-flash-preview-image-generation",
        ```tents: finalPrompt,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      });

      //```tract image
      let imageFound = false;
      for```onst part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data```
          const imageData = part.inlineData.data;```        const imageUrl = `data:image/png;base64,${imageData}`;
          images.push(imageUrl);
          ```geFound = true;
          break;
        }
      }

      if (!imageFound) {
        errors.push(`Image ${i + 1}: No image in response`);
      }

      // Delay between requests to avoid rate limiting
      if``` < imageCount - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

    } catch (error) {
      console.error(`❌ Error generating image ${i + 1}:`, error.```sage);
      errors.push(`Image ${i + 1}: ${error.message}`);
    }
  }

  const processing```e = Date.now() - startTime;
  console.log(`🖼️ Generate```{images.length}/${imageCount} images in ${processingTime}ms`);

  res.json({
    success```mages.length > 0,
    data: images.map(url => ({ url })),
    images: images,
    generated: images.length,
    requeste```imageCount,
    errors: errors.length > 0 ? errors : undefined,```  processingTime: processingTime,
    generate```t: new Date().toISOString()
  });
});

// Global error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error);
  res.status(500).json({
    success: false,
    error```Internal server error',
    code: 'INTERNAL_```OR'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: '```point not found',
    code: 'NOT_FOUND',```  availableEndpoints: ['/', '/health', '/generate', '/generate-multiple']
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.```('\n🛑 Shutting down server grac```lly...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting```wn server gracefully...');
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Nishad Gemini AI Backen```unning on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🎨 Generate endpoint: http://localhost:```ORT}/generate`);
  console.log(`🔑 API Key configured: ${!!process.env.GEMINI_```_KEY}`);
  console.log(`🌟 Environment```{process.env.NODE_ENV || 'development'}`);
});
