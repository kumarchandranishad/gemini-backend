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

// Enhanced API Key Rotator Class
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

// Enhanced Size Ratio Mapping for Better Results
function enhancePromptWithSizeRatio(prompt, sizeRatio) {
    const sizeEnhancements = {
        '1:1': {
            description: 'square format, centered composition',
            keywords: 'square aspect ratio, centered, balanced composition'
        },
        '4:3': {
            description: 'standard landscape format, classic proportions',
            keywords: 'landscape orientation, 4:3 aspect ratio, standard format'
        },
        '16:9': {
            description: 'widescreen cinematic format, panoramic view',
            keywords: 'cinematic widescreen, 16:9 aspect ratio, panoramic, wide angle'
        },
        '9:16': {
            description: 'portrait format, vertical composition',
            keywords: 'portrait orientation, vertical composition, 9:16 aspect ratio, mobile format'
        }
    };

    const enhancement = sizeEnhancements[sizeRatio];
    if (!enhancement) return prompt;

    // Add size-specific enhancements to the prompt
    return
