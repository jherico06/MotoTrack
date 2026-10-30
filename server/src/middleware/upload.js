import multer from 'multer';

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB
export const MAX_CUSTOMIZE_PARTS = 3;

const storage = multer.memoryStorage();

function imageFileFilter(_req, file, cb) {
  if (!file.mimetype || !file.mimetype.startsWith('image/')) {
    cb(new Error('Only image uploads are allowed (bike + part).'));
    return;
  }
  cb(null, true);
}

export const uploadBikeAndPart = multer({
  storage,
  // Allow enough file slots so route-level validation can return a clear
  // "You can select a maximum of 3 products." JSON response if > 3 parts are submitted.
  limits: { fileSize: MAX_FILE_BYTES, files: 10 },
  fileFilter: imageFileFilter,
}).fields([
  { name: 'bike', maxCount: 1 },
  { name: 'part', maxCount: 5 },
  { name: 'parts', maxCount: 5 },
  { name: 'part_0', maxCount: 1 },
  { name: 'part_1', maxCount: 1 },
  { name: 'part_2', maxCount: 1 },
  { name: 'part_3', maxCount: 1 },
  { name: 'part_4', maxCount: 1 },
]);

export function multerErrorHandler(err, _req, res, next) {
  if (!err) return next();
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'Each image must be 8MB or smaller.',
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        code: 'MAX_PRODUCTS_EXCEEDED',
        error: 'You can select a maximum of 3 products.',
        message: 'You can select a maximum of 3 products.',
      });
    }
    return res.status(400).json({
      success: false,
      error: err.message || 'Upload failed.',
    });
  }
  if (err.message) {
    return res.status(400).json({ success: false, error: err.message });
  }
  return next(err);
}
