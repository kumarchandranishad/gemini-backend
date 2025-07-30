const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenAI, Modality } = require('@google/genai');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'https://your-domain.com', '*'], // Add your Hostinger domain
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Initialize Google Gemini AI
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Gemini AI Image Generator Backend is running!',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Image generation endpoint
app.post('/api/generate', async (req, res) => {
  const { prompt, style } = req.body;
  
  console.log('📝 Received request:', { prompt, style });
  
  if (!prompt || prompt.trim() === '') {
    return res.status(400).json({ 
      success: false,
      error: 'Prompt is required and cannot be empty' 
    });
  }

  // Combine prompt with style
  const finalPrompt = style && style.trim() !== '' 
    ? `${prompt.trim()}, ${style.trim()}` 
    : prompt.trim();
  
  console.log('🎨 Generating image for prompt:', finalPrompt);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-preview-image-generation",
      contents: finalPrompt,
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });

    console.log('✅ Received response from Gemini API');

    // Extract image from response
    if (response.candidates && response.candidates[0] && response.candidates[0].content) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          const imageData = part.inlineData.data;
          const imageUrl = `data:image/png;base64,${imageData}`;
          
          console.log('🖼️ Image generated successfully');
          
          return res.json({
            success: true,
            data: [{ url: imageUrl }],
            images: [imageUrl],
            imageUrl: imageUrl, // For backward compatibility
            prompt: finalPrompt,
            provider: "Google Gemini API",
            model: "gemini-2.0-flash-preview-image-generation",
            generated_at: new Date().toISOString()
          });
        }
      }
    }
    
    console.log('❌ No image found in response');
    res.status(500).json({ 
      success: false,
      error: 'No image generated in response' 
    });
    
  } catch (error) {
    console.error('❌ Gemini API Error:', error);
    
    // Handle specific error types
    if (error.message.includes('rate limit')) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded. Please try again in a moment.',
        code: 'RATE_LIMIT'
      });
    }
    
    if (error.message.includes('API key')) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key configuration',
        code: 'INVALID_API_KEY'
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to generate image: ' + error.message,
      code: 'GENERATION_FAILED'
    });
  }
});

// Multiple image generation endpoint
app.post('/api/generate-multiple', async (req, res) => {
  const { prompt, style, count = 1 } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ 
      success: false,
      error: 'Prompt is required' 
    });
  }

  const maxCount = 3; // Limit to prevent abuse
  const imageCount = Math.min(parseInt(count), maxCount);
  const images = [];
  const errors = [];

  console.log(`🎨 Generating ${imageCount} images for prompt:`, prompt);

  for (let i = 0; i < imageCount; i++) {
    try {
      // Add slight variation to each prompt
      const finalPrompt = style 
        ? `${prompt}, ${style}, variation ${i + 1}` 
        : `${prompt}, variation ${i + 1}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-preview-image-generation",
        contents: finalPrompt,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
      });

      // Extract image
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          const imageData = part.inlineData.data;
          const imageUrl = `data:image/png;base64,${imageData}`;
          images.push(imageUrl);
          break;
        }
      }

      // Small delay between requests to avoid rate limiting
      if (i < imageCount - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

    } catch (error) {
      console.error(`❌ Error generating image ${i + 1}:`, error.message);
      errors.push(`Image ${i + 1}: ${error.message}`);
    }
  }

  res.json({
    success: images.length > 0,
    data: images.map(url => ({ url })),
    images: images,
    generated: images.length,
    requested: imageCount,
    errors: errors.length > 0 ? errors : undefined,
    generated_at: new Date().toISOString()
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    available_endpoints: [
      'GET /',
      'GET /health',
      'POST /api/generate',
      'POST /api/generate-multiple'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Gemini AI Backend running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🎨 Generate endpoint: http://localhost:${PORT}/api/generate`);
  console.log(`🌟 Environment: ${process.env.NODE_ENV || 'development'}`);
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
