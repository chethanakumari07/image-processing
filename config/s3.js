
// AWS S3 CLIENT

const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand
} = require('@aws-sdk/client-s3');

const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const BUCKET = process.env.S3_BUCKET_NAME;

/**
 * Upload a file buffer to S3.
 * @param {string} key - the path/filename inside the bucket, e.g. "originals/abc.jpg"
 * @param {Buffer} buffer - the raw file bytes (from multer or from sharp's output)
 * @param {string} contentType - MIME type, e.g. "image/jpeg"
 */
async function uploadToS3(key, buffer, contentType) {
  // "await" pauses this function until the S3 upload finishes
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType
    })
  );
  return key;
}

/**
 * Download a file's bytes from S3 into memory. Used when we need to
 * re-process an already-uploaded original image (e.g. apply a new
 * transformation to it).
 * @param {string} key
 * @returns {Promise<Buffer>}
 */
async function getFromS3(key) {
  const response = await s3Client.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: key })
  );
  // response.Body is a readable stream, not a Buffer
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Generate a temporary URL the browser can use to view/download an
 * object directly from S3, 
 * @param {string} key
 * @param {number} expiresInSeconds
 */
async function getSignedS3Url(key, expiresInSeconds = 3600) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}

/**
 * Delete an object from S3. 
 * @param {string} key
 */
async function deleteFromS3(key) {
  await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

// Export everything as named properties on one object, so other files
module.exports = {
  s3Client,
  uploadToS3,
  getFromS3,
  getSignedS3Url,
  deleteFromS3
};
