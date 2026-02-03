/**
 * Global error handling middleware
 */
export const errorHandler = (err, req, res, next) => {
  // Log error for debugging
  console.error("[Error Handler]", {
    message: err.message,
    stack: err.stack,
    statusCode: err.statusCode,
    name: err.name,
  });

  // Default error
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";

  // Handle specific error types
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = "Validation Error: " + err.message;
  }

  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired";
  }

  // Handle authentication errors (Invalid email or password)
  if (
    message.includes("Invalid email") ||
    message.includes("Invalid password") ||
    message.includes("email or password")
  ) {
    statusCode = 401; // Unauthorized, not 500
  }

  // Handle account status errors (should be 403 Forbidden)
  if (
    message.includes("pending approval") ||
    message.includes("rejected") ||
    message.includes("suspended") ||
    message.includes("expired") ||
    message.includes("inactive")
  ) {
    statusCode = 403; // Forbidden
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};
