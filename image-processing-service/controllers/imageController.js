
// IMAGE CONTROLLER

const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const { validationResult } = require('express-validator');

const imageModel = require('../models/imageModel');
const { uploadToS3, getFromS3, getSignedS3Url } = require('../config/s3');
const { applyTransformations } = require('../utils/transform');
const { buildCacheKey } = require('../utils/cacheKey');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

// Maps a MIME type to a file extension, used when building the S3 key
// for a freshly uploaded original image.
const MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
};

// POST /api/images/upload
const uploadImage = catchAsync(async (req, res) => {
  if (!req.file) {
    throw new AppError('No image file provided. Attach one under the "image" field.', 400);
  }

  const userId = req.user.id;
  const imageId = uuidv4();
  const ext = MIME_TO_EXT[req.file.mimetype] || 'jpg';
  const s3Key = `originals/${userId}/${imageId}.${ext}`;

  // Read the image's actual pixel dimension
  const metadata = await sharp(req.file.buffer).metadata();

  await uploadToS3(s3Key, req.file.buffer, req.file.mimetype);

  await imageModel.createImage({
    id: imageId,
    userId,
    originalFilename: req.file.originalname,
    s3Key,
    mimeType: req.file.mimetype,
    sizeBytes: req.file.size,
    width: metadata.width,
    height: metadata.height
  });

  const url = await getSignedS3Url(s3Key);

  res.status(201).json({
    status: 'success',
    image: {
      id: imageId,
      originalFilename: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      width: metadata.width,
      height: metadata.height,
      url
    }
  });
});

// POST /api/images/:id/transform

const transformImage = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(errors.array()[0].msg, 400);
  }

  const userId = req.user.id;
  const { id: imageId } = req.params;
  const { transformations } = req.body;

  // Confirm the image exists AND belongs to this user in one query
  const image = await imageModel.findImageByIdForUser(imageId, userId);
  if (!image) {
    throw new AppError('Image not found.', 404);
  }

  // ---- CACHING CHECK ----
  const cacheKey = buildCacheKey(imageId, transformations);
  const cached = await imageModel.findTransformationByCacheKey(imageId, cacheKey);

  if (cached) {
    const url = await getSignedS3Url(cached.s3_key);
    return res.status(200).json({
      status: 'success',
      cached: true,
      transformation: {
        id: cached.id,
        format: cached.format,
        url
      }
    });
  }

  // ---- CACHE MISS: actually process the image ----
  const originalBuffer = await getFromS3(image.s3_key);
  const originalFormat = MIME_TO_EXT[image.mime_type] === 'jpg' ? 'jpeg' : MIME_TO_EXT[image.mime_type];

  const { buffer: resultBuffer, format } = await applyTransformations(
    originalBuffer,
    transformations,
    originalFormat
  );

  const transformationId = uuidv4();
  const s3Key = `transformed/${userId}/${imageId}/${cacheKey}.${format}`;
  const contentType = `image/${format}`;

  await uploadToS3(s3Key, resultBuffer, contentType);

  await imageModel.createTransformation({
    id: transformationId,
    imageId,
    cacheKey,
    s3Key,
    format,
    params: transformations
  });

  const url = await getSignedS3Url(s3Key);

  res.status(201).json({
    status: 'success',
    cached: false,
    transformation: {
      id: transformationId,
      format,
      url
    }
  });
});

// GET /api/images/:id?format=webp   (format query param is optional)
const retrieveImage = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { id: imageId } = req.params;
  const { format } = req.query;

  const image = await imageModel.findImageByIdForUser(imageId, userId);
  if (!image) {
    throw new AppError('Image not found.', 404);
  }

  // No format requested -> just hand back the original, no processing.
  if (!format) {
    const url = await getSignedS3Url(image.s3_key);
    return res.status(200).json({
      status: 'success',
      image: {
        id: image.id,
        originalFilename: image.original_filename,
        mimeType: image.mime_type,
        width: image.width,
        height: image.height,
        url
      }
    });
  }

  // A format WAS requested — reuse the exact

  const transformations = [{ type: 'format', value: format }];
  const cacheKey = buildCacheKey(imageId, transformations);
  const cached = await imageModel.findTransformationByCacheKey(imageId, cacheKey);

  if (cached) {
    const url = await getSignedS3Url(cached.s3_key);
    return res.status(200).json({
      status: 'success',
      image: { id: image.id, format: cached.format, url }
    });
  }

  const originalBuffer = await getFromS3(image.s3_key);
  const originalFormat = MIME_TO_EXT[image.mime_type] === 'jpg' ? 'jpeg' : MIME_TO_EXT[image.mime_type];
  const { buffer: resultBuffer, format: outFormat } = await applyTransformations(
    originalBuffer,
    transformations,
    originalFormat
  );

  const s3Key = `transformed/${userId}/${imageId}/${cacheKey}.${outFormat}`;
  await uploadToS3(s3Key, resultBuffer, `image/${outFormat}`);
  await imageModel.createTransformation({
    id: uuidv4(),
    imageId,
    cacheKey,
    s3Key,
    format: outFormat,
    params: transformations
  });

  const url = await getSignedS3Url(s3Key);
  res.status(200).json({ status: 'success', image: { id: image.id, format: outFormat, url } });
});

// GET /api/images?page=1&limit=10
const listImages = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));

  const { images, total } = await imageModel.listImagesForUser(userId, page, limit);

  // Attach a fresh signed URL to each image. Signed URLs expire
  const imagesWithUrls = await Promise.all(
    images.map(async (img) => ({
      id: img.id,
      originalFilename: img.original_filename,
      mimeType: img.mime_type,
      sizeBytes: img.size_bytes,
      width: img.width,
      height: img.height,
      createdAt: img.created_at,
      url: await getSignedS3Url(img.s3_key)
    }))
  );

  res.status(200).json({
    status: 'success',
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    images: imagesWithUrls
  });
});

module.exports = { uploadImage, transformImage, retrieveImage, listImages };
