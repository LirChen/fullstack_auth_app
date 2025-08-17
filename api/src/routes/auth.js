const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const log4js = require('log4js');

const { User, Token } = require('../utils/database');
const { logUserActivity } = require('../utils/logging');
const { sendUserActivity } = require('../utils/kafka');

const router = express.Router();
const logger = log4js.getLogger('auth');

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Validation middleware
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
];

const validateRegister = [
  body('username')
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3-30 characters and contain only letters, numbers, and underscores'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must be at least 6 characters with uppercase, lowercase, and number')
];

// Register endpoint
router.post('/register', validateRegister, async (req, res) => {
  const startTime = Date.now();
  const clientIP = req.ip || req.connection.remoteAddress;

  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      logUserActivity(null, 'REGISTER_FAILED', clientIP, {
        userAgent: req.get('user-agent'),
        errorMessage: 'Email already registered',
        duration: `${Date.now() - startTime}ms`
      });
      
      return res.status(400).json({
        error: 'Registration failed',
        message: 'Email already registered'
      });
    }

    const existingUsername = await User.findByUsername(username);
    if (existingUsername) {
      logUserActivity(null, 'REGISTER_FAILED', clientIP, {
        userAgent: req.get('user-agent'),
        errorMessage: 'Username already taken',
        duration: `${Date.now() - startTime}ms`
      });
      
      return res.status(400).json({
        error: 'Registration failed',
        message: 'Username already taken'
      });
    }

    // Hash password
    const saltRounds = 12;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Create user
    const userId = await User.create({
      username,
      email,
      password_hash
    });

    // Generate JWT token
    const token = jwt.sign(
      { userId, username, email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Store token in database
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await Token.create(userId, token, expiresAt);

    // Log successful registration
    const activityData = logUserActivity(userId, 'USER_REGISTERED', clientIP, {
      userAgent: req.get('user-agent'),
      duration: `${Date.now() - startTime}ms`
    });

    // Send to Kafka
    await sendUserActivity(activityData);

    logger.info({
      timestamp: new Date().toISOString(),
      action: 'USER_REGISTERED',
      userId: userId,
      username: username,
      ip: clientIP
    });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: userId,
        username,
        email
      }
    });

  } catch (error) {
    logger.error({
      timestamp: new Date().toISOString(),
      error: 'Registration failed',
      details: error.message,
      ip: clientIP
    });

    logUserActivity(null, 'REGISTER_ERROR', clientIP, {
      userAgent: req.get('user-agent'),
      errorMessage: error.message,
      duration: `${Date.now() - startTime}ms`,
      success: false
    });

    res.status(500).json({
      error: 'Registration failed',
      message: 'Internal server error'
    });
  }
});

// Login endpoint
router.post('/login', validateLogin, async (req, res) => {
  const startTime = Date.now();
  const clientIP = req.ip || req.connection.remoteAddress;

  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find user
    const user = await User.findByEmail(email);
    if (!user) {
      logUserActivity(null, 'LOGIN_FAILED', clientIP, {
        userAgent: req.get('user-agent'),
        errorMessage: 'User not found',
        duration: `${Date.now() - startTime}ms`,
        success: false
      });

      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid credentials'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      logUserActivity(user.id, 'LOGIN_FAILED', clientIP, {
        userAgent: req.get('user-agent'),
        errorMessage: 'Invalid password',
        duration: `${Date.now() - startTime}ms`,
        success: false
      });

      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid credentials'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Store token in database
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await Token.create(user.id, token, expiresAt);

    // Update last login
    await User.updateLastLogin(user.id, clientIP);

    // Log successful login
    const activityData = logUserActivity(user.id, 'USER_LOGIN', clientIP, {
      userAgent: req.get('user-agent'),
      duration: `${Date.now() - startTime}ms`
    });

    // Send to Kafka
    await sendUserActivity(activityData);

    logger.info({
      timestamp: new Date().toISOString(),
      action: 'USER_LOGIN',
      userId: user.id,
      username: user.username,
      ip: clientIP
    });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });

  } catch (error) {
    logger.error({
      timestamp: new Date().toISOString(),
      error: 'Login failed',
      details: error.message,
      ip: clientIP
    });

    logUserActivity(null, 'LOGIN_ERROR', clientIP, {
      userAgent: req.get('user-agent'),
      errorMessage: error.message,
      duration: `${Date.now() - startTime}ms`,
      success: false
    });

    res.status(500).json({
      error: 'Authentication failed',
      message: 'Internal server error'
    });
  }
});

// Logout endpoint
router.post('/logout', async (req, res) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (token) {
      // Invalidate token
      await Token.invalidate(token);
      
      // Get token info for logging
      const tokenInfo = await Token.findValid(token);
      
      if (tokenInfo) {
        logUserActivity(tokenInfo.user_id, 'USER_LOGOUT', clientIP, {
          userAgent: req.get('user-agent')
        });
        
        logger.info({
          timestamp: new Date().toISOString(),
          action: 'USER_LOGOUT',
          userId: tokenInfo.user_id,
          ip: clientIP
        });
      }
    }

    res.json({ message: 'Logout successful' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Token validation endpoint
router.get('/validate', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const tokenInfo = await Token.findValid(token);
    
    if (!tokenInfo) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    res.json({
      valid: true,
      user: {
        id: tokenInfo.user_id,
        username: tokenInfo.username,
        email: tokenInfo.email
      }
    });
  } catch (error) {
    logger.error('Token validation error:', error);
    res.status(500).json({ error: 'Token validation failed' });
  }
});

module.exports = router;