import multer from 'multer';

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB

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
  limits: { fileSize: MAX_FILE_BYTES, files: 2 },
  fileFilter: imageFileFilter,
}).fields([
  { name: 'bike', maxCount: 1 },
  { name: 'part', maxCount: 1 },
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
