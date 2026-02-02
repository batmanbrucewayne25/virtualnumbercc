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
    console.log('🔐 [Auth Middleware] Verifying token...');
    console.log('🔑 [Auth Middleware] Token (first 50 chars):', token.substring(0, 50));
    
    const decoded = AuthService.verifyToken(token);
    console.log('✅ [Auth Middleware] Token verified successfully');
    console.log('👤 [Auth Middleware] Decoded user:', { userId: decoded.userId, email: decoded.email, role: decoded.role });

    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (error) {
    console.error('❌ [Auth Middleware] Token verification failed:', error.name, error.message);
    console.error('📚 [Auth Middleware] Error stack:', error.stack);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
        error: error.message
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
