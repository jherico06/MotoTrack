import { GoogleGenAI } from '@google/genai';

const MAX_CUSTOMIZE_PARTS = 3;
const ANALYSIS_MODEL = process.env.GEMINI_ANALYSIS_MODEL || 'gemini-3.8-flash';
const ANALYSIS_CANDIDATE_MODELS = [
  process.env.GEMINI_ANALYSIS_MODEL,
  'gemini-3.8-flash',
  'gemini-2.5-flash',
].filter(
  (m, i, arr) =>
    m &&
    !String(m).includes('1.5') &&
    !String(m).includes('2.0') &&
    arr.indexOf(m) === i
);
const IMAGEN_MODEL = process.env.IMAGEN_MODEL || 'imagen-3.0-generate-002';
const IMAGE_FALLBACK_MODEL = process.env.GEMINI_IMAGE_FALLBACK_MODEL || 'gemini-3.1-flash-image';
const IMAGE_CANDIDATE_MODELS = [
  process.env.GEMINI_IMAGE_FALLBACK_MODEL,
  'gemini-3.1-flash-image',
  'gemini-2.5-flash-image',
].filter((m, i, arr) => m && arr.indexOf(m) === i);

const SYSTEM_INSTRUCTION = `You are MotoTrack's Lead Forensic Automotive Photo Editor and Visual Specification Director.
You receive:
1) REFERENCE IMAGE 1 (bike) — the customer's registered base motorcycle photograph.
2) REFERENCE IMAGE 2..N (parts) — 1 to 3 aftermarket motorcycle parts/accessories to surgically install onto REFERENCE IMAGE 1.

Your job is to inspect every image carefully and write a concise, ultra-precise SURGICAL PHOTO-EDITING SPECIFICATION that describes:
1. BASE MOTORCYCLE VISUAL LOCK (from REFERENCE IMAGE 1):
   - Exact camera angle (e.g. front-right 3/4 view), framing, and background (e.g. solid pure white studio backdrop).
   - Exact paint color of each body panel (front fender color, front nose fairing color, headlight cowl color, side fairing color, and decal colors).
   - Exact stock hardware that MUST remain untouched if not selected for replacement: front and rear brake type (explicitly state whether the front wheel has a DRUM brake with cable or a DISC brake rotor/caliper!), rear passenger grab bar / pillion rail behind the seat, exhaust muffler, forks, and tires.
2. FOR EACH SELECTED AFTERMARKET PART (from REFERENCE IMAGE 2..N):
   - Exact visual appearance extracted ONLY from the part itself (ignore any shop counter, glass display case, floor, packaging, or duplicate display angle in the product photo).
   - Exact sub-component colors, materials, textures, and logos:
     * For Wheel/Rims: distinguish the outer rim ring color/finish and rim stickers from the spoke color (e.g. keep bright silver/white wire spokes silver/white and black spoke nipples black — never bleed red rim color onto silver spokes!) and center hub color. Install on BOTH front and rear wheels inside the existing black tires while preserving REFERENCE IMAGE 1's exact front/rear brake type (never turn a drum brake into a disc brake!).
     * For Side Mirrors: note the stem style (e.g. short black CNC folding stem) and housing shape/color (e.g. black pentagon shell with blue glass). State that BOTH original OEM mirrors AND their tall stock wire stems must be completely removed, and the new mirrors mounted on the left and right handlebars with reflective glass facing REARWARD toward the rider (so from a front or front-3/4 camera angle, the viewer sees the black back housing shell and short CNC stems facing forward, NEVER both blue mirror glasses facing forward like headlights!).
     * For Seats/Seat Covers: note the surface texture (e.g. matte black horizontal ribbed grip texture) and exact logo/text placement (e.g. red Suzuki 'S' logo and white 'SUZUKI' text on the rear top section), mapped in natural 3D foreshortened perspective onto the seat while strictly preserving the rear passenger grab bar / pillion rail behind the seat.
     * For Exhausts, Brakes, Suspension, Lighting, Handlebars, Top Boxes, or Bodywork: state the exact stock part removed and exact mounting position, angle, and hardware.

Return ONLY the final surgical photo-editing specification in plain text. No markdown code fences, no JSON, no quotes wrapper.`;

const IMAGE_EDIT_SYSTEM_INSTRUCTION = `You are a precision automotive photo-editing and compositing engine for MotoTrack.
You perform SURGICAL IN-PLACE COMPONENT REPLACEMENT directly on REFERENCE IMAGE 1.
- Treat REFERENCE IMAGE 1 as a locked master photograph: keep the exact same camera angle, bike pose, proportions, lighting, solid background, front fender color, nose cone color, headlight cowl color, side fairings, factory decals, rear passenger grab bar, and brake type (drum vs disc).
- Replace ONLY the specific stock component(s) corresponding to REFERENCE IMAGE 2..N with the exact aftermarket product(s) shown in REFERENCE IMAGE 2..N.
- Completely remove any replaced stock part (never leave old tall OEM mirror stems under new mirrors).
- Orient every installed part in true 3D mechanical perspective matching REFERENCE IMAGE 1 (side mirror glass must face rearward toward the rider so front-3/4 views show the mirror's back shell, never blue glass facing forward; top-down seat cover textures/logos must be foreshortened onto the 3D seat without deleting the rear grab rail; colored wheel rims must keep silver wire spokes silver and preserve front drum brakes without inventing disc rotors).`;

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

const MARKETING_TAGS = new Set([
  'newarrival',
  'new arrival',
  'bestseller',
  'best seller',
  'featured',
  'hot',
  'sale',
  'promo',
  'default',
]);

function inferPartSpec(item = {}) {
  const name = String(item.productName || item.product_name || item.name || '').trim();
  const rawCat = String(item.category || '').trim();
  const cat = MARKETING_TAGS.has(rawCat.toLowerCase()) ? '' : rawCat;
  const rawBrand = String(item.brand || '').trim();
  const hay = `${name} ${cat}`.toLowerCase();

  let canonicalCategory = cat || 'Aftermarket Part';
  let position = String(
    item.installation_position || item.installationPosition || item.position || ''
  ).trim();
  let surgicalRule = String(
    item.installation_description || item.installationDescription || ''
  ).trim();

  if (/\b(mirror|side mirror|rearview)\b/.test(hay)) {
    canonicalCategory = 'Side Mirror (Left & Right Pair)';
    position = position || 'Left and right handlebar mirror mounting points';
    surgicalRule =
      'Completely REMOVE both original OEM side mirrors AND their tall stock wire stems from the handlebars. Install a matching left-and-right pair of these exact aftermarket mirrors using their own short low-profile black CNC/folding stems shown in this reference photo. CRITICAL 3D ORIENTATION (ZERO BLUE GLASS VISIBLE FROM FRONT): Product photos of side mirrors often display two mirrors (one showing the rider-facing blue glass side and one showing the forward-facing matte black ribbed pentagon back housing shell). Because the motorcycle in REFERENCE IMAGE 1 is viewed from the front / front-3/4 angle (looking toward the headlight), BOTH installed left and right mirrors MUST show ONLY their solid MATTE BLACK RIBBED BACK HOUSING SHELL facing toward the camera — ZERO blue mirror glass may be visible from the front of the motorcycle! Ignore any duplicate display mirror or loose unmounted clamp adapter in the product photo.';
  } else if (/\b(rim|wheel|spoke|alloy|mag)\b/.test(hay)) {
    canonicalCategory = 'Wheel Rim (Front & Rear Pair)';
    position = position || 'Front and rear wheel assemblies inside existing rubber tires';
    surgicalRule =
      'Replace BOTH the front and rear wheel assemblies inside the motorcycle’s existing black rubber tires with this exact rim and hub. Match BOTH the outer rim ring anodized color/finish (and white rim decal/sticker) AND the center wheel hub color (if the center hub in this reference photo is glossy anodized red, render BOTH the front and rear installed center wheel hubs in glossy anodized red!), while keeping the wire spokes bright metallic silver/white with black spoke nipples (do NOT tint the silver wire spokes red!). CRITICAL BRAKE RULE: Preserve the exact front and rear brake mechanism from REFERENCE IMAGE 1 (if REFERENCE IMAGE 1 has a front drum brake with cable, keep the drum brake plate/arm — do NOT invent or add a disc brake rotor or caliper!). Ignore any shop counter, glass display case, floor, or background behind the rim in this product photo.';
  } else if (/\b(seat|saddle)\b/.test(hay)) {
    canonicalCategory = 'Motorcycle Seat / Saddle Cover';
    position = position || 'Seat mount / subframe';
    surgicalRule =
      'Replace ONLY the seat cushion upholstery on top of the subframe with this exact seat cover material, surface texture (e.g. horizontal ribbed non-slip grip lines), and rear top brand logo/emblem (e.g. red Suzuki S emblem and white SUZUKI text), foreshortened naturally in 3D perspective to match REFERENCE IMAGE 1’s viewing angle. CRITICAL: Keep the original 3D seat profile/thickness and DO NOT remove, cover, or alter the rear passenger grab bar / pillion handle behind the seat!';
  } else if (/\b(exhaust|muffler|silencer|slip-on|slip on|pipe)\b/.test(hay)) {
    canonicalCategory = 'Exhaust System / Muffler';
    position = position || 'Exhaust header outlet & rear passenger peg hanger';
    surgicalRule =
      'Completely remove the stock OEM exhaust muffler/canister and mount this exact aftermarket exhaust canister and pipe along the stock exhaust routing and hanger bracket. Keep the swingarm, rear shock, rear wheel, and brake assembly intact.';
  } else if (/\b(brake disc|brake disk|rotor|disc brake)\b/.test(hay)) {
    canonicalCategory = 'Brake Disc Rotor';
    position = position || 'Wheel hub brake rotor mount';
    surgicalRule =
      'Mount this exact brake disc rotor onto the wheel hub with accurate carrier color, outer rotor ring pattern, and caliper alignment.';
  } else if (/\b(caliper|master cylinder|lever|brake)\b/.test(hay)) {
    canonicalCategory = 'Brake Component';
    position = position || 'Lower fork caliper mount or handlebar lever perch';
    surgicalRule =
      'Install this exact brake component at the correct caliper mount or handlebar lever perch with realistic hardware alignment.';
  } else if (/\b(suspension|shock|absorber|fork|monoshock)\b/.test(hay)) {
    canonicalCategory = 'Suspension / Shock Absorber';
    position = position || 'Rear suspension mount or front fork assembly';
    surgicalRule =
      'Replace the suspension component at the exact mounting points with matching spring color, reservoir canister, and damper body.';
  } else if (/\b(top box|topcase|top case|luggage|trunk)\b/.test(hay)) {
    canonicalCategory = 'Rear Top Box';
    position = position || 'Rear luggage rack behind passenger seat';
    surgicalRule =
      'Mount this exact top box securely on the rear rack behind the passenger seat facing forward with proper baseplate hardware.';
  }

  const lowerBrand = rawBrand.toLowerCase();
  const isExhaustBrandOnNonExhaust =
    (lowerBrand.includes('akrapov') || lowerBrand.includes('yoshimura') || lowerBrand.includes('sc project')) &&
    !canonicalCategory.toLowerCase().includes('exhaust');
  const safeBrand = isExhaustBrandOnNonExhaust ? '' : rawBrand;

  const label = [
    name || canonicalCategory,
    safeBrand ? `by ${safeBrand}` : '',
    `[${canonicalCategory}]`,
    position ? `mount at: ${position}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    name: name || canonicalCategory,
    brand: safeBrand,
    category: canonicalCategory,
    position: position || 'Correct OEM mounting location for this part category',
    surgicalRule,
    label,
  };
}

function formatPartLabel(metaProducts, idx) {
  const item = Array.isArray(metaProducts) ? metaProducts[idx] : null;
  if (!item) return '';
  return inferPartSpec(item).label;
}

/**
 * Step A — Gemini analyzes bike + 1..3 parts and writes a single combined surgical specification.
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
    {
      text: `Image 1 of ${totalImages} — REFERENCE IMAGE 1: BASE MOTORCYCLE (lock this exact camera angle, background, body panels, panel paint colors, decals, front/rear brake type [drum vs disc], and rear passenger grab bar):`,
    },
    bikePart,
  ];

  partInlineList.forEach((pInline, idx) => {
    const spec = inferPartSpec(metaProducts[idx] || {});
    messageParts.push({
      text: [
        `Image ${idx + 2} of ${totalImages} — REFERENCE IMAGE ${idx + 2}: AFTERMARKET PART ${idx + 1} of ${partInlineList.length} (${spec.label}):`,
        spec.surgicalRule ? `Mandatory mounting & orientation rule for Part ${idx + 1}: ${spec.surgicalRule}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    });
    messageParts.push(pInline);
  });

  messageParts.push({
    text: [
      userNotes ? `Additional installation context:\n${userNotes}` : '',
      `Write ONE concise, high-precision surgical photo-editing specification to install ALL ${partInlineList.length} selected part(s) onto the base motorcycle in REFERENCE IMAGE 1 in a single unified photo without changing any non-replaced motorcycle parts, panel colors, brake types, or rear grab bar.`,
    ]
      .filter(Boolean)
      .join('\n\n'),
  });

  let lastAnalysisErr = null;
  for (const modelName of ANALYSIS_CANDIDATE_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            role: 'user',
            parts: messageParts,
          },
        ],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.2,
          maxOutputTokens: 1200,
        },
      });

      const prompt = String(response?.text || '')
        .replace(/^```[\w]*\n?/g, '')
        .replace(/```$/g, '')
        .trim();

      if (prompt && prompt.length >= 40) {
        return [
          prompt,
          'Single unified photorealistic in-place edited motorcycle studio photo matching REFERENCE IMAGE 1 camera angle and background.',
          'No people, no riders, no faces, no hands, no mannequins, no split screen or collage.',
          `Exact same motorcycle body, panel colors, rear grab bar, and brake type as REFERENCE IMAGE 1; all ${partInlineList.length} selected aftermarket part(s) surgically installed together.`,
        ].join(' ');
      }
    } catch (err) {
      const norm = normalizeGeminiError(err);
      if (norm.code === 'INVALID_API_KEY') {
        throw norm;
      }
      lastAnalysisErr = norm;
    }
  }

  if (lastAnalysisErr) throw lastAnalysisErr;
  const err = new Error('Gemini did not return a usable visualization prompt.');
  err.status = 502;
  err.code = 'PROMPT_EMPTY';
  throw err;
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
        text: [
          'REFERENCE IMAGE 1 — MASTER BASE MOTORCYCLE PHOTOGRAPH (PRIMARY MOTORCYCLE REFERENCE):',
          'Keep this exact camera angle, bike pose, solid studio background, front fender color, nose fairing color, headlight cowl color, side fairings, factory decals, rear passenger grab bar (pillion rail), and front/rear brake system type (drum vs disc).',
        ].join('\n'),
      },
      bikePart,
    ];

    partInlineList.forEach((pInline, idx) => {
      const spec = inferPartSpec(metaProducts[idx] || {});
      requestParts.push({
        text: [
          `REFERENCE IMAGE ${idx + 2} — EXACT SELECTED PRODUCT ${idx + 1} OF ${totalParts} (${spec.label}) (PRIMARY PRODUCT REFERENCE #${idx + 1}):`,
          spec.surgicalRule
            ? `SURGICAL INSTALLATION & 3D ORIENTATION RULE FOR PART ${idx + 1}: ${spec.surgicalRule}`
            : 'Extract ONLY the physical motorcycle part from this reference image (ignore any shop counter, table, or duplicate display angle) and mount it in its exact mechanical location on REFERENCE IMAGE 1.',
        ].join('\n'),
      });
      requestParts.push(pInline);
    });

    requestParts.push({
      text: [
        String(prompt || '').trim(),
        '',
        'CRITICAL INSTRUCTIONS FOR SURGICAL IN-PLACE INSTALLATION ACCURACY:',
        '- Perform a direct in-place edit on REFERENCE IMAGE 1. Do NOT re-shoot from a different angle and do NOT redesign the motorcycle.',
        '- Preserve the exact panel-by-panel paint colors and finishes from REFERENCE IMAGE 1 (for example, if REFERENCE IMAGE 1 has a glossy black front fender and glossy black upper headlight cowl with a gray/silver middle nose fairing, keep the front fender and upper headlight cowl glossy black — never bleed the nose fairing color onto the front fender or headlight cowl!).',
        '- If REFERENCE IMAGE 1 has a solid white or clean studio background, KEEP THE EXACT SAME solid white/clean studio background with only subtle ground contact shadow.',
        '- Do NOT place the motorcycle in a garage, repair workshop, or mechanic bay unless REFERENCE IMAGE 1 already had that background.',
        '- Do NOT add tools, tire machines, or workshop clutter.',
        `- Use ${refRangeLabel} as the exact product identities for the ${totalParts} selected aftermarket part(s).`,
        `- Install ALL ${totalParts} selected aftermarket part(s) from ${refRangeLabel} SIMULTANEOUSLY onto the single motorcycle from REFERENCE IMAGE 1 in their correct mechanical mounting locations.`,
        `- Every single selected part (${totalParts} of ${totalParts}) MUST be clearly visible and accurately represented on the motorcycle:`,
        '  * Side Mirrors: completely remove BOTH original OEM mirrors AND their tall stock wire stems; mount the new mirrors on the left and right handlebars with their short black CNC/folding stems; orient the mirror glass facing REARWARD toward the rider so a front-3/4 view shows ONLY the solid matte black ribbed back housing shell facing forward toward the camera — ZERO blue mirror glass may be visible from the front of the motorcycle!',
        '  * Wheel Rims: replace BOTH front and rear rims and hubs inside the existing black rubber tires; match BOTH the outer rim lip color/decal AND the center wheel hub color (if the center hub in the product reference image is glossy red, make the installed front and rear wheel center hubs glossy red!), keep the wire spokes bright metallic silver/white with black nipples, and keep REFERENCE IMAGE 1’s exact brake mechanism (if front is a drum brake with cable, keep the drum brake — never add a fake disc brake rotor or caliper!).',
        '  * Seat / Seat Cover: apply the exact seat texture (e.g. horizontal ribbed non-slip lines) and rear top brand emblem/logo in natural 3D foreshortened perspective on the seat cushion, and strictly KEEP the rear passenger grab bar (pillion rail) behind the seat intact!',
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
            systemInstruction: IMAGE_EDIT_SYSTEM_INSTRUCTION,
            responseModalities: ['TEXT', 'IMAGE'],
            temperature: 0.15,
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
        if (norm.code === 'INVALID_API_KEY') {
          throw norm;
        }
        lastError = norm;
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
