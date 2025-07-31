const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenAI } = require('@google/genai');

dotenv.config();
const app = express();
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

// 🎯 STEP 3: API Keys Array Setup
const API_KEYS = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
  process.env.GEMINI_API_KEY_5,
  process.env.GEMINI_API_KEY_6,
  process.env.GEMINI_API_KEY_7,
  process.env.GEMINI_API_KEY_8,
  process.env.GEMINI_API_KEY_9,
  process.env.GEMINI_API_KEY_10
].filter(key => key); // Remove undefined keys

// 🎯 STEP 4: Smart API Key Rotator Class
class APIKeyRotator {
  constructor(apiKeys) {
    this.apiKeys = apiKeys;
    this.currentIndex = 0;
    this.keyHealth = apiKeys.map((key, index) => ({
      key: key,
      index: index,
      isHealthy: true,
      usageCount: 0,
      lastUsed: null,
      errorCount: 0,
      cooldownUntil: null
    }));
  }

  getNextAvailableKey() {
    const now = Date.now();
    let attempts = 0;
    const startIndex = this.currentIndex;
    
    while (attempts < this.apiKeys.length) {
      const keyInfo = this.keyHealth[this.currentIndex];
      
      // Check if key is available
      if (keyInfo.isHealthy && 
          keyInfo.usageCount < 95 && 
          (!keyInfo.cooldownUntil || keyInfo.cooldownUntil < now)) {
        
        // Update usage
        keyInfo.usageCount++;
        keyInfo.lastUsed = now;
        
        const selectedKey = {
          key: keyInfo.key,
          index: this.currentIndex
        };
        
        // Move to next key for next request
        this.currentIndex = (this.currentIndex + 1) % this.apiKeys.length;
        
        return selectedKey;
      }
      
      // Try next key
      this.currentIndex = (this.currentIndex + 1) % this.apiKeys.length;
      attempts++;
      
      // Prevent infinite loop
      if (this.currentIndex === startIndex && attempts > 0) {
        break;
      }
    }
    
    return null; // All keys exhausted
  }

  markKeyExhausted(keyIndex, cooldownMinutes = 60) {
    if (keyIndex >= 0 && keyIndex < this.keyHealth.length) {
      this.keyHealth[keyIndex].isHealthy = false;
      this.keyHealth[keyIndex].cooldownUntil = Date.now() + (cooldownMinutes * 60 * 1000);
      this.keyHealth[keyIndex].errorCount++;
      
      console.log(`🚫 Key ${keyIndex + 1} marked as exhausted (cooldown: ${cooldownMinutes}min)`);
    }
  }

  resetAllKeys() {
    this.keyHealth.forEach(keyInfo => {
      keyInfo.isHealthy = true;
      keyInfo.usageCount = 0;
      keyInfo.cooldownUntil = null;
      keyInfo.errorCount = 0;
    });
    console.log('🔄 All API keys reset for new day');
  }

  getStatus() {
    const now = Date.now();
    const healthyKeys = this.keyHealth.filter(k => 
      k.isHealthy && (!k.cooldownUntil || k.cooldownUntil < now)
    ).length;
    
    const totalUsage = this.keyHealth.reduce((sum, k) => sum + k.usageCount, 0);
    const totalCapacity = this.apiKeys.length * 95;
    const remainingCapacity = totalCapacity - totalUsage;
    
    return {
      totalKeys: this.apiKeys.length,
      healthyKeys: healthyKeys,
      totalUsage: totalUsage,
      remainingCapacity: remainingCapacity,
      capacityPercentage: Math.round((remainingCapacity / totalCapacity) * 100)
    };
  }
}

// 🎯 STEP 5: Initialize Rotator
const keyRotator = new APIKeyRotator(API_KEYS);
console.log(`✅ Initialized with ${API_KEYS.length} API keys`);

// 🎯 STEP 6: Enhanced Generation Function with Auto-Failover
async function generateWithAutoFailover(prompt, style, maxAttempts = 3) {
  let attempt = 0;
  
  while (attempt < maxAttempts) {
    const keySelection = keyRotator.getNextAvailableKey();
    
    if (!keySelection) {
      throw new Error('All API keys exhausted. Please try again tomorrow at 1:30 PM IST.');
    }
    
    try {
      console.log(`🔑 Attempt ${attempt + 1}: Using key ${keySelection.index + 1}/${API_KEYS.length}`);
      
      const ai = new GoogleGenAI({ apiKey: keySelection.key });
      
      const result = await ai.models.generateContent({
        model: "gemini-2.0-flash-preview-image-generation",
        contents: [{
          parts: [{ text: prompt }]
        }],
        config: {
          responseModalities: ["IMAGE", "TEXT"]
        }
      });
      
      console.log(`✅ Success with key ${keySelection.index + 1}`);
      return { result, keyIndex: keySelection.index };
      
    } catch (error) {
      console.error(`❌ Key ${keySelection.index + 1} failed:`, error.message);
      
      if (error.message.includes('429') || 
          error.message.includes('quota') || 
          error.message.includes('RESOURCE_EXHAUSTED')) {
        
        // Mark key as exhausted
        keyRotator.markKeyExhausted(keySelection.index);
        console.log(`🔄 Switching to next available key...`);
        
        attempt++;
        
        // Add progressive delay
        if (attempt < maxAttempts) {
          const delay = attempt * 1000; // 1s, 2s, 3s delays
          console.log(`⏳ Waiting ${delay}ms before next attempt...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } else {
        // Non-quota error, still try next key
        attempt++;
      }
    }
  }
  
  throw new Error(`Image generation failed after ${maxAttempts} attempts with different keys`);
}

// Root endpoint
app.get('/', (req, res) => {
  const status = keyRotator.getStatus();
  
  res.json({ 
    message: 'Gemini Backend - Multi-Key AI Image Generator',
    status: 'Running',
    keyInfo: {
      totalKeys: status.totalKeys,
      healthyKeys: status.healthyKeys,
      remainingCapacity: status.remainingCapacity,
      capacityPercentage: status.capacityPercentage + '%'
    },
    cors: 'Enabled for ddmalarfun.net',
    timestamp: new Date().toISOString(),
    version: '3.0.0 - Multi-Key Support'
  });
});

// Enhanced health check
app.get('/health', (req, res) => {
  console.log('🔍 Health check requested from:', req.get('Origin') || 'Unknown');
  
  const status = keyRotator.getStatus();
  
  res.status(200).json({ 
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    multiKeyStatus: {
      totalKeys: status.totalKeys,
      healthyKeys: status.healthyKeys,
      totalUsage: status.totalUsage,
      remainingCapacity: status.remainingCapacity,
      capacityPercentage: status.capacityPercentage + '%'
    },
    cors: 'Enabled',
    allowedOrigin: 'https://ddmalarfun.net'
  });
});

// 🎯 STEP 7: Enhanced Single Image Generation
app.post('/generate', async (req, res) => {
  const startTime = Date.now();
  const { prompt, style } = req.body;
  
  console.log('📝 Single image request:', { 
    prompt: prompt?.substring(0, 50) + '...', 
    style,
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
    const { result, keyIndex } = await generateWithAutoFailover(finalPrompt, style);
    
    // Extract image from response
    let imageUrl = null;
    
    if (result.candidates && result.candidates.length > 0) {
      const candidate = result.candidates[0];
      
      if (candidate.content && candidate.content.parts) {
        for (let i = 0; i < candidate.content.parts.length; i++) {
          const part = candidate.content.parts[i];
          
          if (part.inlineData && part.inlineData.data) {
            const mimeType = part.inlineData.mimeType || 'image/png';
            imageUrl = `data:${mimeType};base64,${part.inlineData.data}`;
            console.log(`🖼️ Image extracted successfully using key ${keyIndex + 1}`);
            break;
          }
        }
      }
    }

    if (imageUrl) {
      const processingTime = Date.now() - startTime;
      const status = keyRotator.getStatus();
      
      return res.json({
        success: true,
        imageUrl: imageUrl,
        data: [{ url: imageUrl }],
        images: [imageUrl],
        prompt: finalPrompt,
        processingTime: processingTime,
        generated_at: new Date().toISOString(),
        keyInfo: {
          usedKey: keyIndex + 1,
          totalKeys: status.totalKeys,
          remainingCapacity: status.remainingCapacity
        }
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'No image generated in response'
    });
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('❌ Single image generation failed:', error.message);
    
    const status = keyRotator.getStatus();
    res.status(500).json({ 
      success: false,
      error: error.message,
      processingTime,
      keyStatus: status
    });
  }
});

// 🎯 STEP 8: Enhanced Multiple Image Generation
app.post('/generate-multiple', async (req, res) => {
  const startTime = Date.now();
  const { prompt, style, count = 2 } = req.body;
  
  console.log('📝 Multiple images request:', { 
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
  const usedKeys = [];

  console.log(`🎨 Starting generation of ${imageCount} images with multi-key system...`);

  for (let i = 0; i < imageCount; i++) {
    try {
      const variations = [
        'high quality, detailed',
        'artistic style, creative',
        'unique perspective, beautiful'
      ];
      
      const variation = variations[i] || `creative variation ${i + 1}`;
      const finalPrompt = style 
        ? `${prompt.trim()}, ${style.trim()}, ${variation}` 
        : `${prompt.trim()}, ${variation}`;

      console.log(`🎨 Generating image ${i + 1}/${imageCount}...`);
      
      // Add delay between requests
      if (i > 0) {
        console.log(`⏳ Waiting 3 seconds before generating image ${i + 1}...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      const { result, keyIndex } = await generateWithAutoFailover(finalPrompt, style);
      usedKeys.push(keyIndex + 1);
      
      // Extract image
      let imageFound = false;
      if (result.candidates && result.candidates.length > 0) {
        const candidate = result.candidates[0];
        
        if (candidate.content && candidate.content.parts) {
          for (const part of candidate.content.parts) {
            if (part.inlineData && part.inlineData.data) {
              const mimeType = part.inlineData.mimeType || 'image/png';
              const imageUrl = `data:${mimeType};base64,${part.inlineData.data}`;
              images.push(imageUrl);
              imageFound = true;
              console.log(`✅ Image ${i + 1} generated successfully using key ${keyIndex + 1}`);
              break;
            }
          }
        }
      }

      if (!imageFound) {
        const errorMsg = `Image ${i + 1}: No image data found`;
        errors.push(errorMsg);
        console.log(`❌ ${errorMsg}`);
      }

    } catch (error) {
      const errorMsg = `Image ${i + 1}: ${error.message}`;
      console.error(`❌ Error generating image ${i + 1}:`, error.message);
      errors.push(errorMsg);
    }
    
    console.log(`📊 Progress: ${i + 1}/${imageCount} attempts completed, ${images.length} successful`);
  }

  const processingTime = Date.now() - startTime;
  const status = keyRotator.getStatus();
  
  console.log(`🎯 Final result: ${images.length}/${imageCount} images generated in ${processingTime}ms`);

  const response = {
    success: images.length > 0,
    data: images.map(url => ({ url })),
    images: images,
    generated: images.length,
    requested: imageCount,
    processingTime: processingTime,
    generated_at: new Date().toISOString(),
    keyInfo: {
      usedKeys: usedKeys,
      totalKeys: status.totalKeys,
      remainingCapacity: status.remainingCapacity
    }
  };

  if (errors.length > 0) {
    response.errors = errors;
    response.message = `Generated ${images.length} out of ${imageCount} requested images`;
  }

  if (images.length > 0) {
    res.status(200).json(response);
  } else {
    res.status(500).json({
      ...response,
      error: 'Failed to generate any images. All API keys may be exhausted.'
    });
  }
});

// 🎯 STEP 9: Key Status Monitoring Endpoint
app.get('/key-status', (req, res) => {
  const status = keyRotator.getStatus();
  const keyDetails = keyRotator.keyHealth.map((k, i) => ({
    keyNumber: i + 1,
    isHealthy: k.isHealthy,
    usageCount: k.usageCount,
    errorCount: k.errorCount,
    cooldownUntil: k.cooldownUntil ? new Date(k.cooldownUntil).toLocaleString() : null
  }));

  res.json({
    summary: status,
    keyDetails: keyDetails,
    timestamp: new Date().toISOString()
  });
});

// 🎯 STEP 10: Reset Endpoint for Testing
app.post('/reset-keys', (req, res) => {
  keyRotator.resetAllKeys();
  
  res.json({
    success: true,
    message: 'All API key quotas and statuses reset',
    newCapacity: keyRotator.getStatus().remainingCapacity
  });
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
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    availableEndpoints: ['/', '/health', '/generate', '/generate-multiple', '/key-status', '/reset-keys']
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Gemini Multi-Key Backend running on port ${PORT}`);
  console.log(`📊 Loaded ${API_KEYS.length} API keys`);
  console.log(`📈 Total daily capacity: ${API_KEYS.length * 95} images`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Key status: http://localhost:${PORT}/key-status`);
  
  const status = keyRotator.getStatus();
  console.log(`🎯 Current capacity: ${status.remainingCapacity} images remaining`);
});
