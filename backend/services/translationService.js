/**
 * Dynamic Multilingual Translation Service
 * Supports dynamic Tamil <-> English, Hindi <-> English, etc.
 * Uses live translation endpoint with robust graceful fallback.
 */

async function translateText(text, targetLang = 'en', sourceLang = 'auto') {
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return {
      success: false,
      original_text: text,
      translated_text: text,
      source_lang: sourceLang,
      target_lang: targetLang,
      message: 'Empty text'
    };
  }

  const cleanText = text.trim();

  // Simple script detection if source is auto
  let detectedSource = sourceLang;
  if (sourceLang === 'auto') {
    const isTamil = /[\u0B80-\u0BFF]/.test(cleanText);
    const isHindi = /[\u0900-\u097F]/.test(cleanText);
    if (isTamil) detectedSource = 'ta';
    else if (isHindi) detectedSource = 'hi';
    else detectedSource = 'en';
  }

  // If source and target are the same, return as-is
  if (detectedSource === targetLang) {
    return {
      success: true,
      original_text: cleanText,
      translated_text: cleanText,
      source_lang: detectedSource,
      target_lang: targetLang,
      is_translated: false
    };
  }

  try {
    const langPair = `${detectedSource}|${targetLang}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanText)}&langpair=${encodeURIComponent(langPair)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.responseData && data.responseData.translatedText) {
        let resultText = data.responseData.translatedText;
        // Clean any HTML entities
        resultText = resultText
          .replace(/&#39;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>');

        return {
          success: true,
          original_text: cleanText,
          translated_text: resultText,
          source_lang: detectedSource,
          target_lang: targetLang,
          is_translated: true,
          match_quality: data.responseData.match
        };
      }
    }
    
    // Fallback if API response empty
    return {
      success: false,
      original_text: cleanText,
      translated_text: cleanText,
      source_lang: detectedSource,
      target_lang: targetLang,
      is_translated: false,
      note: 'Translation service unavailable; original text preserved.'
    };
  } catch (err) {
    // Graceful error fallback
    return {
      success: false,
      original_text: cleanText,
      translated_text: cleanText,
      source_lang: detectedSource,
      target_lang: targetLang,
      is_translated: false,
      error: err.message,
      note: 'Translation request timed out; original message preserved.'
    };
  }
}

module.exports = {
  translateText
};
