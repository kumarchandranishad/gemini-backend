const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

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

app.use('/uploads', express.static(UPLOADS_DIR));

// Load BytePlus API keys from environment
const BYTEPLUS_API_KEYS = [
    process.env.BYTEPLUS_API_KEY_1,
    process.env.BYTEPLUS_API_KEY_2,
    process.env.BYTEPLUS_API_KEY_3,
    process.env.BYTEPLUS_API_KEY_4,
    process.env.BYTEPLUS_API_KEY_5
].filter(Boolean);

if (BYTEPLUS_API_KEYS.length === 0) {
    console.error('❌ No BytePlus API keys found! Add BYTEPLUS_API_KEY_* to your .env file');
    process.exit(1);
}

console.log(`🔑 Loaded ${BYTEPLUS_API_KEYS.length} BytePlus API keys`);

// Simple round-robin key rotation
let currentKeyIndex = 0;
function getNextApiKey() {
    const key = BYTEPLUS_API_KEYS[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % BYTEPLUS_API_KEYS.length;
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

// Enhanced prompt with size ratio for BytePlus Seedream-4.0
function enhancePromptWithRatio(prompt, ratio) {
    const ratioMap = {
        '1:1': 'square format, 1:1 aspect ratio',
        '4:3': '4:3 aspect ratio format, landscape proportions', 
        '16:9': '16:9 widescreen aspect ratio, cinematic view',
        '9:16': '9:16 portrait aspect ratio, vertical composition'
    };
    
    const enhancement = ratioMap[ratio] || ratioMap['1:1'];
    return `${prompt.trim()}, high quality, detailed, professional, ${enhancement}`;
}

// BytePlus Seedream-4.0 API call function
async function callBytePlusAPI(prompt, imageData = null, sizeRatio = '1:1') {
    const apiKey = getNextApiKey();
    
    // Correct BytePlus ModelArk API endpoint
    const url = 'https://ark.ap-southeast.bytepluses.com/api/v3/images/generations';
    
    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    };

    // Size mapping for BytePlus
    const sizeMap = {
        '1:1': '2K',
        '4:3': '2K', 
        '16:9': '2K',
        '9:16': '2K'
    };

    let requestBody = {
        model: 'seedream-4-0-250828', // Correct model name
        prompt: enhancePromptWithRatio(prompt, sizeRatio),
        size: sizeMap[sizeRatio] || '2K',
        stream: false,
        response_format: 'url',
        watermark: false
    };

    // If image editing mode
    if (imageData) {
        requestBody.image = `data:image/jpeg;base64,${imageData}`;
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`BytePlus API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
}

// Extract image from BytePlus response
function extractImageFromBytePlusResponse(response) {
    if (!response || !response.data || !response.data[0]) {
        return null;
    }

    // BytePlus returns image URL in data array
    return response.data[0].url;
}

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        project: 'byteplus-seedream-backend',
        message: 'BytePlus ModelArk Seedream-4.0 Image Generator & Editor',
        version: '1.0.0',
        status: 'running',
        features: [
            'Text-to-Image Generation (Seedream-4.0)',
            'Multi-Image Upload & Edit',
            'Aspect Ratio Support (1:1, 4:3, 16:9, 9:16)',
            'Multi-API Key Rotation',
            'File Upload Support (up to 10 images, 10MB each)',
            'Free Quota: 200 images per API key'
        ],
        endpoints: ['/generate', '/edit-images', '/health'],
        model: 'seedream-4-0-250828',
        provider: 'BytePlus ModelArk',
        timestamp: new Date().toISOString(),
        author: 'Kumar Chandra'
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        project: 'byteplus-seedream-backend',
        apiKeys: BYTEPLUS_API_KEYS.length,
        uptime: process.uptime(),
        model: 'seedream-4-0-250828',
        provider: 'BytePlus ModelArk',
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

        console.log(`🎨 Generating image with Seedream-4.0: ${prompt.substring(0, 50)}...`);
        
        const result = await callBytePlusAPI(prompt, null, sizeRatio || '1:1');
        const imageUrl = extractImageFromBytePlusResponse(result);

        if (!imageUrl) {
            throw new Error('Failed to extract image from BytePlus API response');
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
            model: 'seedream-4-0-250828',
            provider: 'BytePlus ModelArk'
        });

    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error('❌ Generation failed:', error.message);
        
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

        console.log(`🖼️ Editing ${images.length} images with Seedream-4.0: ${prompt.substring(0, 50)}...`);
        
        // Use first image for editing
        const firstImage = images[0];
        const imageBase64 = firstImage.buffer.toString('base64');
        
        const result = await callBytePlusAPI(prompt, imageBase64, sizeRatio);
        const imageUrl = extractImageFromBytePlusResponse(result);

        if (!imageUrl) {
            throw new Error('Failed to extract edited image from BytePlus API response');
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
            model: 'seedream-4-0-250828',
            provider: 'BytePlus ModelArk'
        });

    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error('❌ Edit failed:', error.message);
        
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
        project: 'byteplus-seedream-backend',
        availableEndpoints: ['/', '/health', '/generate', '/edit-images']
    });
});

// Start server
app.listen(PORT, () => {
    console.log('🚀 BYTEPLUS SEEDREAM-4.0 BACKEND STARTED');
    console.log('==========================================');
    console.log(`📡 Server running on port ${PORT}`);
    console.log(`🤖 Model: seedream-4-0-250828`);
    console.log(`🏢 Provider: BytePlus ModelArk`);
    console.log(`🔑 API Keys loaded: ${BYTEPLUS_API_KEYS.length}`);
    console.log(`📝 Max prompt length: 2000 characters`);
    console.log(`📸 Max images per request: 10`);
    console.log(`📁 Max file size: 10MB per image`);
    console.log(`🆓 Free quota: 200 images per API key`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
    console.log(`✨ Features: Text-to-Image + Image Upload & Edit`);
    console.log('==========================================');
    console.log('✅ BytePlus ModelArk integration ready!');
});
