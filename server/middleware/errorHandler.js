/**
 * Global error handler middleware
 */
export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Default error
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';

  // Handle specific error types
  if (err.message === 'Invalid email or password') {
    statusCode = 401;
    message = 'Invalid email or password';
  } else if (err.message === 'Email already exists' || err.message === 'Email already registered') {
    statusCode = 409;
    message = 'Email already registered';
  } else if (err.message === 'Access token required' || err.message === 'Invalid or expired token') {
    statusCode = err.message.includes('required') ? 401 : 403;
  } else if (err.message?.includes('duplicate') || err.message?.includes('unique')) {
    statusCode = 409;
    message = 'Email already registered';
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
