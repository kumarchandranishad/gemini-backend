const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenAI } = require('@google/genai');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enhanced CORS Configuration
app.use(cors({
    origin: [
        'https://ddmalarfun.net',
        'http://localhost:3000',
        'http://localhost:5000',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5000',
        '*'
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '10mb' }));

// API Keys Array Setup
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
].filter(key => key);

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
            cooldownUntil: null,
            successCount: 0
        }));
    }

    getNextAvailableKey() {
        const now = Date.now();
        let attempts = 0;
        const startIndex = this.currentIndex;

        while (attempts < this.apiKeys.length) {
            const keyInfo = this.keyHealth[this.currentIndex];

            if (keyInfo.isHealthy &&
                keyInfo.usageCount < 95 &&
                (!keyInfo.cooldownUntil || keyInfo.cooldownUntil < now)) {

                keyInfo.usageCount++;
                keyInfo.lastUsed = now;

                const selectedKey = {
                    key: keyInfo.key,
                    index: this.currentIndex
                };

                this.currentIndex = (this.currentIndex + 1) % this.apiKeys.length;
                return selectedKey;
            }

            this.currentIndex = (this.currentIndex + 1) % this.apiKeys.length;
            attempts++;

            if (this.currentIndex === startIndex && attempts > 0) {
                break;
            }
        }

        return null;
    }

    markKeySuccess(keyIndex) {
        if (keyIndex >= 0 && keyIndex < this.keyHealth.length) {
            this.keyHealth[keyIndex].successCount++;
        }
    }

    markKeyExhausted(keyIndex, cooldownMinutes = 60) {
        if (keyIndex >= 0 && keyIndex < this.keyHealth.length) {
            this.keyHealth[keyIndex].isHealthy = false;
            this.keyHealth[keyIndex].cooldownUntil = Date.now() + (cooldownMinutes * 60 * 1000);
            this.keyHealth[keyIndex].errorCount++;
            console.log(`🔑 Key ${keyIndex + 1} marked as exhausted (cooldown: ${cooldownMinutes}min)`);
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
        const totalSuccess = this.keyHealth.reduce((sum, k) => sum + k.successCount, 0);
        const totalCapacity = this.apiKeys.length * 95;
        const remainingCapacity = totalCapacity - totalUsage;

        return {
            totalKeys: this.apiKeys.length,
            healthyKeys: healthyKeys,
            totalUsage: totalUsage,
            totalSuccess: totalSuccess,
            remainingCapacity: remainingCapacity,
            capacityPercentage: Math.round((remainingCapacity / totalCapacity) * 100)
        };
    }
}

const keyRotator = new APIKeyRotator(API_KEYS);
console.log(`🔑 Initialized with ${API_KEYS.length} API keys`);

// CRITICAL FIX: Enhanced prompt with explicit aspect ratio instructions
function enhancePromptWithSizeRatio(prompt, sizeRatio) {
    const sizeInstructions = {
        '1:1': {
            instruction: 'square format, 1:1 aspect ratio',
            details: 'centered composition, square image'
        },
        '4:3': {
            instruction: '4:3 aspect ratio format, landscape orientation',
            details: 'standard landscape proportions, wider than tall'
        },
        '16:9': {
            instruction: '16:9 aspect ratio format, widescreen cinematic',
            details: 'cinematic widescreen format, panoramic view'
        },
        '9:16': {
            instruction: '9:16 aspect ratio format, portrait orientation',
            details: 'vertical portrait format, taller than wide, mobile format'
        }
    };

    const sizeConfig = sizeInstructions[sizeRatio] || sizeInstructions['1:1'];
    
    // CRITICAL: Explicitly append aspect ratio instruction to prompt
    const enhancedPrompt = `${prompt.trim()}, in ${sizeConfig.instruction}, ${sizeConfig.details}`;
    
    console.log(`📐 Enhanced prompt for ${sizeRatio}:`, enhancedPrompt.substring(0, 100) + '...');
    return enhancedPrompt;
}

// Enhanced Generation Function
async function generateWithAutoFailover(prompt, sizeRatio, maxAttempts = 3) {
    let attempt = 0;

    while (attempt < maxAttempts) {
        const keySelection = keyRotator.getNextAvailableKey();

        if (!keySelection) {
            throw new Error('All API keys exhausted. Please try again tomorrow at 1:30 PM IST.');
        }

        try {
            console.log(`🔄 Attempt ${attempt + 1}: Using key ${keySelection.index + 1}/${API_KEYS.length}`);
            const ai = new GoogleGenAI({ apiKey: keySelection.key });

            // CRITICAL FIX: Use enhanced prompt with explicit aspect ratio
            const finalPrompt = enhancePromptWithSizeRatio(prompt, sizeRatio);

            console.log(`🤖 Using model: gemini-2.5-flash-image-preview`);
            console.log(`📝 Final prompt: ${finalPrompt.substring(0, 150)}...`);

            const result = await ai.models.generateContent({
                model: "gemini-2.5-flash-image-preview",
                contents: [{
                    parts: [{ text: finalPrompt }]
                }],
                config: {
                    responseModalities: ["IMAGE", "TEXT"]
                }
            });

            console.log(`✅ Success with key ${keySelection.index + 1}`);
            keyRotator.markKeySuccess(keySelection.index);

            console.log('📦 Response structure:', JSON.stringify({
                hasCandidates: !!result.candidates,
                candidatesLength: result.candidates?.length || 0,
                firstCandidateKeys: result.candidates?.[0] ? Object.keys(result.candidates[0]) : [],
                contentKeys: result.candidates?.[0]?.content ? Object.keys(result.candidates[0].content) : [],
                partsLength: result.candidates?.[0]?.content?.parts?.length || 0
            }, null, 2));

            return { result, keyIndex: keySelection.index };

        } catch (error) {
            console.error(`❌ Key ${keySelection.index + 1} failed:`, error.message);

            if (error.message.includes('429') ||
                error.message.includes('quota') ||
                error.message.includes('RESOURCE_EXHAUSTED')) {

                keyRotator.markKeyExhausted(keySelection.index);
                console.log(`🔄 Switching to next available key...`);
                attempt++;

                if (attempt < maxAttempts) {
                    const delay = attempt * 1000;
                    console.log(`⏳ Waiting ${delay}ms before next attempt...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            } else {
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
        model: 'gemini-2.5-flash-image-preview',
        features: [
            'Fixed Size Ratio Support',
            'Multi-API Key Rotation',
            'Enhanced Prompt Engineering',
            'Smart Aspect Ratio Detection',
            '2000 Character Limit'
        ],
        keyInfo: {
            totalKeys: status.totalKeys,
            healthyKeys: status.healthyKeys,
            remainingCapacity: status.remainingCapacity,
            capacityPercentage: status.capacityPercentage + '%'
        },
        cors: 'Enabled for ddmalarfun.net',
        timestamp: new Date().toISOString(),
        version: '3.2.0 - Size Ratio Fixed',
        maxPromptLength: 2000
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    console.log('🏥 Health check requested from:', req.get('Origin') || 'Unknown');
    const status = keyRotator.getStatus();

    res.status(200).json({
        status: 'healthy',
        model: 'gemini-2.5-flash-image-preview',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        multiKeyStatus: {
            totalKeys: status.totalKeys,
            healthyKeys: status.healthyKeys,
            totalUsage: status.totalUsage,
            totalSuccess: status.totalSuccess,
            remainingCapacity: status.remainingCapacity,
            capacityPercentage: status.capacityPercentage + '%'
        },
        cors: 'Enabled',
        allowedOrigin: 'https://ddmalarfun.net',
        maxPromptLength: 2000,
        sizeRatioFixed: true
    });
});

// FIXED: Enhanced Image Generation with Size Ratio Support
app.post('/generate', async (req, res) => {
    const startTime = Date.now();
    const { prompt, sizeRatio } = req.body;

    console.log('🎨 Image generation request:', {
        prompt: prompt?.substring(0, 50) + '...',
        promptLength: prompt?.length || 0,
        sizeRatio: sizeRatio || '1:1',
        model: 'gemini-2.5-flash-image-preview',
        timestamp: new Date().toISOString()
    });

    if (!prompt || prompt.trim() === '') {
        return res.status(400).json({
            success: false,
            error: 'Prompt is required and cannot be empty',
            model: 'gemini-2.5-flash-image-preview'
        });
    }

    if (prompt.length > 2000) {
        return res.status(400).json({
            success: false,
            error: 'Prompt must be 2000 characters or less',
            promptLength: prompt.length,
            maxLength: 2000,
            model: 'gemini-2.5-flash-image-preview'
        });
    }

    try {
        const { result, keyIndex } = await generateWithAutoFailover(prompt, sizeRatio || '1:1');

        let imageUrl = null;
        let extractionMethod = 'none';

        console.log('🔍 Starting image extraction...');

        // Method 1: Standard extraction from result.candidates[0]
        if (result?.candidates?.length > 0) {
            const candidate = result.candidates[0];

            console.log('📊 Candidate structure:', {
                hasContent: !!candidate.content,
                hasParts: !!candidate.content?.parts,
                partsCount: candidate.content?.parts?.length || 0
            });

            if (candidate?.content?.parts && candidate.content.parts.length > 0) {
                for (let i = 0; i < candidate.content.parts.length; i++) {
                    const part = candidate.content.parts[i];

                    console.log(`🔸 Part ${i}:`, {
                        hasInlineData: !!part.inlineData,
                        hasData: !!part.inlineData?.data,
                        dataLength: part.inlineData?.data?.length || 0,
                        mimeType: part.inlineData?.mimeType
                    });

                    if (part.inlineData?.data) {
                        const mimeType = part.inlineData.mimeType || 'image/png';
                        imageUrl = `data:${mimeType};base64,${part.inlineData.data}`;
                        extractionMethod = `standard-part-${i}`;
                        console.log(`✅ Image extracted via method: ${extractionMethod}`);
                        break;
                    }
                }
            }
        }

        // Method 2: Try direct candidates array access
        if (!imageUrl && result?.candidates) {
            console.log('🔍 Trying direct candidates access...');
            const candidates = Array.isArray(result.candidates) ? result.candidates : [result.candidates];

            for (let candIndex = 0; candIndex < candidates.length; candIndex++) {
                const candidate = candidates[candIndex];
                if (candidate?.content?.parts) {
                    for (let partIndex = 0; partIndex < candidate.content.parts.length; partIndex++) {
                        const part = candidate.content.parts[partIndex];
                        if (part?.inlineData?.data) {
                            const mimeType = part.inlineData.mimeType || 'image/png';
                            imageUrl = `data:${mimeType};base64,${part.inlineData.data}`;
                            extractionMethod = `direct-cand-${candIndex}-part-${partIndex}`;
                            console.log(`✅ Image extracted via method: ${extractionMethod}`);
                            break;
                        }
                    }
                }
                if (imageUrl) break;
            }
        }

        // Method 3: Check for alternative response structures
        if (!imageUrl) {
            console.log('🔍 Trying alternative structures...');
            if (result?.response?.candidates) {
                const candidates = result.response.candidates;
                if (candidates[0]?.content?.parts) {
                    for (const part of candidates[0].content.parts) {
                        if (part?.inlineData?.data) {
                            const mimeType = part.inlineData.mimeType || 'image/png';
                            imageUrl = `data:${mimeType};base64,${part.inlineData.data}`;
                            extractionMethod = 'response-candidates';
                            console.log(`✅ Image extracted via method: ${extractionMethod}`);
                            break;
                        }
                    }
                }
            }
        }

        if (imageUrl) {
            const processingTime = Date.now() - startTime;
            const status = keyRotator.getStatus();

            console.log(`🎉 Image extracted successfully using key ${keyIndex + 1}, method: ${extractionMethod}, size: ${imageUrl.length} chars`);

            return res.json({
                success: true,
                imageUrl: imageUrl,
                data: [{ url: imageUrl }],
                images: [imageUrl],
                prompt: prompt,
                sizeRatio: sizeRatio || '1:1',
                processingTime: processingTime,
                generated_at: new Date().toISOString(),
                model: 'gemini-2.5-flash-image-preview',
                promptLength: prompt.length,
                sizeRatioFixed: true,
                keyInfo: {
                    usedKey: keyIndex + 1,
                    totalKeys: status.totalKeys,
                    remainingCapacity: status.remainingCapacity,
                    extractionMethod: extractionMethod
                }
            });
        }

        console.error('❌ No image found - Complete response structure:');
        console.error(JSON.stringify(result, null, 2));

        res.status(500).json({
            success: false,
            error: 'No image generated in response',
            debug: {
                hasCandidates: !!result?.candidates,
                candidatesLength: result?.candidates?.length || 0,
                responseKeys: Object.keys(result || {}),
                extractionMethod: extractionMethod,
                model: 'gemini-2.5-flash-image-preview'
            }
        });

    } catch (error) {
        const processingTime = Date.now() - startTime;
        console.error('❌ Single image generation failed:', error.message);
        const status = keyRotator.getStatus();

        res.status(500).json({
            success: false,
            error: error.message,
            processingTime,
            keyStatus: status,
            model: 'gemini-2.5-flash-image-preview'
        });
    }
});

// Key Status Monitoring Endpoint
app.get('/key-status', (req, res) => {
    const status = keyRotator.getStatus();
    const keyDetails = keyRotator.keyHealth.map((k, i) => ({
        keyNumber: i + 1,
        isHealthy: k.isHealthy,
        usageCount: k.usageCount,
        successCount: k.successCount,
        errorCount: k.errorCount,
        cooldownUntil: k.cooldownUntil ? new Date(k.cooldownUntil).toLocaleString() : null
    }));

    res.json({
        summary: status,
        keyDetails: keyDetails,
        model: 'gemini-2.5-flash-image-preview',
        maxPromptLength: 2000,
        sizeRatioFixed: true,
        timestamp: new Date().toISOString()
    });
});

// Reset Endpoint for Testing
app.post('/reset-keys', (req, res) => {
    keyRotator.resetAllKeys();
    res.json({
        success: true,
        message: 'All API key quotas and statuses reset',
        newCapacity: keyRotator.getStatus().remainingCapacity,
        model: 'gemini-2.5-flash-image-preview',
        sizeRatioFixed: true
    });
});

// Global error handling
app.use((error, req, res, next) => {
    console.error('❌ Unhandled error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        model: 'gemini-2.5-flash-image-preview'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        availableEndpoints: ['/', '/health', '/generate', '/key-status', '/reset-keys'],
        model: 'gemini-2.5-flash-image-preview'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Gemini Multi-Key Backend running on port ${PORT}`);
    console.log(`🤖 Using model: gemini-2.5-flash-image-preview`);
    console.log(`📐 Size ratio functionality: FIXED`);
    console.log(`📝 Max prompt length: 2000 characters`);
    console.log(`🔑 Loaded ${API_KEYS.length} API keys`);
    console.log(`📊 Total daily capacity: ${API_KEYS.length * 95} images`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
    console.log(`📈 Key status: http://localhost:${PORT}/key-status`);

    const status = keyRotator.getStatus();
    console.log(`⚡ Current capacity: ${status.remainingCapacity} images remaining`);
    console.log(`✅ Server initialized successfully with SIZE RATIO FIX!`);
});
