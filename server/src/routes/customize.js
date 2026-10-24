import { Router } from 'express';
import { uploadBikeAndPart } from '../middleware/upload.js';
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

    const user = await getVerifiedUser(userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        allowed: false,
        error: 'Invalid or expired user session.',
        code: 'USER_NOT_FOUND',
      });
    }

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
 *   - part: image file (required) — product identity reference
 *   - installationPrompt / customRequest: string (optional full install prompt)
 *   - selectionMeta: JSON string (optional debug association payload)
 */
router.post('/customize', uploadBikeAndPart, async (req, res) => {
  let lockedUserId = null;
  try {
    const userId = String(
      req.headers['x-user-id'] ||
      req.headers['x-admin-user-id'] ||
      req.headers['x-mototrack-user-id'] ||
      req.body?.userId ||
      req.body?.user_id ||
      ''
    ).trim();

    if (!userId) {
      return res.status(401).json({
        success: false,
        allowed: false,
        error: 'Sign in to generate AI installation previews.',
        code: 'UNAUTHENTICATED',
      });
    }

    const user = await getVerifiedUser(userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        allowed: false,
        error: 'User not recognized. Please sign in again.',
        code: 'USER_NOT_FOUND',
      });
    }

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

    let bikeFile = req.files?.bike?.[0];
    let partFile = req.files?.part?.[0];

    // Fallback: If not sent as multipart file, download/decode from bikeUrl / bikeUri / bikeBase64
    if (!bikeFile && (req.body?.bikeUrl || req.body?.bikeUri || req.body?.bikeBase64)) {
      const bikeTarget = String(req.body?.bikeUrl || req.body?.bikeUri || req.body?.bikeBase64 || '').trim();
      try {
        if (bikeTarget.startsWith('data:')) {
          const [meta, rawB64] = bikeTarget.split(',');
          const mime = meta.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
          const buffer = Buffer.from(rawB64 || meta, 'base64');
          bikeFile = {
            buffer,
            mimetype: mime,
            originalname: 'bike.jpg',
            size: buffer.length,
          };
        } else if (/^https?:\/\//i.test(bikeTarget)) {
          const resp = await fetch(bikeTarget);
          if (resp.ok) {
            const arrayBuf = await resp.arrayBuffer();
            const buffer = Buffer.from(arrayBuf);
            bikeFile = {
              buffer,
              mimetype: resp.headers.get('content-type') || 'image/jpeg',
              originalname: 'bike.jpg',
              size: buffer.length,
            };
          }
        }
      } catch (err) {
        console.warn('[customize] Failed to fetch bikeUrl:', err?.message || err);
      }
    }

    if (!partFile && (req.body?.partUrl || req.body?.partUri || req.body?.partBase64)) {
      const partTarget = String(req.body?.partUrl || req.body?.partUri || req.body?.partBase64 || '').trim();
      try {
        if (partTarget.startsWith('data:')) {
          const [meta, rawB64] = partTarget.split(',');
          const mime = meta.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
          const buffer = Buffer.from(rawB64 || meta, 'base64');
          partFile = {
            buffer,
            mimetype: mime,
            originalname: 'part.jpg',
            size: buffer.length,
          };
        } else if (/^https?:\/\//i.test(partTarget)) {
          const resp = await fetch(partTarget);
          if (resp.ok) {
            const arrayBuf = await resp.arrayBuffer();
            const buffer = Buffer.from(arrayBuf);
            partFile = {
              buffer,
              mimetype: resp.headers.get('content-type') || 'image/jpeg',
              originalname: 'part.jpg',
              size: buffer.length,
            };
          }
        }
      } catch (err) {
        console.warn('[customize] Failed to fetch partUrl:', err?.message || err);
      }
    }

    const customRequest = req.body?.customRequest || req.body?.custom_request || '';
    const installationPrompt =
      req.body?.installationPrompt || req.body?.installation_prompt || customRequest || '';

    let selectionMeta = null;
    const rawMeta = req.body?.selectionMeta || req.body?.selection_meta || '';
    if (rawMeta) {
      try {
        selectionMeta = typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta;
      } catch (_e) {
        selectionMeta = null;
      }
    }

    if (!bikeFile) {
      return res.status(400).json({
        success: false,
        error: 'Missing required image field "bike".',
      });
    }
    if (!partFile) {
      return res.status(400).json({
        success: false,
        error: 'Missing required image field "part".',
      });
    }

    let result = null;
    try {
      result = await customizeMotorcycle({
        bikeFile,
        partFile,
        customRequest,
        installationPrompt,
        selectionMeta,
      });
    } catch (aiErr) {
      // Failed AI generation does NOT consume quota!
      await recordFailedGeneration({
        userId: user.user_id,
        motorcycleId: selectionMeta?.motorcycleId || null,
        productId: selectionMeta?.productId || null,
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
        productId: selectionMeta?.productId || null,
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
      productId: selectionMeta?.productId || null,
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
