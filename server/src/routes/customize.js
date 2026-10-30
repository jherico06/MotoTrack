import { Router } from 'express';
import { uploadBikeAndPart, MAX_CUSTOMIZE_PARTS } from '../middleware/upload.js';
import { customizeMotorcycle } from '../services/aiCustomizeService.js';
import { proxyGenerateContent, proxyGenerateImage, hasGeminiKey } from '../services/geminiProxyService.js';
import {
  checkAiUsage,
  getVerifiedUser,
  acquireLock,
  releaseLock,
  recordSuccessfulGeneration,
  recordFailedGeneration,
} from '../services/aiRateLimitService.js';

const router = Router();

async function resolveImageInput(fileObj, rawTarget, fallbackName = 'image.jpg') {
  if (fileObj?.buffer) return fileObj;
  const target = String(rawTarget || '').trim();
  if (!target) return null;

  try {
    if (target.startsWith('data:')) {
      const [metaPart, rawB64] = target.split(',');
      const mime = metaPart.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
      const buffer = Buffer.from(rawB64 || metaPart, 'base64');
      return {
        buffer,
        mimetype: mime,
        originalname: fallbackName,
        size: buffer.length,
      };
    }
    if (/^https?:\/\//i.test(target)) {
      const resp = await fetch(target);
      if (resp.ok) {
        const arrayBuf = await resp.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        return {
          buffer,
          mimetype: resp.headers.get('content-type') || 'image/jpeg',
          originalname: fallbackName,
          size: buffer.length,
        };
      }
    }
  } catch (err) {
    console.warn(`[customize] Failed to resolve ${fallbackName}:`, err?.message || err);
  }
  return null;
}

function parseJsonSafe(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch (_e) {
    return null;
  }
}

/**
 * GET /api/customize/usage
 * Returns current customer rate-limit counts & cooldown status.
 */
router.get('/customize/usage', async (req, res) => {
  try {
    const userId = String(
      req.headers['x-user-id'] ||
      req.headers['x-admin-user-id'] ||
      req.headers['x-mototrack-user-id'] ||
      req.query?.userId ||
      req.query?.user_id ||
      ''
    ).trim();

    if (!userId) {
      return res.status(401).json({
        success: false,
        allowed: false,
        error: 'Authentication required to check AI preview limits.',
        code: 'UNAUTHENTICATED',
      });
    }

    const user = (await getVerifiedUser(userId)) || {
      user_id: userId || 'usr-customer-01',
      role: 'user',
      status: 'active',
      email: `${userId || 'customer'}@mototrack.com`,
      name: 'MotoTrack Rider',
    };

    const usage = await checkAiUsage(user.user_id, user);
    return res.status(200).json({
      success: true,
      ...usage,
    });
  } catch (err) {
    console.error('[GET /api/customize/usage]', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to check AI usage.',
    });
  }
});

/**
 * POST /api/customize
 * multipart/form-data:
 *   - bike: image file (required) — motorcycle identity reference
 *   - part_0..part_2 / parts / part: 1 to 3 product identity reference images (max 3)
 *   - installationPrompt / customRequest: string (optional full install prompt)
 *   - selectionMeta: JSON string (optional debug & multi-part association payload)
 */
router.post('/customize', uploadBikeAndPart, async (req, res) => {
  let lockedUserId = null;
  try {
    const selectionMeta = parseJsonSafe(req.body?.selectionMeta || req.body?.selection_meta);

    // 0. Strict Backend Validation: Maximum 3 products & no duplicate product IDs
    const metaProducts = Array.isArray(selectionMeta?.products) ? selectionMeta.products : [];
    const metaProductIds = Array.isArray(selectionMeta?.productIds)
      ? selectionMeta.productIds
      : metaProducts.map((p) => p?.productId || p?.product_id || p?.id).filter(Boolean);

    const parsedPartUrls = (() => {
      const raw = req.body?.partUrls || req.body?.part_urls;
      if (!raw) return [];
      const parsed = parseJsonSafe(raw);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
      if (typeof raw === 'string' && raw.trim()) return [raw.trim()];
      return [];
    })();

    const indexedSlotIndices = [0, 1, 2, 3, 4].filter(
      (idx) =>
        Boolean(req.files?.[`part_${idx}`]?.[0]) ||
        Boolean(
          req.body?.[`part_${idx}Url`] ||
            req.body?.[`part_${idx}Uri`] ||
            req.body?.[`part_${idx}Base64`]
        )
    );
    const arrayPartFiles = [
      ...(Array.isArray(req.files?.parts) ? req.files.parts : []),
      ...(Array.isArray(req.files?.part) ? req.files.part : []),
    ];

    const declaredCount = Math.max(
      metaProducts.length,
      metaProductIds.length,
      parsedPartUrls.length,
      indexedSlotIndices.length,
      arrayPartFiles.length
    );

    if (declaredCount > MAX_CUSTOMIZE_PARTS) {
      return res.status(400).json({
        success: false,
        code: 'MAX_PRODUCTS_EXCEEDED',
        error: 'You can select a maximum of 3 products.',
        message: 'You can select a maximum of 3 products.',
      });
    }

    if (metaProductIds.length > 1) {
      const normalizedIds = metaProductIds.map((id) => String(id).trim()).filter(Boolean);
      if (new Set(normalizedIds).size !== normalizedIds.length) {
        return res.status(400).json({
          success: false,
          code: 'DUPLICATE_PRODUCTS',
          error: 'Duplicate products cannot be selected in the same customization session.',
          message: 'Duplicate products cannot be selected in the same customization session.',
        });
      }
    }

    const userId = String(
      req.headers['x-user-id'] ||
      req.headers['x-admin-user-id'] ||
      req.headers['x-mototrack-user-id'] ||
      req.body?.userId ||
      req.body?.user_id ||
      selectionMeta?.userId ||
      selectionMeta?.user_id ||
      'usr-customer-01'
    ).trim();

    const user = (await getVerifiedUser(userId)) || {
      user_id: userId || 'usr-customer-01',
      role: 'user',
      status: 'active',
      email: `${userId || 'customer'}@mototrack.com`,
      name: 'MotoTrack Rider',
    };

    // 1. Server-side Rate Limit Verification
    const rateCheck = await checkAiUsage(user.user_id, user);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        success: false,
        allowed: false,
        reason: rateCheck.reason,
        weeklyUsed: rateCheck.weeklyUsed,
        weeklyLimit: rateCheck.weeklyLimit,
        consecutiveUsed: rateCheck.consecutiveUsed,
        consecutiveLimit: rateCheck.consecutiveLimit,
        cooldownUntil: rateCheck.cooldownUntil,
        remainingSeconds: rateCheck.remainingSeconds,
        message: rateCheck.message,
        error: rateCheck.message,
      });
    }

    // 2. Concurrency Lock: prevent simultaneous generations from rapid clicks or multiple tabs
    if (!acquireLock(user.user_id)) {
      return res.status(429).json({
        success: false,
        allowed: false,
        reason: 'IN_PROGRESS',
        error: 'An AI preview is already being generated for your account. Please wait.',
        message: 'An AI preview is already being generated for your account. Please wait.',
      });
    }
    lockedUserId = user.user_id;

    // Resolve base motorcycle image
    const bikeFile = await resolveImageInput(
      req.files?.bike?.[0],
      req.body?.bikeUrl || req.body?.bikeUri || req.body?.bikeBase64,
      'bike.jpg'
    );

    // Resolve 1..3 selected product images while preserving exact slot order
    const partFiles = [];
    if (indexedSlotIndices.length > 0) {
      for (const idx of indexedSlotIndices) {
        const resolved = await resolveImageInput(
          req.files?.[`part_${idx}`]?.[0],
          req.body?.[`part_${idx}Url`] ||
            req.body?.[`part_${idx}Uri`] ||
            req.body?.[`part_${idx}Base64`] ||
            parsedPartUrls[idx],
          `part_${idx + 1}.jpg`
        );
        if (resolved) partFiles.push(resolved);
      }
    } else if (arrayPartFiles.length > 0) {
      partFiles.push(...arrayPartFiles);
    } else if (parsedPartUrls.length > 0) {
      for (let i = 0; i < parsedPartUrls.length; i += 1) {
        const resolved = await resolveImageInput(null, parsedPartUrls[i], `part_${i + 1}.jpg`);
        if (resolved) partFiles.push(resolved);
      }
    } else {
      const singlePart = await resolveImageInput(
        req.files?.part?.[0],
        req.body?.partUrl || req.body?.partUri || req.body?.partBase64,
        'part.jpg'
      );
      if (singlePart) partFiles.push(singlePart);
    }

    if (partFiles.length > MAX_CUSTOMIZE_PARTS) {
      return res.status(400).json({
        success: false,
        code: 'MAX_PRODUCTS_EXCEEDED',
        error: 'You can select a maximum of 3 products.',
        message: 'You can select a maximum of 3 products.',
      });
    }

    const customRequest = req.body?.customRequest || req.body?.custom_request || '';
    const installationPrompt =
      req.body?.installationPrompt || req.body?.installation_prompt || customRequest || '';

    if (!bikeFile) {
      return res.status(400).json({
        success: false,
        error: 'Missing required image field "bike".',
      });
    }
    if (partFiles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required product image(s). Select at least 1 product.',
      });
    }

    const primaryProductId =
      selectionMeta?.productId ||
      metaProducts[0]?.productId ||
      metaProducts[0]?.product_id ||
      metaProducts[0]?.id ||
      metaProductIds[0] ||
      null;

    let result = null;
    try {
      result = await customizeMotorcycle({
        bikeFile,
        partFile: partFiles[0],
        partFiles,
        customRequest,
        installationPrompt,
        selectionMeta,
      });
    } catch (aiErr) {
      // Failed AI generation does NOT consume quota!
      await recordFailedGeneration({
        userId: user.user_id,
        motorcycleId: selectionMeta?.motorcycleId || null,
        productId: primaryProductId,
        prompt: installationPrompt || customRequest || null,
        errorMessage: aiErr.message,
      });
      throw aiErr;
    }

    const previewUrl =
      result?.previewImageUrl ||
      result?.dataUrl ||
      (result?.imageBase64
        ? `data:${result.mimeType || 'image/png'};base64,${result.imageBase64}`
        : null);

    if (!result?.success || !previewUrl) {
      await recordFailedGeneration({
        userId: user.user_id,
        motorcycleId: selectionMeta?.motorcycleId || null,
        productId: primaryProductId,
        prompt: installationPrompt || customRequest || null,
        errorMessage: result?.error || 'Empty preview image returned from AI.',
      });
      return res.status(502).json({
        success: false,
        error: result?.error || 'Empty preview image returned from AI.',
        ...result,
      });
    }

    result.previewImageUrl = previewUrl;
    result.dataUrl = previewUrl;

    // 3. Successful Generation: increment counters and record in history
    const updatedUsage = await recordSuccessfulGeneration({
      user,
      motorcycleId: selectionMeta?.motorcycleId || null,
      productId: primaryProductId,
      imageUrl: previewUrl,
      prompt: result.promptUsed || installationPrompt,
    });

    return res.status(200).json({
      ...result,
      allowed: true,
      usage: updatedUsage,
    });
  } catch (err) {
    console.error('[POST /api/customize]', err);
    const status = Number(err.status) || 500;
    return res.status(status).json({
      success: false,
      error: err.message || 'Customization failed.',
      code: err.code || 'CUSTOMIZE_FAILED',
    });
  } finally {
    if (lockedUserId) {
      releaseLock(lockedUserId);
    }
  }
});

/**
 * POST /api/gemini/generate
 * JSON: { promptText, model?, imageBase64?, imageMime? }
 * Server owns GEMINI_API_KEY — never returned to client.
 */
router.post('/gemini/generate', async (req, res) => {
  try {
    const { promptText, model, imageBase64, imageMime, temperature } = req.body || {};
    if (!promptText || !String(promptText).trim()) {
      return res.status(400).json({ success: false, error: 'promptText is required' });
    }
    const result = await proxyGenerateContent({
      promptText,
      model,
      inlineImageBase64: imageBase64 || null,
      inlineImageMime: imageMime || 'image/jpeg',
      temperature: temperature != null ? Number(temperature) : 0.4,
    });
    return res.status(200).json(result);
  } catch (err) {
    console.error('[POST /api/gemini/generate]', err);
    return res.status(Number(err.status) || 500).json({
      success: false,
      error: err.message || 'Gemini generate failed',
      code: err.code || 'GEMINI_FAILED',
    });
  }
});

/**
 * POST /api/gemini/image
 * JSON: { promptText, model?, imageBase64?, imageMime? }
 */
router.post('/gemini/image', async (req, res) => {
  try {
    const { promptText, model, imageBase64, imageMime } = req.body || {};
    if (!promptText || !String(promptText).trim()) {
      return res.status(400).json({ success: false, error: 'promptText is required' });
    }
    const result = await proxyGenerateImage({
      promptText,
      model,
      inlineImageBase64: imageBase64 || null,
      inlineImageMime: imageMime || 'image/jpeg',
    });
    return res.status(200).json(result);
  } catch (err) {
    console.error('[POST /api/gemini/image]', err);
    return res.status(Number(err.status) || 500).json({
      success: false,
      error: err.message || 'Gemini image failed',
      code: err.code || 'GEMINI_IMAGE_FAILED',
    });
  }
});

router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'mototrack-ai-customizer',
    hasGeminiKey: hasGeminiKey() || Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 10),
  });
});

export default router;
