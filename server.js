// Configuration
const CONFIG = {
    API_BASE_URL: 'https://gemini-backend-a2fl.onrender.com',
    MAX_PROMPT_LENGTH: 2000,
    LOADING_MESSAGES: [
        'Creating your masterpiece...',
        'Analyzing your vision...',
        'Painting with digital brushes...',
        'Channeling artistic inspiration...',
        'Crafting visual magic...',
        'Bringing your vision to life...',
        'Weaving pixels into art...',
        'Transforming words into images...',
        'Adding finishing touches...'
    ]
};

// DOM Elements
const DOM = {
    imageForm: null,
    promptInput: null,
    sizeRadios: null,
    generateBtn: null,
    loadingContainer: null,
    loadingMessage: null,
    progressFill: null,
    progressPercent: null,
    resultsContainer: null,
    charCounter: null,
    charCount: null,
    headerStats: null
};

// State
const state = {
    isGenerating: false,
    loadingMessageIndex: 0,
    progressInterval: null,
    selectedSizeRatio: '1:1'
};

// Initialize DOM elements safely
function initializeDOM() {
    try {
        DOM.imageForm = document.getElementById('imageForm');
        DOM.promptInput = document.getElementById('prompt');
        DOM.sizeRadios = document.querySelectorAll('input[name="sizeRatio"]');
        DOM.generateBtn = document.getElementById('generateBtn');
        DOM.loadingContainer = document.getElementById('loadingContainer');
        DOM.loadingMessage = document.getElementById('loadingMessage');
        DOM.progressFill = document.getElementById('progressFill');
        DOM.progressPercent = document.getElementById('progressPercent');
        DOM.resultsContainer = document.getElementById('resultsContainer');
        DOM.charCounter = document.getElementById('charCounter');
        DOM.charCount = document.getElementById('charCount');
        DOM.headerStats = document.getElementById('headerStats');

        console.log('✅ DOM elements initialized successfully');
        return true;
    } catch (error) {
        console.error('❌ Failed to initialize DOM elements:', error);
        return false;
    }
}

// Utility functions
const utils = {
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    isMobile() {
        return window.innerWidth <= 768;
    },

    getInputValue(element, fallback = '') {
        if (!element) {
            console.warn('⚠️ Element not found, returning fallback value');
            return fallback;
        }
        return (element.value || '').trim();
    },

    getSelectedSizeRatio() {
        const checkedRadio = document.querySelector('input[name="sizeRatio"]:checked');
        return checkedRadio ? checkedRadio.value : '1:1';
    }
};

// Character counter
const characterCounter = {
    init() {
        if (!DOM.promptInput || !DOM.charCount) {
            console.error('❌ Character counter: Required elements not found');
            return;
        }

        this.updateCounter();
        DOM.promptInput.addEventListener('input', utils.debounce(() => {
            this.updateCounter();
            this.autoResize();
        }, 100));
    },

    updateCounter() {
        if (!DOM.promptInput || !DOM.charCount || !DOM.charCounter) return;

        const currentLength = utils.getInputValue(DOM.promptInput).length;
        const maxLength = CONFIG.MAX_PROMPT_LENGTH;

        DOM.charCount.textContent = currentLength;
        DOM.charCounter.classList.remove('warning', 'error');

        if (currentLength > maxLength) {
            DOM.charCounter.classList.add('error');
        } else if (currentLength > maxLength * 0.8) {
            DOM.charCounter.classList.add('warning');
        }
    },

    autoResize() {
        if (!DOM.promptInput) return;
        DOM.promptInput.style.height = 'auto';
        DOM.promptInput.style.height = (DOM.promptInput.scrollHeight) + 'px';
    }
};

// Size ratio handler
const sizeRatioHandler = {
    init() {
        if (!DOM.sizeRadios) return;

        DOM.sizeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                state.selectedSizeRatio = e.target.value;
                console.log('📐 Size ratio changed to:', state.selectedSizeRatio);
            });
        });

        // Set initial state
        state.selectedSizeRatio = utils.getSelectedSizeRatio();
        console.log('📐 Initial size ratio:', state.selectedSizeRatio);
    }
};

// Enhanced Loading manager with better progress
const loadingManager = {
    messageInterval: null,
    progressInterval: null,

    show() {
        if (!DOM.loadingContainer) return;
        DOM.loadingContainer.classList.add('show');
        this.startMessageRotation();
        this.startProgressAnimation();
    },

    hide() {
        if (!DOM.loadingContainer) return;
        DOM.loadingContainer.classList.remove('show');
        this.stopMessageRotation();
        this.stopProgressAnimation();
    },

    startMessageRotation() {
        this.stopMessageRotation();
        state.loadingMessageIndex = 0;
        this.messageInterval = setInterval(() => {
            if (DOM.loadingMessage) {
                DOM.loadingMessage.textContent = CONFIG.LOADING_MESSAGES[state.loadingMessageIndex];
                state.loadingMessageIndex = (state.loadingMessageIndex + 1) % CONFIG.LOADING_MESSAGES.length;
            }
        }, 3000);
    },

    stopMessageRotation() {
        if (this.messageInterval) {
            clearInterval(this.messageInterval);
            this.messageInterval = null;
        }
    },

    startProgressAnimation() {
        if (!DOM.progressFill || !DOM.progressPercent) return;
        
        let progress = 0;
        this.progressInterval = setInterval(() => {
            if (!DOM.loadingContainer || !DOM.loadingContainer.classList.contains('show')) {
                clearInterval(this.progressInterval);
                return;
            }
            
            // More realistic progress simulation
            if (progress < 30) {
                progress += Math.random() * 8 + 2;
            } else if (progress < 60) {
                progress += Math.random() * 4 + 1;
            } else if (progress < 90) {
                progress += Math.random() * 2 + 0.5;
            } else if (progress < 95) {
                progress += Math.random() * 0.5;
            }

            progress = Math.min(progress, 95);
            
            DOM.progressFill.style.width = `${progress}%`;
            DOM.progressPercent.textContent = `${Math.round(progress)}%`;
        }, 500);
    },

    stopProgressAnimation() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
        if (DOM.progressFill && DOM.progressPercent) {
            DOM.progressFill.style.width = '0%';
            DOM.progressPercent.textContent = '0%';
        }
    }
};

// Message manager
const messageManager = {
    show(message, type = 'info') {
        if (!DOM.resultsContainer) return;

        this.clear();
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;
        DOM.resultsContainer.insertBefore(messageDiv, DOM.resultsContainer.firstChild);

        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 6000);
    },

    clear() {
        document.querySelectorAll('.message').forEach(el => el.remove());
    }
};

// Image manager
const imageManager = {
    clearPreviousImages() {
        if (!DOM.resultsContainer) return;
        const imageResults = DOM.resultsContainer.querySelectorAll('.image-result');
        imageResults.forEach(result => result.remove());
        messageManager.clear();
        console.log('✅ Previous images cleared');
    }
};

// Enhanced Image processor with proper size ratio handling
const imageProcessor = {
    async processImage(imgElement, targetRatio) {
        return new Promise((resolve) => {
            // If no target ratio specified, return original
            if (!targetRatio) {
                resolve(imgElement.src);
                return;
            }

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Define exact aspect ratios
            const ratios = {
                '1:1': 1,
                '4:3': 4/3,
                '16:9': 16/9,
                '9:16': 9/16
            };

            const targetAspectRatio = ratios[targetRatio];
            if (!targetAspectRatio) {
                resolve(imgElement.src);
                return;
            }

            // Wait for image to load
            const processLoadedImage = () => {
                const originalWidth = imgElement.naturalWidth;
                const originalHeight = imgElement.naturalHeight;
                
                if (originalWidth === 0 || originalHeight === 0) {
                    resolve(imgElement.src);
                    return;
                }

                const originalAspectRatio = originalWidth / originalHeight;

                // Calculate crop dimensions
                let cropWidth, cropHeight, offsetX = 0, offsetY = 0;

                if (originalAspectRatio > targetAspectRatio) {
                    // Image is wider than target - crop sides
                    cropHeight = originalHeight;
                    cropWidth = originalHeight * targetAspectRatio;
                    offsetX = (originalWidth - cropWidth) / 2;
                } else {
                    // Image is taller than target - crop top/bottom
                    cropWidth = originalWidth;
                    cropHeight = originalWidth / targetAspectRatio;
                    offsetY = (originalHeight - cropHeight) / 2;
                }

                // Set canvas size based on target ratio (max 1024px on longer side)
                const maxSize = 1024;
                if (targetAspectRatio >= 1) {
                    // Landscape or square
                    canvas.width = maxSize;
                    canvas.height = maxSize / targetAspectRatio;
                } else {
                    // Portrait
                    canvas.width = maxSize * targetAspectRatio;
                    canvas.height = maxSize;
                }

                // Draw cropped and resized image
                ctx.drawImage(
                    imgElement,
                    offsetX, offsetY, cropWidth, cropHeight,
                    0, 0, canvas.width, canvas.height
                );

                const processedImageUrl = canvas.toDataURL('image/png', 0.9);
                console.log(`✅ Image processed: ${targetRatio} (${canvas.width}x${canvas.height})`);
                resolve(processedImageUrl);
            };

            if (imgElement.complete && imgElement.naturalWidth > 0) {
                processLoadedImage();
            } else {
                imgElement.onload = processLoadedImage;
                imgElement.onerror = () => {
                    console.warn('⚠️ Image processing failed - using original');
                    resolve(imgElement.src);
                };
            }
        });
    }
};

// Enhanced Image generator with better size ratio handling
const imageGenerator = {
    async generate() {
        console.log('🔄 Generate function called');

        if (!DOM.promptInput) {
            console.error('❌ Required DOM elements not found');
            messageManager.show('⚠️ Page not loaded properly. Please refresh the page.', 'error');
            return;
        }

        const prompt = utils.getInputValue(DOM.promptInput);
        const sizeRatio = utils.getSelectedSizeRatio();

        console.log('📝 Input values:', {
            prompt: prompt ? `"${prompt.substring(0, 30)}..."` : 'EMPTY',
            promptLength: prompt.length,
            sizeRatio: sizeRatio
        });

        // Enhanced validation
        if (!prompt || prompt.length === 0) {
            console.warn('⚠️ Empty prompt detected');
            messageManager.show('✨ Please describe your image to get started!', 'error');
            if (DOM.promptInput) {
                DOM.promptInput.focus();
                DOM.promptInput.style.borderColor = 'var(--error)';
                setTimeout(() => {
                    DOM.promptInput.style.borderColor = '';
                }, 3000);
            }
            return;
        }

        if (prompt.length > CONFIG.MAX_PROMPT_LENGTH) {
            console.warn('⚠️ Prompt too long:', prompt.length);
            messageManager.show(`📝 Please keep your description under ${CONFIG.MAX_PROMPT_LENGTH} characters`, 'error');
            if (DOM.promptInput) {
                DOM.promptInput.focus();
            }
            return;
        }

        console.log('✅ Validation passed, starting generation');
        this.setGeneratingState(true);

        try {
            console.log('🚀 Making API request with size ratio:', sizeRatio);

            const response = await fetch(`${CONFIG.API_BASE_URL}/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ 
                    prompt: prompt, 
                    sizeRatio: sizeRatio 
                }),
            });

            console.log('📡 API Response status:', response.status);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('📦 API Response data received');

            if (data.success && (data.imageUrl || data.images)) {
                const imageUrl = data.imageUrl || data.images[0];
                await this.displayImage(imageUrl, prompt, { ...data, sizeRatio });
                messageManager.show('🎨 Your beautiful image is ready!', 'success');

                // Update header stats if available
                if (DOM.headerStats && data.keyInfo) {
                    this.updateHeaderStats(data.keyInfo);
                }

                setTimeout(() => {
                    if (DOM.resultsContainer) {
                        DOM.resultsContainer.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center'
                        });
                    }
                }, 300);
            } else {
                throw new Error(data.error || 'No image generated');
            }

        } catch (error) {
            console.error('❌ Generation failed:', error);
            let errorMessage = '🚫 Something went wrong. Please try again!';

            if (error.message.includes('quota') || error.message.includes('429')) {
                errorMessage = '⏰ We\'re at capacity right now. Please try again in a few minutes!';
            } else if (error.message.includes('fetch') || error.message.includes('network')) {
                errorMessage = '🌐 Connection issue. Please check your internet and try again!';
            }

            messageManager.show(errorMessage, 'error');
        } finally {
            this.setGeneratingState(false);
        }
    },

    async displayImage(imageUrl, prompt, data) {
        console.log('🖼️ Displaying image with ratio:', data.sizeRatio);

        if (!DOM.resultsContainer) {
            console.error('❌ Results container not found');
            return;
        }

        imageManager.clearPreviousImages();

        const imageResult = document.createElement('div');
        imageResult.className = 'image-result';

        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = `Generated Image: ${prompt}`;
        img.className = 'generated-image';
        img.loading = 'lazy';

        // Enhanced image loading with proper ratio processing
        img.onload = async () => {
            try {
                console.log('🖼️ Processing image for size ratio:', data.sizeRatio);
                const processedUrl = await imageProcessor.processImage(img, data.sizeRatio);
                if (processedUrl !== img.src) {
                    img.src = processedUrl;
                    console.log('✅ Image processed and updated');
                } else {
                    console.log('✅ Image loaded (no processing needed)');
                }
            } catch (error) {
                console.warn('⚠️ Image processing failed:', error);
            }
        };

        img.onerror = () => {
            console.error('❌ Image failed to load');
            messageManager.show('Failed to load generated image', 'error');
        };

        const ratioBadge = document.createElement('div');
        ratioBadge.className = 'ratio-badge';
        ratioBadge.textContent = `${data.sizeRatio || '1:1'} ✓`;

        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'download-btn';
        downloadBtn.innerHTML = '📥 Download Image';
        downloadBtn.onclick = () => this.downloadImage(img.src, data.sizeRatio, prompt);

        const imageInfo = document.createElement('div');
        imageInfo.className = 'image-info';
        imageInfo.innerHTML = this.generateImageInfo(data, prompt);

        imageResult.appendChild(ratioBadge);
        imageResult.appendChild(img);
        imageResult.appendChild(downloadBtn);
        imageResult.appendChild(imageInfo);

        DOM.resultsContainer.appendChild(imageResult);
        console.log('✅ Image result displayed');
    },

    generateImageInfo(data, prompt) {
        const lines = [];
        lines.push(`<strong>Format:</strong> ${data.sizeRatio || '1:1'}`);
        if (data.processingTime) {
            lines.push(`<strong>Generated in:</strong> ${data.processingTime}ms`);
        }
        if (data.keyInfo && data.keyInfo.usedKey) {
            lines.push(`<strong>Key:</strong> ${data.keyInfo.usedKey}`);
        }
        if (data.model) {
            lines.push(`<strong>Model:</strong> ${data.model}`);
        }
        return lines.join(' • ');
    },

    downloadImage(dataUrl, sizeRatio, prompt) {
        try {
            const link = document.createElement('a');
            link.href = dataUrl;
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
            const filename = `ai-image-${sizeRatio || 'standard'}-${timestamp}.png`;
            link.download = filename;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            messageManager.show(`📥 Downloaded in ${sizeRatio || 'standard'} format!`, 'success');
            console.log('✅ Download initiated:', filename);
        } catch (error) {
            console.error('❌ Download failed:', error);
            messageManager.show('⚠️ Download failed. Try right-clicking the image and selecting "Save As".', 'error');
        }
    },

    updateHeaderStats(keyInfo) {
        if (!DOM.headerStats) return;
        
        const dailyQuota = DOM.headerStats.querySelector('#dailyQuota');
        if (dailyQuota && keyInfo.remainingCapacity !== undefined) {
            dailyQuota.textContent = keyInfo.remainingCapacity;
        }
    },

    setGeneratingState(isGenerating) {
        console.log('⚙️ Setting generating state:', isGenerating);
        state.isGenerating = isGenerating;

        if (DOM.generateBtn) {
            DOM.generateBtn.disabled = isGenerating;
        }

        if (isGenerating) {
            loadingManager.show();
        } else {
            loadingManager.hide();
        }
    }
};

// Form handler
const formHandler = {
    init() {
        if (!DOM.imageForm || !DOM.generateBtn) {
            console.error('❌ Form handler: Required elements not found');
            return;
        }

        DOM.imageForm.addEventListener('submit', (e) => {
            e.preventDefault();
            console.log('📋 Form submitted');
            this.handleGenerate();
        });

        DOM.generateBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('🔘 Generate button clicked');
            this.handleGenerate();
        });

        console.log('✅ Form handlers initialized');
    },

    handleGenerate() {
        if (state.isGenerating) {
            console.log('⏸️ Generation already in progress, ignoring request');
            return;
        }

        console.log('▶️ Starting generation process');
        imageGenerator.generate();
    }
};

// Enhanced keyboard shortcuts
const keyboardShortcuts = {
    init() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+Enter to generate
            if (e.key === 'Enter' && e.ctrlKey && !state.isGenerating) {
                e.preventDefault();
                console.log('⌨️ Ctrl+Enter pressed');
                imageGenerator.generate();
            } 
            // Escape to clear results
            else if (e.key === 'Escape') {
                console.log('⌨️ Escape pressed');
                messageManager.clear();
                if (DOM.promptInput && !state.isGenerating) {
                    DOM.promptInput.focus();
                }
            }
            // Tab navigation enhancement
            else if (e.key === 'Tab' && !e.shiftKey) {
                // Enhanced tab navigation logic can be added here
            }
        });

        console.log('✅ Keyboard shortcuts initialized');
    }
};

// API Health checker
const healthChecker = {
    async checkAPIHealth() {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/health`);
            const data = await response.json();
            
            if (data.status === 'healthy' && DOM.headerStats) {
                this.updateHealthStats(data);
            }
            
            return data.status === 'healthy';
        } catch (error) {
            console.warn('⚠️ Health check failed:', error.message);
            return false;
        }
    },

    updateHealthStats(healthData) {
        const dailyQuota = document.querySelector('#dailyQuota');
        if (dailyQuota && healthData.multiKeyStatus) {
            dailyQuota.textContent = healthData.multiKeyStatus.remainingCapacity || '--';
        }
    },

    startHealthChecking() {
        // Initial check
        this.checkAPIHealth();
        
        // Periodic checks every 5 minutes
        setInterval(() => {
            this.checkAPIHealth();
        }, 300000);
    }
};

// Enhanced App initialization
class AIImageGenerator {
    constructor() {
        this.init();
    }

    async init() {
        console.log('🎨 AI Image Generator initializing...');

        if (!initializeDOM()) {
            console.error('❌ Failed to initialize DOM elements');
            return;
        }

        try {
            // Initialize all modules
            characterCounter.init();
            sizeRatioHandler.init();
            formHandler.init();
            keyboardShortcuts.init();
            
            // Start health checking
            healthChecker.startHealthChecking();

            // Focus prompt input
            if (DOM.promptInput) {
                DOM.promptInput.focus();
            }

            // Add visual feedback for interactions
            this.addVisualFeedback();

            console.log('✅ AI Image Generator initialized successfully');
            console.log('🚀 Enhanced UI/UX with size ratio fixes enabled');
            
        } catch (error) {
            console.error('❌ Initialization failed:', error);
        }
    }

    addVisualFeedback() {
        // Add ripple effect to buttons
        const buttons = document.querySelectorAll('.generate-btn, .download-btn, .size-card');
        buttons.forEach(button => {
            button.addEventListener('click', this.createRipple);
        });
    }

    createRipple(e) {
        const button = e.currentTarget;
        const ripple = document.createElement('span');
        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        
        ripple.style.cssText = `
            position: absolute;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.3);
            width: ${size}px;
            height: ${size}px;
            left: ${x}px;
            top: ${y}px;
            animation: ripple 0.6s ease-out;
            pointer-events: none;
            z-index: 1000;
        `;
        
        button.style.position = 'relative';
        button.style.overflow = 'hidden';
        button.appendChild(ripple);
        
        setTimeout(() => {
            ripple.remove();
        }, 600);
    }
}

// Add ripple animation CSS
const rippleStyle = document.createElement('style');
rippleStyle.textContent = `
    @keyframes ripple {
        0% {
            transform: scale(0);
            opacity: 1;
        }
        100% {
            transform: scale(2);
            opacity: 0;
        }
    }
`;
document.head.appendChild(rippleStyle);

// Start app with enhanced DOM ready detection
function startApp() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('📄 DOM Content Loaded');
            new AIImageGenerator();
        });
    } else {
        console.log('📄 DOM Already Ready');
        new AIImageGenerator();
    }
}

// Start the application
startApp();
