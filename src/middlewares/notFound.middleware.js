'use strict';

const AppError = require('../utils/appError');

function apiNotFound(req, _res, next) {
  next(new AppError(`API route not found: ${req.method} ${req.originalUrl}`, 404, 'API_ROUTE_NOT_FOUND'));
}

module.exports = apiNotFound;
