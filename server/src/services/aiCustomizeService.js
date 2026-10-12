import { GoogleGenAI } from '@google/genai';

const ANALYSIS_MODEL = process.env.GEMINI_ANALYSIS_MODEL || 'gemini-3.8-flash';
const IMAGEN_MODEL = process.env.IMAGEN_MODEL || 'imagen-3.0-generate-002';
const IMAGE_FALLBACK_MODEL = process.env.GEMINI_IMAGE_FALLBACK_MODEL || 'gemini-3.1-flash-image';
const IMAGE_CANDIDATE_MODELS = [
  process.env.GEMINI_IMAGE_FALLBACK_MODEL,
  'gemini-3.1-flash-image',
  'gemini-3-pro-image',
  'gemini-2.5-flash-image',
].filter((m, i, arr) => m && arr.indexOf(m) === i);

const SYSTEM_INSTRUCTION = `You are MotoTrack's senior automotive visualization director.
You receive TWO images:
1) bike — the customer's registered base motorcycle (must remain the same brand/model/body).
2) part — an aftermarket motorcycle accessory/part to install on that bike.

Your job is to write ONE concise photorealistic image-generation prompt for Imagen that:
- Keeps the exact same motorcycle model identity, proportions, silhouette, headlights, and seat from the bike photo.
- Visually installs the accessory from the part photo onto the motorcycle in the correct mounting position.
- Preserves the exact background of the base motorcycle photo: if the base motorcycle is on a white or neutral studio backdrop, the output MUST remain on the exact same clean, solid white/neutral studio backdrop. Do NOT place it in a garage, workshop, or outdoor environment unless the base photo had one.
- Looks like a commercial automotive studio render (photorealistic, 4:3, sharp detail).
- Contains NO people, riders, faces, hands, or mannequins.
- Does NOT turn the motorcycle into a different model or into a car.
- Does NOT invent unrelated parts.

Return ONLY the final image prompt as plain text. No markdown, no JSON, no quotes wrapper.`;

function normalizeGeminiError(err) {
  const raw = String(err?.message || err || '');
  let parsedMessage = raw;
  let parsedStatus = Number(err?.status) || null;
  try {
    const nested = JSON.parse(raw);
    parsedMessage = nested?.error?.message || nested?.message || raw;
    parsedStatus = Number(nested?.error?.code) || parsedStatus;
  } catch (_e) {
    // keep raw
  }

  const lower = parsedMessage.toLowerCase();
  if (
    parsedStatus === 429 ||
    lower.includes('resource_exhausted') ||
    lower.includes('exceeded your current quota') ||
    lower.includes('quota exceeded') ||
    lower.includes('limit: 0')
  ) {
    const friendly = new Error(
      'Gemini image quota is empty on this API key. Activate billing / add credits in Google AI Studio for the account that owns this key, then try again.'
    );
    friendly.status = 429;
    friendly.code = 'QUOTA_EXCEEDED';
    return friendly;
  }

  if (
    parsedStatus === 401 ||
    lower.includes('unauthenticated') ||
    lower.includes('invalid authentication') ||
    lower.includes('api key not valid') ||
    lower.includes('access_token_type_unsupported')
  ) {
    const friendly = new Error(
      'Gemini API key is invalid. Put a Google AI Studio key in server/.env as GEMINI_API_KEY, then restart the server.'
    );
    friendly.status = 401;
    friendly.code = 'INVALID_API_KEY';
    return friendly;
  }

  if (typeof err?.status === 'number') return err;
  return err;
}

function getClient() {
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey.length < 10) {
    const err = new Error('GEMINI_API_KEY is missing. Set it in server/.env');
    err.status = 500;
    err.code = 'MISSING_API_KEY';
    throw err;
  }
  if (!apiKey.startsWith('AIza')) {
    console.warn(
      '[aiCustomize] GEMINI_API_KEY does not look like a Google AI Studio key (expected prefix AIza). Current prefix:',
      apiKey.slice(0, 4)
    );
  }
  return new GoogleGenAI({ apiKey });
}

function toInlinePart(file) {
  if (!file?.buffer) return null;
  return {
    inlineData: {
      mimeType: file.mimetype || 'image/jpeg',
      data: file.buffer.toString('base64'),
    },
  };
}

function looksLikeFullInstallationPrompt(text = '') {
  const value = String(text || '').trim();
  if (value.length < 180) return false;
  const markers = [
    'PRIMARY motorcycle reference',
    'PRIMARY product reference',
    'Installation position:',
    'REFERENCE IMAGE 1',
  ];
  return markers.every((marker) => value.includes(marker));
}

/**
 * Step A — Gemini 2.5 Flash analyzes bike + part and writes an Imagen prompt.
 * Skipped when the client already sent a complete installation prompt.
 */
export async function buildImagenPromptFromImages({ bikeFile, partFile, customRequest = '' }) {
  const ai = getClient();
  const bikePart = toInlinePart(bikeFile);
  const partPart = toInlinePart(partFile);

  if (!bikePart || !partPart) {
    const err = new Error('Both bike and part images are required.');
    err.status = 400;
    err.code = 'MISSING_IMAGES';
    throw err;
  }

  const userNotes = String(customRequest || '').trim();
  const contents = [
    {
      role: 'user',
      parts: [
        { text: 'Image 1 of 2 — BASE MOTORCYCLE (keep this exact model):' },
        bikePart,
        { text: 'Image 2 of 2 — AFTERMARKET PART to install onto that motorcycle:' },
        partPart,
        {
          text: userNotes
            ? `Rider custom request / notes: ${userNotes}\n\nWrite the Imagen prompt now.`
            : 'Write the Imagen prompt now.',
        },
      ],
    },
  ];

  const response = await ai.models.generateContent({
    model: ANALYSIS_MODEL,
    contents,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.35,
      maxOutputTokens: 700,
    },
  });

  const prompt = String(response?.text || '')
    .replace(/^```[\w]*\n?/g, '')
    .replace(/```$/g, '')
    .trim();

  if (!prompt || prompt.length < 40) {
    const err = new Error('Gemini did not return a usable visualization prompt.');
    err.status = 502;
    err.code = 'PROMPT_EMPTY';
    throw err;
  }

  return [
    prompt,
    'Photorealistic motorcycle product photo, 4:3 aspect ratio.',
    'No people, no riders, no faces, no hands, no mannequins.',
    'Same motorcycle model as the reference bike; accessory installed and mounted realistically.',
  ].join(' ');
}

function extractGeneratedImage(response, model, prompt, note = null) {
  const parts = response?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const inline = part.inlineData || part.inline_data;
    if (inline?.data) {
      return {
        mimeType: inline.mimeType || inline.mime_type || 'image/png',
        base64: inline.data,
        model,
        promptUsed: prompt,
        note,
      };
    }
  }
  return null;
}

/**
 * Preferred path: Gemini image model with BOTH reference images + installation prompt.
 * Imagen remains a text-only fallback because it cannot consume reference photos.
 */
export async function generateCustomMotorcycleImage(prompt, { bikeFile = null, partFile = null } = {}) {
  const ai = getClient();
  const bikePart = toInlinePart(bikeFile);
  const partPart = toInlinePart(partFile);

  if (bikePart && partPart) {
    for (const chosenModel of IMAGE_CANDIDATE_MODELS) {
      try {
        const withRefs = await ai.models.generateContent({
          model: chosenModel,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: 'REFERENCE IMAGE 1 — MOTORCYCLE IDENTITY AND APPEARANCE (primary motorcycle reference):',
                },
                bikePart,
                {
                  text: 'REFERENCE IMAGE 2 — EXACT PRODUCT IDENTITY AND APPEARANCE (primary product reference):',
                },
                partPart,
                {
                  text: [
                    String(prompt || '').trim(),
                    '',
                    'CRITICAL INSTRUCTIONS FOR ACCURACY:',
                    '- Use REFERENCE IMAGE 1 as the motorcycle identity and background environment.',
                    '- If REFERENCE IMAGE 1 has a solid white or clean studio background, KEEP THE EXACT SAME solid white/clean studio background with only subtle ground contact shadow.',
                    '- Do NOT place the motorcycle in a garage, repair workshop, or mechanic bay unless REFERENCE IMAGE 1 already had that background.',
                    '- Do NOT add tools, tire machines, or workshop clutter.',
                    '- Use REFERENCE IMAGE 2 as the exact product identity.',
                    '- Install ONLY the selected product from REFERENCE IMAGE 2 onto the motorcycle from REFERENCE IMAGE 1.',
                    '- Do not substitute the motorcycle or the product.',
                    '- Return exactly one photorealistic image. No people, riders, faces, hands, or mannequins.',
                  ].join('\n'),
                },
              ],
            },
          ],
          config: {
            responseModalities: ['TEXT', 'IMAGE'],
            temperature: 0.25,
          },
        });

        const fromRefs = extractGeneratedImage(
          withRefs,
          chosenModel,
          prompt,
          'Generated with motorcycle + product reference images.'
        );
        if (fromRefs) return fromRefs;
      } catch (refErr) {
        console.warn(
          `[aiCustomize] Reference-image generation (${chosenModel}) failed, trying next:`,
          refErr?.message || refErr
        );
      }
    }
  }

  // Optional text-only Imagen path
  try {
    const imagenResponse = await ai.models.generateImages({
      model: IMAGEN_MODEL,
      prompt,
      config: {
        numberOfImages: 1,
        aspectRatio: '4:3',
        personGeneration: 'DONT_ALLOW',
      },
    });

    const imageBytes = imagenResponse?.generatedImages?.[0]?.image?.imageBytes;
    if (imageBytes) {
      return {
        mimeType: 'image/png',
        base64: imageBytes,
        model: IMAGEN_MODEL,
        promptUsed: prompt,
        note: 'Imagen text-only fallback (no reference images).',
      };
    }
  } catch (imagenErr) {
    console.warn(
      `[aiCustomize] Imagen (${IMAGEN_MODEL}) unavailable, falling back:`,
      imagenErr?.message || imagenErr
    );
  }

  // Final text-only Gemini image fallback
  for (const chosenModel of IMAGE_CANDIDATE_MODELS) {
    try {
      const fallback = await ai.models.generateContent({
        model: chosenModel,
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
          temperature: 0.3,
        },
      });

      const fromText = extractGeneratedImage(
        fallback,
        chosenModel,
        prompt,
        `Used ${chosenModel} text-only fallback.`
      );
      if (fromText) return fromText;
    } catch (_fallbackErr) {
      // try next
    }
  }

  const err = new Error('Image generation returned no image data.');
  err.status = 502;
  err.code = 'IMAGE_EMPTY';
  throw err;
}

export async function customizeMotorcycle({
  bikeFile,
  partFile,
  customRequest = '',
  installationPrompt = '',
  selectionMeta = null,
}) {
  try {
    if (selectionMeta && typeof console !== 'undefined') {
      console.info('[aiCustomize] selection verify', {
        selectedMotorcycleId: selectionMeta.motorcycleId || null,
        selectedMotorcycleName: selectionMeta.motorcycleName || null,
        selectedMotorcycleImage: selectionMeta.motorcycleImage || null,
        selectedProductId: selectionMeta.productId || null,
        selectedProductName: selectionMeta.productName || null,
        selectedProductImage: selectionMeta.productImage || null,
      });
    }

    const providedPrompt = String(installationPrompt || customRequest || '').trim();
    const prompt = looksLikeFullInstallationPrompt(providedPrompt)
      ? providedPrompt
      : await buildImagenPromptFromImages({
          bikeFile,
          partFile,
          customRequest: providedPrompt,
        });

    const image = await generateCustomMotorcycleImage(prompt, { bikeFile, partFile });
    const previewUrl = `data:${image.mimeType};base64,${image.base64}`;
    return {
      success: true,
      previewImageUrl: previewUrl,
      dataUrl: previewUrl,
      promptUsed: image.promptUsed || prompt,
      model: image.model,
      mimeType: image.mimeType,
      imageBase64: image.base64,
      note: image.note || null,
    };
  } catch (err) {
    throw normalizeGeminiError(err);
  }
}
