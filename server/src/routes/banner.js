import { Router } from 'express';
import multer from 'multer';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { getSupabaseAdmin } from '../services/supabaseAdmin.js';

const router = Router();

const MAX_BANNER_FILE_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BANNER_FILE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype || !ALLOWED_MIME_TYPES.includes(file.mimetype.toLowerCase())) {
      cb(new Error('Invalid image type. Only JPEG, PNG, WEBP, and GIF are allowed.'));
      return;
    }
    cb(null, true);
  },
});

/**
 * Public: Get the active marketing hero banner.
 * GET /api/banner
 */
router.get('/', async (_req, res) => {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Database service unavailable' });
    }

    const { data, error } = await supabase
      .from('marketing_banners')
      .select('id, title, subtitle, description, image')
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[banner] fetch error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    if (!data) {
      return res.status(404).json({ success: false, error: 'No marketing banner found', banner: null });
    }

    return res.status(200).json({
      success: true,
      banner: {
        id: data.id,
        title: data.title,
        subtitle: data.subtitle,
        description: data.description,
        image: data.image,
      },
    });
  } catch (err) {
    console.error('[banner] get exception:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch banner' });
  }
});

/**
 * Admin: Upload banner image to persistent Supabase storage.
 * POST /api/banner/upload
 */
router.post('/upload', requireAdmin, (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'Banner image exceeds maximum allowed size of 8MB.',
        });
      }
      return res.status(400).json({ success: false, error: err.message || 'Image upload failed.' });
    }
    if (err) {
      return res.status(400).json({ success: false, error: err.message || 'Invalid image file.' });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, error: 'No image file was uploaded.' });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Storage service unavailable.' });
    }

    const file = req.file;
    const ext = file.mimetype.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
    const fileName = `banners/hero-banner-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadError) {
      console.error('[banner] storage upload error:', uploadError);
      return res.status(500).json({ success: false, error: uploadError.message || 'Failed to upload image to storage.' });
    }

    const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
    const publicUrl = urlData?.publicUrl;

    if (!publicUrl) {
      return res.status(500).json({ success: false, error: 'Failed to retrieve public URL for uploaded banner.' });
    }

    return res.status(200).json({
      success: true,
      url: publicUrl,
    });
  } catch (err) {
    console.error('[banner] upload exception:', err);
    return res.status(500).json({ success: false, error: err.message || 'Banner upload failed' });
  }
});

/**
 * Admin: Update marketing banner.
 * PUT /api/banner
 * Validates text fields on server, persists strictly 5 fields to database.
 */
router.put('/', requireAdmin, async (req, res) => {
  try {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const subtitle = typeof req.body?.subtitle === 'string' ? req.body.subtitle.trim() : '';
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    const image = typeof req.body?.image === 'string' ? req.body.image.trim() : '';
    const id = typeof req.body?.id === 'string' && req.body.id.trim() ? req.body.id.trim() : 'hero-main';

    // Strict server-side validation
    if (!title) {
      return res.status(400).json({ success: false, error: 'Banner title is required.' });
    }
    if (title.length > 250) {
      return res.status(400).json({ success: false, error: 'Banner title cannot exceed 250 characters.' });
    }

    if (!subtitle) {
      return res.status(400).json({ success: false, error: 'Banner subtitle is required.' });
    }
    if (subtitle.length > 250) {
      return res.status(400).json({ success: false, error: 'Banner subtitle cannot exceed 250 characters.' });
    }

    if (!description) {
      return res.status(400).json({ success: false, error: 'Banner description is required.' });
    }
    if (description.length > 1500) {
      return res.status(400).json({ success: false, error: 'Banner description cannot exceed 1500 characters.' });
    }

    if (!image) {
      return res.status(400).json({ success: false, error: 'Banner image URL or key is required.' });
    }
    if (image.length > 2000) {
      return res.status(400).json({ success: false, error: 'Banner image string is too long.' });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Database service unavailable' });
    }

    // Strictly persist only the 5 fields
    const payload = {
      id,
      title,
      subtitle,
      description,
      image,
    };

    const { data, error } = await supabase
      .from('marketing_banners')
      .upsert(payload, { onConflict: 'id' })
      .select('id, title, subtitle, description, image')
      .single();

    if (error) {
      console.error('[banner] update error:', error);
      return res.status(500).json({ success: false, error: error.message || 'Failed to persist banner.' });
    }

    return res.status(200).json({
      success: true,
      banner: data,
    });
  } catch (err) {
    console.error('[banner] put exception:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to update banner.' });
  }
});

// Alias POST to PUT for flexibility
router.post('/', requireAdmin, async (req, res) => {
  // Delegate to PUT handler
  req.method = 'PUT';
  return router.handle(req, res);
});

export default router;
