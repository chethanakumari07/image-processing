
// IMAGE MODEL
const pool = require('../config/db');
// IMAGES (originals)
/**
 * Save metadata for a newly uploaded original image.
 */
async function createImage({
  id,
  userId,
  originalFilename,
  s3Key,
  mimeType,
  sizeBytes,
  width,
  height
}) {
  await pool.execute(
    `INSERT INTO images
      (id, user_id, original_filename, s3_key, mime_type, size_bytes, width, height)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, originalFilename, s3Key, mimeType, sizeBytes, width, height]
  );
}


 // Fetch one image by ID, but ONLY if it belongs to the given user.

async function findImageByIdForUser(imageId, userId) {
  const [rows] = await pool.execute(
    'SELECT * FROM images WHERE id = ? AND user_id = ?',
    [imageId, userId]
  );
  return rows[0];
}

/**
 * Paginated list of a user's images, newest first.
 * @param {number} userId
 * @param {number} page - 1-indexed page number
 * @param {number} limit - rows per page
 */
async function listImagesForUser(userId, page, limit) {
  const offset = (page - 1) * limit;

  // Two queries: one for the page of rows, one for the total count

  const [rows] = await pool.query(
    `SELECT * FROM images WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
    [userId]
  );

  const [countRows] = await pool.execute(
    'SELECT COUNT(*) AS total FROM images WHERE user_id = ?',
    [userId]
  );

  return { images: rows, total: countRows[0].total };
}

// TRANSFORMATIONS (cached processed variants)


async function findTransformationByCacheKey(imageId, cacheKey) {
  const [rows] = await pool.execute(
    'SELECT * FROM transformations WHERE image_id = ? AND cache_key = ?',
    [imageId, cacheKey]
  );
  return rows[0];
}

 // Save a newly created transformed variant.

async function createTransformation({ id, imageId, cacheKey, s3Key, format, params }) {
  await pool.execute(
    `INSERT INTO transformations (id, image_id, cache_key, s3_key, format, params)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, imageId, cacheKey, s3Key, format, JSON.stringify(params)]
  );
}

module.exports = {
  createImage,
  findImageByIdForUser,
  listImagesForUser,
  findTransformationByCacheKey,
  createTransformation
};
