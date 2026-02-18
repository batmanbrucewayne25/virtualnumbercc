import { AuthService } from '../services/auth.service.js';

/**
 * Optional authentication middleware
 * Verifies JWT token if provided, but doesn't fail if no token
 * Useful for endpoints that can work with or without authentication
 */
export const optionalAuthMiddleware = async (req, res, next) => {
  try {
    // Get token from Authorization header or body
    let token = null;
    
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.body && req.body.token) {
      token = req.body.token;
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    // If token is provided, verify it
    if (token) {
      try {
        const decoded = AuthService.verifyToken(token);
        // Attach user info to request
        req.user = {
          userId: decoded.userId,
          email: decoded.email,
          role: decoded.role
        };
      } catch (error) {
        // Token is invalid, but we continue without user
        console.warn('Optional auth: Invalid token provided, continuing without authentication');
      }
    }
    // If no token, continue without user (req.user will be undefined)

    next();
  } catch (error) {
    // Even if there's an error, continue (this is optional auth)
    console.warn('Optional auth middleware error:', error.message);
    next();
  }
};

