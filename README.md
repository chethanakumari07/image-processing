# Image Processing Service (Cloudinary-style backend)

A Node.js + Express backend for uploading images, transforming them
(resize, crop, rotate, watermark, flip, mirror, compress, format
conversion, grayscale/sepia filters), and retrieving them — with JWT
auth, MySQL for metadata, AWS S3 for storage, rate limiting, and
transformation caching.

## Stack

| Piece | Tool |
|---|---|
| Server | Node.js + Express |
| Database | MySQL (via `mysql2`) |
| File storage | AWS S3 |
| Image processing | `sharp` |
| Auth | JWT (`jsonwebtoken`) + `bcryptjs` |
| Uploads | `multer` (in-memory, streamed straight to S3) |
| Rate limiting | `express-rate-limit` |
| Validation | `express-validator` |

## 1. Prerequisites

- Node.js 18+
- A running MySQL server (local install, or Docker, or a hosted one)
- An AWS account with an S3 bucket already created, and an IAM user
  with `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` permissions
  on that bucket

## 2. Setup

```bash
# 1. Install dependencies
npm install

# 2. Create your database tables
mysql -u root -p < schema.sql

# 3. Copy the env template and fill in real values
cp .env.example .env
# then open .env and set: DB_PASSWORD, JWT_SECRET, AWS_* vars, S3_BUCKET_NAME

# 4. Start the server
npm run dev      # auto-restarts on file changes (uses nodemon)
# or
npm start         # plain node
```

You should see:
```
🚀 Image processing service running on http://localhost:3000
```

## 3. Trying it out (curl examples)

**Register:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"jane","email":"jane@example.com","password":"password123"}'
```
Save the `token` from the response — every image endpoint needs it.

**Upload an image:**
```bash
curl -X POST http://localhost:3000/api/images/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@/path/to/photo.jpg"
```
Save the `id` from the response — that's your image ID.

**Transform it (resize + grayscale + watermark, all at once):**
```bash
curl -X POST http://localhost:3000/api/images/YOUR_IMAGE_ID/transform \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "transformations": [
      { "type": "resize", "width": 400, "height": 400, "fit": "cover" },
      { "type": "filter", "name": "grayscale" },
      { "type": "watermark", "text": "© Jane 2026" }
    ]
  }'
```
Run the exact same request again — the response will come back with
`"cached": true` instantly instead of reprocessing.

**Retrieve the original, or a specific format:**
```bash
curl http://localhost:3000/api/images/YOUR_IMAGE_ID \
  -H "Authorization: Bearer YOUR_TOKEN"

curl "http://localhost:3000/api/images/YOUR_IMAGE_ID?format=webp" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**List your images (paginated):**
```bash
curl "http://localhost:3000/api/images?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 4. Supported transformations

| type | params | example |
|---|---|---|
| `resize` | `width`, `height`, `fit` (`cover`/`contain`/`fill`) | `{"type":"resize","width":300,"height":300}` |
| `crop` | `left`, `top`, `width`, `height` | `{"type":"crop","left":0,"top":0,"width":200,"height":200}` |
| `rotate` | `angle` (degrees) | `{"type":"rotate","angle":90}` |
| `flip` | (none — vertical flip) | `{"type":"flip"}` |
| `mirror` | (none — horizontal flip) | `{"type":"mirror"}` |
| `watermark` | `text` | `{"type":"watermark","text":"© Me"}` |
| `filter` | `name` (`grayscale`/`sepia`) | `{"type":"filter","name":"sepia"}` |
| `compress` | `quality` (1-100) | `{"type":"compress","quality":60}` |
| `format` | `value` (`jpeg`/`png`/`webp`/`avif`) | `{"type":"format","value":"webp"}` |

Transformations in one request are applied **in the order you list
them** — e.g. resize-then-watermark positions the watermark on the
already-resized image.

## 5. How caching works

Every transform request is hashed (image ID + the exact transformation
list, via `utils/cacheKey.js`) into a `cache_key`. Before processing
anything, we check the `transformations` table for a row with that
key. If found, we skip `sharp` entirely and just sign a URL to the
already-processed S3 object. This means repeated requests for the
same variant (e.g. a website re-rendering the same thumbnail) are
near-instant and cost zero CPU.

## 6. Project structure

```
server.js              - entry point, wires everything together
config/
  db.js                 - MySQL connection pool
  s3.js                  - AWS S3 client + upload/download/sign helpers
middleware/
  auth.js                - JWT verification
  upload.js               - multer config (file validation, size limit)
  rateLimiter.js           - rate limiting for the transform endpoint
  errorHandler.js           - central error formatter
models/
  userModel.js             - SQL queries for users
  imageModel.js              - SQL queries for images + transformations
controllers/
  authController.js          - register / login logic
  imageController.js          - upload / transform / retrieve / list logic
routes/
  authRoutes.js                - /api/auth/* URL definitions + validation
  imageRoutes.js                 - /api/images/* URL definitions + validation
utils/
  transform.js                    - the sharp-based image processing engine
  cacheKey.js                      - deterministic hashing for caching
  AppError.js                       - custom error class with HTTP status codes
  catchAsync.js                      - wraps async controllers to auto-catch errors
schema.sql                            - MySQL table definitions
```

## 7. What to extend first

Roughly in order of "most value for least effort":

1. **Delete image endpoint** — `DELETE /api/images/:id`. The S3 helper
   (`deleteFromS3` in `config/s3.js`) already exists and isn't wired to
   a route yet; you'd also delete the DB row (transformations cascade
   automatically via `ON DELETE CASCADE` in `schema.sql`).
2. **Image-overlay watermarks**, not just text — accept a second
   uploaded image and `composite()` it onto the first, instead of only
   supporting SVG text.
3. **Async processing for large images/batches** — right now a
   transform request blocks until sharp finishes. For heavier
   workloads, push the job onto a queue (BullMQ + Redis is the common
   Node choice) and let the client poll or get a webhook when it's done.
4. **Move rate limiting to Redis** (`rate-limit-redis` package) so
   limits are shared correctly across multiple server instances —
   right now each server process tracks its own counts in memory.
5. **Public/private image toggle** — right now every image requires
   the owner's JWT to view. Add an `is_public` column and a route that
   skips auth for public images, for a "shareable link" feature.
6. **Refresh tokens** — JWTs currently just expire after `JWT_EXPIRES_IN`
   and force a full re-login. A refresh-token flow lets you issue
   short-lived access tokens with a longer-lived refresh token to
   silently renew them.
