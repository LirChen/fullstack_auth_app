const jwt = require('jsonwebtoken');
const log4js = require('log4js');
const { Token } = require('./database');
const { AuthenticationError, AuthorizationError } = require('./errors');

const logger = log4js.getLogger('auth-middleware');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Verify JWT token and attach user to request
async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.replace('Bearer ', '');

    if (!token) {
      throw new AuthenticationError('No token provided');
    }

    // Verify JWT
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check if token exists in database and is valid
    const tokenInfo = await Token.findValid(token);
    
    if (!tokenInfo) {
      throw new AuthenticationError('Invalid or expired token');
    }

    // Update last used timestamp
    await Token.updateLastUsed(token);

    // Attach user info to request
    req.user = {
      id: decoded.userId,
      username: decoded.username,
      email: decoded.email
    };
    req.token = token;

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new AuthenticationError('Invalid token'));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new AuthenticationError('Token expired'));
    }
    next(error);
  }
}

// Optional authentication (doesn't fail if no token)
async function authenticateOptional(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.replace('Bearer ', '');

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      const tokenInfo = await Token.findValid(token);
      
      if (tokenInfo) {
        req.user = {
          id: decoded.userId,
          username: decoded.username,
          email: decoded.email
        };
        req.token = token;
      }
    }
    next();
  } catch (error) {
    // Don't fail, just continue without user
    next();
  }
}

// Check if user has specific role (for future role-based access)
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required'));
    }

    if (req.user.role && roles.includes(req.user.role)) {
      return next();
    }

    next(new AuthorizationError('Insufficient permissions'));
  };
}

module.exports = {
  authenticateToken,
  authenticateOptional,
  requireRole
};
