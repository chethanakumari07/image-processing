// CENTRAL ERROR HANDLER

module.exports = function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const status = err.status || 'error';
  console.error('ERROR 💥', err);
  if (err.name === 'MulterError') {
    return res.status(400).json({
      status: 'fail',
      message: `Upload error: ${err.message}`
    });
  }

  // mysql2 throws errors with a "code" property for DB-level problems
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      status: 'fail',
      message: 'That value already exists (e.g. email already registered).'
    });
  }
  // show a generic message instead (never leak stack traces to users).
  if (err.isOperational) {
    return res.status(statusCode).json({
      status,
      message: err.message
    });
  }

  return res.status(500).json({
    status: 'error',
    message: 'Something went wrong on our end.'
  });
};
