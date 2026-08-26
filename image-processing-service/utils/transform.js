
// IMAGE TRANSFORM ENGINE

const sharp = require('sharp');
const AppError = require('./AppError');
const VALID_TYPES = [
  'resize',
  'crop',
  'rotate',
  'flip',
  'mirror',
  'watermark',
  'filter',
  'compress',
  'format'
];


function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}


async function applyOne(buffer, t) {
  switch (t.type) {
    // ---- RESIZE: change the pixel dimensions ----
    case 'resize': {

      return sharp(buffer)
        .resize({
          width: t.width ? Number(t.width) : undefined,
          height: t.height ? Number(t.height) : undefined,
          fit: t.fit || 'cover'
        })
        .toBuffer();
    }

    // ---- CROP: cut out a rectangular region ----
    case 'crop': {
      return sharp(buffer)
        .extract({
          left: Number(t.left) || 0,
          top: Number(t.top) || 0,
          width: Number(t.width),
          height: Number(t.height)
        })
        .toBuffer();
    }

    case 'rotate': {
      return sharp(buffer)
        .rotate(Number(t.angle) || 0)
        .toBuffer();
    }

    // ---- FLIP: mirror vertically (upside down) ----  
    case 'flip': {
      return sharp(buffer).flip().toBuffer();
    }

    // ---- MIRROR: mirror horizontally (left-right swap) ----
    case 'mirror': {
      return sharp(buffer).flop().toBuffer();
    }

    // ---- WATERMARK: overlay text in the corner ----
    case 'watermark': {
      const text = t.text || 'WATERMARK';
      const meta = await sharp(buffer).metadata();
      const width = meta.width || 400;
      const height = meta.height || 400;
      const fontSize = Math.max(16, Math.floor(width / 15));

      // Building a tiny SVG in memory is the standard sharp technique
    
      const svg = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <text
            x="97%" y="95%"
            text-anchor="end"
            font-family="sans-serif"
            font-weight="bold"
            font-size="${fontSize}"
            fill="rgba(255,255,255,0.65)"
            stroke="rgba(0,0,0,0.35)"
            stroke-width="1"
          >${escapeXml(text)}</text>
        </svg>
      `;

      return sharp(buffer)
        .composite([{ input: Buffer.from(svg), gravity: 'southeast' }])
        .toBuffer();
    }

    // ---- FILTER: grayscale or sepia color effects ----
    case 'filter': {
      if (t.name === 'grayscale') {
        return sharp(buffer).grayscale().toBuffer();
      }
      if (t.name === 'sepia') {
        // Sharp has no built-in "sepia" preset.        
        return sharp(buffer)
          .grayscale()
          .tint({ r: 112, g: 66, b: 20 })
          .toBuffer();
      }
      if (t.name === 'invert') {
        // Sharp has no built-in "invert" preset.        
        return sharp(buffer)
          .negate()
          .toBuffer();
      }
      if (t.name === 'warm') {
        // Sharp has no built-in "warm" preset.        
        return sharp(buffer)
          .modulate({
            brightness:1.05,
            saturation:1.2
          })
          .tint({ r: 225, g: 180, b: 120 })
          .toBuffer();
        }
        if (t.name === 'cool') {
        // Sharp has no built-in "cool" preset.        
        return sharp(buffer)
          .modulate({
            brightness:1.02,
            saturation:1.1
          })
          .tint({ r: 100, g: 160, b: 225 })
          .toBuffer();
        }
      throw new AppError(`Unknown filter name: ${t.name}`, 400);
    }

    // "compress" and "format" don't transform pixels .
    case 'compress':
    case 'format':
      return buffer;

    default:
      throw new AppError(`Unknown transformation type: ${t.type}`, 400);
  }
}

/**
 * Runs a full list of transformations against an image buffer, in the
 * exact order the caller specified, and returns the final encoded
 * result.
 *
 * @param {Buffer} inputBuffer - the source image bytes
 * @param {Array<object>} transformations - e.g. [{type:"resize",width:200,height:200}, {type:"filter",name:"grayscale"}]
 * @param {string} originalFormat - fallback output format if none is requested, e.g. "jpeg"
 * @returns {Promise<{buffer: Buffer, format: string}>}
 */
async function applyTransformations(inputBuffer, transformations, originalFormat) {
  if (!Array.isArray(transformations) || transformations.length === 0) {
    throw new AppError('transformations must be a non-empty array', 400);
  }

  let buffer = inputBuffer;
  let format = originalFormat || 'jpeg';
  let quality; // set if a "compress" step is present, applied at the very end

  for (const t of transformations) {
    if (!VALID_TYPES.includes(t.type)) {
      throw new AppError(`Unknown transformation type: ${t.type}`, 400);
    }

    if (t.type === 'compress') {
      // Clamp to a sane 1-100 range so a bad value can't break sharp.
      quality = Math.min(100, Math.max(1, Number(t.quality) || 80));
      continue;
    }

    if (t.type === 'format') {
      const allowedFormats = ['jpeg', 'jpg', 'png', 'webp', 'avif'];
      if (!allowedFormats.includes(t.value)) {
        throw new AppError(
          `Unsupported format: ${t.value}. Use one of ${allowedFormats.join(', ')}`,
          400
        );
      }
      format = t.value === 'jpg' ? 'jpeg' : t.value;
      continue;
    }

    // Every other transform type actually touches pixels 
    buffer = await applyOne(buffer, t);
  }

  // Final step: encode to the requested (or original) format
  const sharpInstance = sharp(buffer);
  const encodeOptions = quality ? { quality } : {};

  switch (format) {
    case 'png':
      buffer = await sharpInstance.png(encodeOptions).toBuffer();
      break;
    case 'webp':
      buffer = await sharpInstance.webp(encodeOptions).toBuffer();
      break;
    case 'avif':
      buffer = await sharpInstance.avif(encodeOptions).toBuffer();
      break;
    case 'jpeg':
    default:
      format = 'jpeg';
      buffer = await sharpInstance.jpeg(encodeOptions).toBuffer();
      break;
  }

  return { buffer, format };
}

module.exports = { applyTransformations, VALID_TYPES };
