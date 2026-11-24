/**
 * 404 Not Found Middleware for unhandled routes
 */
const notFound = (req, res, next) => {
  res.status(404).json({
    message: `Resource not found: ${req.method} ${req.originalUrl}`
  });
};

/**
 * Centralized Error Handling Middleware
 */
const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  let statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);
  let message = err.message || 'Internal Server Error';
  let errors = err.errors || undefined;

  // Handle Mongoose Bad ObjectId (CastError)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ID format: '${err.value}'`;
  }

  // Handle Mongoose Duplicate Key (E11000)
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const value = err.keyValue ? err.keyValue[field] : '';
    message = `Duplicate value error: A product with ${field} '${value}' already exists`;
  }

  // Handle Mongoose Schema Validation Errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const validationErrors = Object.values(err.errors).map(e => e.message);
    message = validationErrors.join(', ');
    errors = validationErrors;
  }

  // Handle JSON Syntax Parsing Errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    message = 'Invalid JSON payload received';
  }

  res.status(statusCode).json({
    message,
    ...(errors && { errors }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = {
  notFound,
  errorHandler
};
