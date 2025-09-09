const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { GoogleGenAI } = require('@google/genai');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enhanced CORS Configuration
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Create uploads directory
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    console.log('📁 Created uploads directory');
}

// Serve static files
app.use('/uploads', express.static(UPLOADS_DIR));

// Load API keys from environment
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
].filter(Boolean);

if (API_KEYS.length === 0) {
    console.error('❌ No API keys found! Add GEMINI_API_KEY_* to your .env file');
    process.exit(1);
}

console.log(`🔑 Loaded ${API_KEYS.length} API keys`);

// Simple round-robin key rotation
let currentKeyIndex = 0;
function getNextApiKey() {
    const key = API_KEYS[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
    return key;
}

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB per file
        files: 10 // max 10 files
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only image files (JPEG, PNG, GIF, WEBP) are allowed'), false);
        }
    }
});

// Enhanced prompt with size ratio
function enhancePromptWithRatio(prompt, ratio) {
    const ratioMap = {
        '1:1': 'square format with 1:1 aspect ratio, centered composition',
        '4:3': '4:3 aspect ratio format, standard landscape proportions',
        '16:9': '16:9 widescreen aspect ratio format, cinematic view',
        '9:16': '9:16 portrait aspect ratio format, vertical composition'
    };
    
    const enhancement = ratioMap[ratio] || ratioMap['1:1'];
    return `${prompt.trim()}, ${enhancement}`;
}

// Extract image from Gemini response
function extractImageFromResponse(response) {
    if (!response || !response.candidates) {
        return null;
    }

    for (const candidate of response.candidates) {
        if (candidate.content && candidate.content.parts) {
            for (const part of candidate.content.parts) {
                if (part.inlineData && part.inlineData.data) {
                    const mimeType = part.inlineData.mimeType || 'image/png';
                    return `data:${mimeType};base64,${part.inlineData.data}`;
                }
            }
        }
    }
    return null;
}

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        project: 'gemini-backend',
        message: 'Gemini AI Image Generator & Editor Backend',
        version: '4.6.0',
        status: 'running',
        features: [
            'Text-to-Image Generation',
            'Multi-Image Upload & Edit',
            'Aspect Ratio Support (1:1, 4:3, 16:9, 9:16)',
            'Multi-API Key Rotation',
            'File Upload Support (up to 10 images, 10MB each)'
        ],
        endpoints: ['/generate', '/edit-images', '/health'],
        model: 'gemini-2.5-flash-lite',
        timestamp: new Date().toISOString(),
        author: 'Kumar Chandra'
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        project: 'gemini-backend',
        apiKeys: API_KEYS.length,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Text-to-image generation endpoint
app.post('/generate', async (req, res) => {
    const startTime = Date.now();
    try {
        const { prompt, sizeRatio } = req.body;

        // Validation
        if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Prompt is required and must be a non-empty string'
            });
        }

        if (prompt.length > 2000) {
            return res.status(400).json({
                success: false,
                error: 'Prompt must be 2000 characters or less'
            });
        }

        console.log(`🎨 Generating image with Gemini 2.5 Flash Lite: "${prompt.substring(0, 50)}..."`);
        
        const apiKey = getNextApiKey();
        const ai = new GoogleGenAI({ apiKey });
        
        const enhancedPrompt = enhancePromptWithRatio(prompt, sizeRatio || '1:1');

        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash-lite',
            contents: [{
                parts: [{ text: enhancedPrompt }]
            }],
            config: {
                responseModalities: ['IMAGE', 'TEXT']
            }
        });

        const imageUrl = extractImageFromResponse(result);
        if (!imageUrl) {
            throw new Error('Failed to extract image from API response');
        }

        const processingTime = Date.now() - startTime;
        console.log(`✅ Image generated successfully in ${processingTime}ms`);

        res.json({
            success: true,
            imageUrl: imageUrl,
            prompt: prompt,
            sizeRatio: sizeRatio || '1:1',
            processingTime: processingTime,
            generatedAt: new Date().toISOString(),
            type: 'text-to-image',
            model: 'gemini-2.5-flash-lite'
        });

    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error('❌ Generation failed:', error);
        
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error',
            processingTime: processingTime,
            type: 'text-to-image'
        });
    }
});

// Image upload & edit endpoint
app.post('/edit-images', upload.array('images', 10), async (req, res) => {
    const startTime = Date.now();
    try {
        const { prompt, sizeRatio } = req.body;
        const images = req.files;

        // Validation
        if (!images || images.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'At least one image is required'
            });
        }

        if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Prompt is required and must be a non-empty string'
            });
        }

        if (prompt.length > 2000) {
            return res.status(400).json({
                success: false,
                error: 'Prompt must be 2000 characters or less'
            });
        }

        if (images.length > 10) {
            return res.status(400).json({
                success: false,
                error: 'Maximum 10 images allowed'
            });
        }

        console.log(`🖼️ Editing ${images.length} images with Gemini 2.5 Flash Lite: "${prompt.substring(0, 50)}..."`);
        
        const apiKey = getNextApiKey();
        const ai = new GoogleGenAI({ apiKey });

        // Build contents array with images and prompt
        const contents = [];
        
        // Add all images to contents
        for (const image of images) {
            contents.push({
                inlineData: {
                    mimeType: image.mimetype,
                    data: image.buffer.toString('base64')
                }
            });
        }

        // Add the prompt (with or without ratio enhancement)
        const finalPrompt = sizeRatio ? 
            enhancePromptWithRatio(prompt, sizeRatio) : 
            prompt;
        
        contents.push({ text: finalPrompt });

        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash-lite',
            contents: contents,
            config: {
                responseModalities: ['IMAGE', 'TEXT']
            }
        });

        const imageUrl = extractImageFromResponse(result);
        if (!imageUrl) {
            throw new Error('Failed to extract edited image from API response');
        }

        const processingTime = Date.now() - startTime;
        console.log(`✅ Images edited successfully in ${processingTime}ms`);

        res.json({
            success: true,
            imageUrl: imageUrl,
            prompt: prompt,
            sizeRatio: sizeRatio || 'original',
            inputImageCount: images.length,
            processingTime: processingTime,
            generatedAt: new Date().toISOString(),
            type: 'image-edit',
            model: 'gemini-2.5-flash-lite'
        });

    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error('❌ Edit failed:', error);
        
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error',
            processingTime: processingTime,
            type: 'image-edit'
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'File size too large. Maximum size is 10MB per file.'
            });
        }
        
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                error: 'Too many files. Maximum 10 files allowed.'
            });
        }
    }

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
        project: 'gemini-backend',
        availableEndpoints: ['/', '/health', '/generate', '/edit-images']
    });
});

// Start server
app.listen(PORT, () => {
    console.log('🚀 GEMINI BACKEND SERVER STARTED');
    console.log('=====================================');
    console.log(`📡 Server running on port ${PORT}`);
    console.log(`🤖 Model: gemini-2.5-flash-lite`);
    console.log(`🔑 API Keys loaded: ${API_KEYS.length}`);
    console.log(`📝 Max prompt length: 2000 characters`);
    console.log(`📸 Max images per request: 10`);
    console.log(`📁 Max file size: 10MB per image`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
    console.log(`✨ Features: Text-to-Image + Image Upload & Edit`);
    console.log('=====================================');
    console.log('✅ All systems ready! Server is running...');
});
