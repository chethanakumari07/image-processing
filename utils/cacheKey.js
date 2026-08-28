// CACHE KEY

const crypto = require('crypto');

/**
 * @param {string} imageId - the original image's ID
 * @param {Array<object>} transformations - the ordered list of operations
 * @returns {string} a 64-character hex hash
 */
function buildCacheKey(imageId, transformations) {

  const raw = imageId + JSON.stringify(transformations);
  return crypto.createHash('sha256').update(raw).digest('hex');
}

module.exports = { buildCacheKey };
