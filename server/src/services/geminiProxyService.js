import { GoogleGenAI } from '@google/genai';

function getApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim().length < 10) {
    const err = new Error('GEMINI_API_KEY is missing. Set it in server/.env');
    err.status = 500;
    err.code = 'MISSING_API_KEY';
    throw err;
  }
  return apiKey.trim();
}

/**
 * Proxy text (and optional inline image) generation for the MotoTrack client.
 * The API key never leaves the server.
 */
export async function proxyGenerateContent({
  promptText,
  model,
  inlineImageBase64 = null,
  inlineImageMime = 'image/jpeg',
  temperature = 0.4,
} = {}) {
  const apiKey = getApiKey();
  const chosen =
    model ||
    process.env.GEMINI_ANALYSIS_MODEL ||
    process.env.GEMINI_MODEL ||
    'gemini-2.5-flash';

  const parts = [];
  if (inlineImageBase64) {
    parts.push({
      inline_data: {
        mime_type: inlineImageMime || 'image/jpeg',
        data: inlineImageBase64,
      },
    });
  }
  parts.push({ text: String(promptText || '') });

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${chosen}:generateContent?key=${apiKey}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature },
    }),
  });

  const resData = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(resData?.error?.message || `Gemini returned ${response.status}`);
    err.status = response.status;
    err.code = 'GEMINI_PROXY_ERROR';
    throw err;
  }

  const text =
    resData?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('\n') ||
    '';

  return {
    success: true,
    text,
    model: chosen,
    raw: resData,
  };
}

/**
 * Image generation proxy (responseModalities TEXT+IMAGE).
 */
export async function proxyGenerateImage({
  promptText,
  model,
  inlineImageBase64 = null,
  inlineImageMime = 'image/jpeg',
} = {}) {
  const apiKey = getApiKey();
  const candidates = [
    model,
    process.env.GEMINI_IMAGE_FALLBACK_MODEL,
    'gemini-2.5-flash-image',
  ].filter((m, i, arr) => m && arr.indexOf(m) === i);

  let lastError = 'Gemini image generation failed.';
  for (const chosen of candidates) {
    const parts = [];
    if (inlineImageBase64) {
      parts.push({
        inline_data: { mime_type: inlineImageMime || 'image/jpeg', data: inlineImageBase64 },
      });
    }
    parts.push({ text: String(promptText || '') });

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${chosen}:generateContent?key=${apiKey}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          temperature: 0.2,
        },
      }),
    });
    const resData = await response.json().catch(() => ({}));
    if (!response.ok) {
      lastError = resData?.error?.message || `Gemini ${chosen} returned ${response.status}`;
      continue;
    }
    const partsOut = resData?.candidates?.[0]?.content?.parts || [];
    for (const part of partsOut) {
      const inline = part.inlineData || part.inline_data;
      if (inline?.data) {
        const mime = inline.mimeType || inline.mime_type || 'image/png';
        return {
          success: true,
          previewImageUrl: `data:${mime};base64,${inline.data}`,
          model: chosen,
          poweredBy: `Google Gemini (${chosen})`,
        };
      }
    }
    lastError = `Gemini ${chosen} returned no image data.`;
  }
  const err = new Error(lastError);
  err.status = 502;
  err.code = 'GEMINI_IMAGE_FAILED';
  throw err;
}

export function hasGeminiKey() {
  try {
    getApiKey();
    return true;
  } catch {
    return false;
  }
}
