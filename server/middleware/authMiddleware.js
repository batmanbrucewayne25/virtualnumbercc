import { verifyToken } from '../services/authService.js';

/**
 * Middleware to authenticate JWT tokens
 */
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required',
    });
  }

  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(403).json({
      success: false,
      error: 'Invalid or expired token',
    });
  }

  // Attach user info to request
  req.user = decoded;
  next();
};

/**
 * Optional authentication - doesn't fail if no token
 */
export const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      req.user = decoded;
    }
  }

  next();
};
