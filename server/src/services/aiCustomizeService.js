import { GoogleGenAI } from '@google/genai';

const MAX_CUSTOMIZE_PARTS = 3;
const ANALYSIS_MODEL = process.env.GEMINI_ANALYSIS_MODEL || 'gemini-3.8-flash';
const IMAGEN_MODEL = process.env.IMAGEN_MODEL || 'imagen-3.0-generate-002';
const IMAGE_FALLBACK_MODEL = process.env.GEMINI_IMAGE_FALLBACK_MODEL || 'gemini-3.1-flash-image';
const IMAGE_CANDIDATE_MODELS = [
  process.env.GEMINI_IMAGE_FALLBACK_MODEL,
  'gemini-3.1-flash-image',
  'gemini-2.5-flash-image',
].filter((m, i, arr) => m && arr.indexOf(m) === i);

const SYSTEM_INSTRUCTION = `You are MotoTrack's senior automotive visualization director.
You receive:
1) bike — the customer's registered base motorcycle (must remain the exact same brand, model, body, frame, proportions, and colors).
2) 1 to 3 aftermarket motorcycle parts/accessories to install simultaneously on that same motorcycle.

Your job is to write ONE concise photorealistic image-generation prompt that:
- Keeps the exact same motorcycle model identity, body, frame, proportions, silhouette, paint colors, headlights, seat, and unrelated components from the bike photo.
- Visually installs ALL provided aftermarket parts simultaneously onto that single motorcycle in their correct mechanical mounting positions.
- Generates ONE single unified motorcycle image (never separate images, collages, split-screens, or insets).
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
      'Gemini API key is invalid or unauthorized. Please use a valid Google AI Studio key (starts with AIzaSy) from https://aistudio.google.com/apikey.'
    );
    friendly.status = 401;
    friendly.code = 'INVALID_API_KEY';
    return friendly;
  }

  if (typeof err?.status === 'number') return err;
  return err;
}

function getClient() {
  const apiKey = String(
    process.env.GEMINI_API_KEY ||
    process.env.EXPO_PUBLIC_GEMINI_API_KEY ||
    ''
  ).trim();
  if (!apiKey || apiKey.length < 10) {
    const err = new Error(
      'GEMINI_API_KEY is missing. Set it in server/.env or Vercel Environment Variables.'
    );
    err.status = 500;
    err.code = 'MISSING_API_KEY';
    throw err;
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

function resolvePartFilesList(partFile, partFiles) {
  const list =
    Array.isArray(partFiles) && partFiles.length > 0
      ? partFiles.filter(Boolean)
      : partFile
        ? [partFile]
        : [];
  if (list.length > MAX_CUSTOMIZE_PARTS) {
    const err = new Error('You can select a maximum of 3 products.');
    err.status = 400;
    err.code = 'MAX_PRODUCTS_EXCEEDED';
    throw err;
  }
  return list;
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

function formatPartLabel(metaProducts, idx) {
  const item = Array.isArray(metaProducts) ? metaProducts[idx] : null;
  if (!item) return '';
  const name = String(item.productName || item.product_name || item.name || '').trim();
  const brand = String(item.brand || '').trim();
  const category = String(item.category || '').trim();
  const position = String(item.installation_position || item.installationPosition || '').trim();
  return [
    name,
    brand ? `by ${brand}` : '',
    category ? `[${category}]` : '',
    position ? `mount at: ${position}` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Step A — Gemini analyzes bike + 1..3 parts and writes a single combined Imagen prompt.
 * Skipped when the client already sent a complete installation prompt.
 */
export async function buildImagenPromptFromImages({
  bikeFile,
  partFile,
  partFiles = [],
  customRequest = '',
  selectionMeta = null,
}) {
  const ai = getClient();
  const bikePart = toInlinePart(bikeFile);
  const resolvedParts = resolvePartFilesList(partFile, partFiles);
  const partInlineList = resolvedParts.map(toInlinePart).filter(Boolean);

  if (!bikePart || partInlineList.length === 0) {
    const err = new Error('Both bike and at least one part image are required.');
    err.status = 400;
    err.code = 'MISSING_IMAGES';
    throw err;
  }

  const totalImages = 1 + partInlineList.length;
  const metaProducts = selectionMeta?.products || [];
  const userNotes = String(customRequest || '').trim();

  const messageParts = [
    { text: `Image 1 of ${totalImages} — BASE MOTORCYCLE (keep this exact model, colors, and frame):` },
    bikePart,
  ];

  partInlineList.forEach((pInline, idx) => {
    const label = formatPartLabel(metaProducts, idx);
    messageParts.push({
      text: `Image ${idx + 2} of ${totalImages} — AFTERMARKET PART ${idx + 1} of ${partInlineList.length}${label ? ` (${label})` : ''} to install onto that motorcycle:`,
    });
    messageParts.push(pInline);
  });

  messageParts.push({
    text: userNotes
      ? `Rider custom request / notes: ${userNotes}\n\nWrite ONE combined Imagen prompt installing ALL ${partInlineList.length} selected part(s) onto the base motorcycle in a single unified photo.`
      : `Write ONE combined Imagen prompt installing ALL ${partInlineList.length} selected part(s) onto the base motorcycle in a single unified photo.`,
  });

  const response = await ai.models.generateContent({
    model: ANALYSIS_MODEL,
    contents: [
      {
        role: 'user',
        parts: messageParts,
      },
    ],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.35,
      maxOutputTokens: 850,
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
    'Single unified photorealistic motorcycle product photo, 4:3 aspect ratio.',
    'No people, no riders, no faces, no hands, no mannequins, no split screen or collage.',
    `Same motorcycle model as the reference bike; all ${partInlineList.length} selected aftermarket part(s) installed and mounted realistically together.`,
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
 * Preferred path: Gemini image model with base motorcycle + ALL 1..3 selected product reference images
 * + combined installation prompt, generating ONE unified preview image.
 * Imagen remains a text-only fallback because it cannot consume reference photos.
 */
export async function generateCustomMotorcycleImage(
  prompt,
  { bikeFile = null, partFile = null, partFiles = [], selectionMeta = null } = {}
) {
  const ai = getClient();
  const bikePart = toInlinePart(bikeFile);
  const resolvedParts = resolvePartFilesList(partFile, partFiles);
  const partInlineList = resolvedParts.map(toInlinePart).filter(Boolean);
  const metaProducts = selectionMeta?.products || [];
  let lastError = null;

  if (bikePart && partInlineList.length > 0) {
    const totalParts = partInlineList.length;
    const refRangeLabel =
      totalParts === 1
        ? 'REFERENCE IMAGE 2'
        : `REFERENCE IMAGE 2 through REFERENCE IMAGE ${totalParts + 1}`;

    const requestParts = [
      {
        text: 'REFERENCE IMAGE 1 — CUSTOMER BASE MOTORCYCLE IDENTITY, BODY, FRAME, PROPORTIONS, COLORS, AND BACKGROUND ENVIRONMENT (primary motorcycle reference):',
      },
      bikePart,
    ];

    partInlineList.forEach((pInline, idx) => {
      const label = formatPartLabel(metaProducts, idx);
      requestParts.push({
        text: `REFERENCE IMAGE ${idx + 2} — EXACT SELECTED PRODUCT ${idx + 1} OF ${totalParts}${label ? ` (${label})` : ''} (primary product reference #${idx + 1}):`,
      });
      requestParts.push(pInline);
    });

    requestParts.push({
      text: [
        String(prompt || '').trim(),
        '',
        'CRITICAL INSTRUCTIONS FOR COMBINED INSTALLATION ACCURACY:',
        '- Use REFERENCE IMAGE 1 as the exact base motorcycle identity, body, frame, proportions, colors, unrelated stock components, and background environment.',
        '- If REFERENCE IMAGE 1 has a solid white or clean studio background, KEEP THE EXACT SAME solid white/clean studio background with only subtle ground contact shadow.',
        '- Do NOT place the motorcycle in a garage, repair workshop, or mechanic bay unless REFERENCE IMAGE 1 already had that background.',
        '- Do NOT add tools, tire machines, or workshop clutter.',
        `- Use ${refRangeLabel} as the exact product identities for the ${totalParts} selected aftermarket part(s).`,
        `- Install ALL ${totalParts} selected aftermarket part(s) from ${refRangeLabel} SIMULTANEOUSLY onto the single motorcycle from REFERENCE IMAGE 1 in their correct mechanical mounting locations.`,
        `- Every single selected part (${totalParts} of ${totalParts}) MUST be clearly visible and accurately represented on the motorcycle.`,
        '- Do NOT generate separate images, collages, grids, insets, or split-screen views. Return ONE unified photorealistic photograph of the customized motorcycle.',
        '- Apply ONLY the selected aftermarket parts. Do not substitute the motorcycle, do not substitute any selected product, and do not invent unselected modifications.',
        '- No people, riders, faces, hands, or mannequins.',
      ].join('\n'),
    });

    for (const chosenModel of IMAGE_CANDIDATE_MODELS) {
      try {
        const withRefs = await ai.models.generateContent({
          model: chosenModel,
          contents: [
            {
              role: 'user',
              parts: requestParts,
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
          `Generated combined preview with motorcycle + ${totalParts} product reference image(s).`
        );
        if (fromRefs) return fromRefs;
      } catch (refErr) {
        const norm = normalizeGeminiError(refErr);
        if (norm.code === 'INVALID_API_KEY' || norm.code === 'QUOTA_EXCEEDED') {
          throw norm;
        }
        lastError = refErr;
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
    const norm = normalizeGeminiError(imagenErr);
    if (norm.code === 'INVALID_API_KEY' || norm.code === 'QUOTA_EXCEEDED') {
      throw norm;
    }
    lastError = imagenErr;
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
      const norm = normalizeGeminiError(_fallbackErr);
      if (norm.code === 'INVALID_API_KEY' || norm.code === 'QUOTA_EXCEEDED') {
        throw norm;
      }
      lastError = _fallbackErr;
    }
  }

  if (lastError) {
    throw normalizeGeminiError(lastError);
  }

  const err = new Error('Image generation returned no image data.');
  err.status = 502;
  err.code = 'IMAGE_EMPTY';
  throw err;
}

export async function customizeMotorcycle({
  bikeFile,
  partFile,
  partFiles = [],
  customRequest = '',
  installationPrompt = '',
  selectionMeta = null,
}) {
  try {
    const resolvedPartFiles = resolvePartFilesList(partFile, partFiles);
    if (resolvedPartFiles.length === 0) {
      const err = new Error('At least one product image is required.');
      err.status = 400;
      err.code = 'MISSING_IMAGES';
      throw err;
    }

    if (selectionMeta && typeof console !== 'undefined') {
      console.info('[aiCustomize] selection verify', {
        selectedMotorcycleId: selectionMeta.motorcycleId || null,
        selectedMotorcycleName: selectionMeta.motorcycleName || null,
        selectedCount: resolvedPartFiles.length,
        selectedProductIds:
          selectionMeta.productIds ||
          (Array.isArray(selectionMeta.products)
            ? selectionMeta.products.map((p) => p.productId || p.id)
            : [selectionMeta.productId].filter(Boolean)),
        selectedProductNames: Array.isArray(selectionMeta.products)
          ? selectionMeta.products.map((p) => p.productName || p.name)
          : [selectionMeta.productName].filter(Boolean),
      });
    }

    const providedPrompt = String(installationPrompt || customRequest || '').trim();
    const prompt = looksLikeFullInstallationPrompt(providedPrompt)
      ? providedPrompt
      : await buildImagenPromptFromImages({
          bikeFile,
          partFile: resolvedPartFiles[0],
          partFiles: resolvedPartFiles,
          customRequest: providedPrompt,
          selectionMeta,
        });

    const image = await generateCustomMotorcycleImage(prompt, {
      bikeFile,
      partFile: resolvedPartFiles[0],
      partFiles: resolvedPartFiles,
      selectionMeta,
    });
    const previewUrl = `data:${image.mimeType};base64,${image.base64}`;
    return {
      success: true,
      previewImageUrl: previewUrl,
      dataUrl: previewUrl,
      promptUsed: image.promptUsed || prompt,
      model: image.model,
      mimeType: image.mimeType,
      imageBase64: image.base64,
      partsInstalledCount: resolvedPartFiles.length,
      note: image.note || null,
    };
  } catch (err) {
    throw normalizeGeminiError(err);
  }
}
