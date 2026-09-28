// Google Gemini API Client wrapper
import { safeGetItem } from './utils/storage.js';

const GEMINI_API_KEY = typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY
  ? import.meta.env.VITE_GEMINI_API_KEY
  : '';

export async function callGemini(prompt, systemInstruction = '') {
  const activeKey = GEMINI_API_KEY || safeGetItem('custom_gemini_api_key', '');

  if (!activeKey) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${activeKey}`;

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemInstruction ? `[SYSTEM INSTRUCTION: ${systemInstruction}]\n\n` : ''}${prompt}` }]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1000
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson?.error?.message || `Gemini API HTTP ${response.status}`);
    }

    const data = await response.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return candidateText.trim();
  } catch (err) {
    console.error('Gemini API Error:', err.message || err);
    return null;
  }
}
