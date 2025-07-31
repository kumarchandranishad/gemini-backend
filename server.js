// Image generation endpoint - ENHANCED RESPONSE PARSING
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
    
    // ENHANCED RESPONSE PARSING WITH DETAILED LOGGING
    console.log('🔍 Analyzing response structure...');
    console.log('Response candidates count:', result.response?.candidates?.length || 0);
    
    if (result.response && result.response.candidates && result.response.candidates[0]) {
      const candidate = result.response.candidates[0];
      console.log('📊 Candidate content parts count:', candidate.content?.parts?.length || 0);
      
      if (candidate.content && candidate.content.parts) {
        // Log all parts for debugging
        candidate.content.parts.forEach((part, index) => {
          console.log(`Part ${index}:`, {
            hasText: !!part.text,
            hasInlineData: !!part.inlineData,
            inlineDataType: part.inlineData?.mimeType,
            inlineDataSize: part.inlineData?.data?.length || 0
          });
        });
        
        // Try multiple extraction methods
        for (const part of candidate.content.parts) {
          // Method 1: Check inlineData.data (standard)
          if (part.inlineData && part.inlineData.data) {
            const imageData = part.inlineData.data;
            const mimeType = part.inlineData.mimeType || 'image/png';
            const imageUrl = `data:${mimeType};base64,${imageData}`;
            
            const processingTime = Date.now() - startTime;
            console.log(`🖼️ Image found via inlineData! Size: ${imageData.length} chars, Time: ${processingTime}ms`);
            
            return res.json({
              success: true,
              imageUrl: imageUrl,
              data: [{ url: imageUrl }],
              images: [imageUrl],
              prompt: finalPrompt,
              processingTime: processingTime,
              generated_at: new Date().toISOString(),
              method: 'inlineData'
            });
          }
          
          // Method 2: Check if part has binary data directly
          if (part.data && typeof part.data === 'string') {
            const imageUrl = `data:image/png;base64,${part.data}`;
            console.log(`🖼️ Image found via direct data! Size: ${part.data.length} chars`);
            
            return res.json({
              success: true,
              imageUrl: imageUrl,
              data: [{ url: imageUrl }],
              images: [imageUrl],
              prompt: finalPrompt,
              processingTime: Date.now() - startTime,
              generated_at: new Date().toISOString(),
              method: 'directData'
            });
          }
        }
      }
    }
    
    // If no image found, log full response structure for debugging
    console.log('❌ No image found - Full response structure:');
    console.log(JSON.stringify(result.response, null, 2));
    
    res.status(500).json({ 
      success: false,
      error: 'No image generated in response',
      debug: {
        candidatesCount: result.response?.candidates?.length || 0,
        partsCount: result.response?.candidates?.[0]?.content?.parts?.length || 0,
        responseKeys: Object.keys(result.response || {})
      }
    });
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('❌ Generation Error Details:', {
      message: error.message,
      stack: error.stack?.substring(0, 500),
      processingTime
    });
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to generate image: ' + error.message,
      processingTime
    });
  }
});
