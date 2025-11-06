// Custom Error Classes
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400);
    this.name = 'ValidationError';
    this.details = details;
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403);
    this.name = 'AuthorizationError';
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
    this.name = 'NotFoundError';
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409);
    this.name = 'ConflictError';
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429);
    this.name = 'RateLimitError';
  }
}

class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', originalError = null) {
    super(message, 500, false);
    this.name = 'DatabaseError';
    this.originalError = originalError;
  }
}

class ExternalServiceError extends AppError {
  constructor(service, message = 'External service error', originalError = null) {
    super(message, 503, false);
    this.name = 'ExternalServiceError';
    this.service = service;
    this.originalError = originalError;
  }
}

// Error Handler Middleware
const errorHandler = (err, req, res, next) => {
  const log4js = require('log4js');
  const logger = log4js.getLogger('error');

  // Default error values
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let errorName = err.name || 'Error';

  // Log error details
  const errorLog = {
    timestamp: new Date().toISOString(),
    name: errorName,
    message: message,
    statusCode: statusCode,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id || null,
    userAgent: req.get('user-agent')
  };

  // Log stack trace for server errors
  if (statusCode >= 500) {
    errorLog.stack = err.stack;
    logger.error(errorLog);
  } else {
    logger.warn(errorLog);
  }

  // Don't leak error details in production for server errors
  const isDevelopment = process.env.NODE_ENV === 'development';
  const responseMessage = (statusCode >= 500 && !isDevelopment) 
    ? 'Internal server error' 
    : message;

  // Build error response
  const errorResponse = {
    error: errorName,
    message: responseMessage,
    timestamp: err.timestamp || new Date().toISOString(),
    path: req.url
  };

  // Add details if available (validation errors)
  if (err.details && isDevelopment) {
    errorResponse.details = err.details;
  }

  // Add stack trace in development
  if (isDevelopment && err.stack) {
    errorResponse.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
};

// Async Error Wrapper
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Not Found Handler
const notFoundHandler = (req, res, next) => {
  next(new NotFoundError(`Route ${req.originalUrl}`));
};

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  DatabaseError,
  ExternalServiceError,
  errorHandler,
  asyncHandler,
  notFoundHandler
};
