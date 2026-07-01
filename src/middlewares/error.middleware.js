'use strict';

function errorHandler(error, _req, res, _next) {
  const statusCode = error.statusCode || error.status || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  if (statusCode >= 500) console.error(error);

  const payload = {
    ok: false,
    message: statusCode >= 500 ? 'Internal server error.' : error.message
  };

  if (!isProduction) {
    payload.code = error.code || 'INTERNAL_ERROR';
    if (error.type) payload.type = error.type;
  }

  res.status(statusCode).json(payload);
}

module.exports = errorHandler;
