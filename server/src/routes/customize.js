import { Router } from 'express';
import { uploadBikeAndPart } from '../middleware/upload.js';
import { customizeMotorcycle } from '../services/aiCustomizeService.js';

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

router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'mototrack-ai-customizer',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 10),
  });
});

export default router;
