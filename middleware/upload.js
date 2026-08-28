
// UPLOAD MIDDLEWARE (Multer)
const multer = require('multer');
const AppError = require('../utils/AppError');

// Only allow actual image files. Multer calls this function for every
// incoming file; calling cb(null, true) accepts it, cb(error) rejects it.
function fileFilter(req, file, cb) {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Only JPEG, PNG, WEBP, and GIF images are allowed.', 400));
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    // 10 MB max file size, in bytes. 
    fileSize: 10 * 1024 * 1024
  }
});

module.exports = upload;
