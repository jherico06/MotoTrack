import { GoogleGenAI } from '@google/genai';

const ANALYSIS_MODEL = process.env.GEMINI_ANALYSIS_MODEL || 'gemini-2.5-flash';
const IMAGEN_MODEL = process.env.IMAGEN_MODEL || 'imagen-3.0-generate-002';
const IMAGE_FALLBACK_MODEL = process.env.GEMINI_IMAGE_FALLBACK_MODEL || 'gemini-2.5-flash-image';

const SYSTEM_INSTRUCTION = `You are MotoTrack's senior automotive visualization director.
You receive TWO images:
1) bike — the customer's registered base motorcycle (must remain the same brand/model/body).
2) part — an aftermarket motorcycle accessory/part to install on that bike.

Your job is to write ONE concise photorealistic image-generation prompt for Imagen that:
- Keeps the exact same motorcycle model identity, proportions, silhouette, headlights, and seat from the bike photo.
- Visually installs the accessory from the part photo onto the motorcycle in the correct mounting position.
- Looks like a commercial automotive studio render (photorealistic, 4:3, sharp detail).
- Contains NO people, riders, faces, hands, or mannequins.
- Does NOT turn the motorcycle into a different model or into a car.
- Does NOT invent unrelated parts.

Return ONLY the final image prompt as plain text. No markdown, no JSON, no quotes wrapper.`;

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim().length < 10) {
    const err = new Error('GEMINI_API_KEY is missing. Set it in server/.env');
    err.status = 500;
    err.code = 'MISSING_API_KEY';
    throw err;
  }
  return new GoogleGenAI({ apiKey: apiKey.trim() });
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

/**
 * Step A — Gemini 2.5 Flash analyzes bike + part and writes an Imagen prompt.
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

  // Hard constraints appended so Imagen never drifts into people / wrong vehicle class
  return [
    prompt,
    'Photorealistic motorcycle product photo, 4:3 aspect ratio.',
    'No people, no riders, no faces, no hands, no mannequins.',
    'Same motorcycle model as the reference bike; accessory installed and mounted realistically.',
  ].join(' ');
}

/**
 * Step B — Imagen 3 generation (with Gemini image fallback if Imagen is unavailable).
 */
export async function generateCustomMotorcycleImage(prompt) {
  const ai = getClient();

  // Preferred path: Imagen (as requested)
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
      };
    }
  } catch (imagenErr) {
    console.warn(
      `[aiCustomize] Imagen (${IMAGEN_MODEL}) unavailable, falling back:`,
      imagenErr?.message || imagenErr
    );
  }

  // Production fallback: Gemini native image model (Imagen 3 is deprecated/shut down on many keys)
  const fallback = await ai.models.generateContent({
    model: IMAGE_FALLBACK_MODEL,
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

  const parts = fallback?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const inline = part.inlineData || part.inline_data;
    if (inline?.data) {
      return {
        mimeType: inline.mimeType || inline.mime_type || 'image/png',
        base64: inline.data,
        model: IMAGE_FALLBACK_MODEL,
        promptUsed: prompt,
        note: `Imagen model unavailable; used ${IMAGE_FALLBACK_MODEL} fallback.`,
      };
    }
  }

  const err = new Error('Image generation returned no image data.');
  err.status = 502;
  err.code = 'IMAGE_EMPTY';
  throw err;
}

export async function customizeMotorcycle({ bikeFile, partFile, customRequest }) {
  const prompt = await buildImagenPromptFromImages({ bikeFile, partFile, customRequest });
  const image = await generateCustomMotorcycleImage(prompt);
  return {
    success: true,
    promptUsed: image.promptUsed || prompt,
    model: image.model,
    mimeType: image.mimeType,
    imageBase64: image.base64,
    dataUrl: `data:${image.mimeType};base64,${image.base64}`,
    note: image.note || null,
  };
}
