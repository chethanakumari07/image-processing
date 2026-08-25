
// RATE LIMITER
const rateLimit = require('express-rate-limit');

const transformLimiter = rateLimit({
  // Window length, converted from minutes (in .env) to milliseconds.
  windowMs: (Number(process.env.TRANSFORM_RATE_LIMIT_WINDOW_MINUTES) || 15) * 60 * 1000,

  // Max requests allowed per key within that window.
  max: Number(process.env.TRANSFORM_RATE_LIMIT_MAX) || 20,

  // By default express-rate-limit keys by IP address. 
  keyGenerator: (req) => req.user.id,

  // Sent back once the limit is hit.
  message: {
    status: 'fail',
    message: 'Too many transformation requests. Please try again later.'
  },

  // Include standard RateLimit-* response headers 
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = { transformLimiter };
