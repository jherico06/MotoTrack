import { Router } from 'express';
import { uploadBikeAndPart } from '../middleware/upload.js';
import { customizeMotorcycle } from '../services/aiCustomizeService.js';
import { proxyGenerateContent, proxyGenerateImage, hasGeminiKey } from '../services/geminiProxyService.js';

const router = Router();

/**
 * POST /api/customize
 * multipart/form-data:
 *   - bike: image file (required)
 *   - part: image file (required)
 *   - customRequest: string (optional)
 */
router.post('/customize', uploadBikeAndPart, async (req, res) => {
  try {
    const bikeFile = req.files?.bike?.[0];
    const partFile = req.files?.part?.[0];
    const customRequest = req.body?.customRequest || req.body?.custom_request || '';

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

    const result = await customizeMotorcycle({
      bikeFile,
      partFile,
      customRequest,
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error('[POST /api/customize]', err);
    const status = Number(err.status) || 500;
    return res.status(status).json({
      success: false,
      error: err.message || 'Customization failed.',
      code: err.code || 'CUSTOMIZE_FAILED',
    });
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
