import { AuthService } from '../services/auth.service.js';

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request object
 */
export const authMiddleware = async (req, res, next) => {
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

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Authorization required.'
      });
    }

    // Verify token
    const decoded = AuthService.verifyToken(token);

    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired',
        expired: true
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};
