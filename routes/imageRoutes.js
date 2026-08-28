// IMAGE ROUTES

const express = require('express');
const { body } = require('express-validator');

const imageController = require('../controllers/imageController');
const upload = require('../middleware/upload');
const { protect } = require('../middleware/auth');
const { transformLimiter } = require('../middleware/rateLimiter');
const { VALID_TYPES } = require('../utils/transform');

const router = express.Router();

// Every route defined below this line requires a valid JWT.
router.use(protect);

// ---- POST /api/images/upload ----
router.post('/upload', upload.single('image'), imageController.uploadImage);

// ---- POST /api/images/:id/transform ----
router.post(
  '/:id/transform',
  transformLimiter,
  [
    body('transformations')
      .isArray({ min: 1 })
      .withMessage('transformations must be a non-empty array.'),
    body('transformations').custom((transformations) => {
      if (!Array.isArray(transformations)) return true; // caught by the rule above
      for (const t of transformations) {
        if (!t || typeof t.type !== 'string' || !VALID_TYPES.includes(t.type)) {
          throw new Error(
            `Each transformation needs a valid "type" (one of: ${VALID_TYPES.join(', ')}).`
          );
        }
      }
      return true;
    })
  ],
  imageController.transformImage
);

// ---- GET /api/images/:id ----
router.get('/:id', imageController.retrieveImage);

// ---- GET /api/images ----
router.get('/', imageController.listImages);

module.exports = router;
