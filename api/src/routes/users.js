// api/src/routes/users.js
const express = require('express');
const log4js = require('log4js');
const { User, Token } = require('../utils/database');
const { logUserActivity } = require('../utils/logging');

const router = express.Router();
const logger = log4js.getLogger('users');

async function authenticate(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    const tokenInfo = await Token.findValid(token);
    if (!tokenInfo) return res.status(401).json({ error: 'Invalid or expired token' });

    req.user = { id: tokenInfo.user_id, username: tokenInfo.username, email: tokenInfo.email };
    next();
  } catch (error) {
    logger.error('Authentication middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

router.get('/profile', authenticate, async (req, res) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    logUserActivity(req.user.id, 'PROFILE_ACCESSED', clientIP, { userAgent: req.get('user-agent') });
    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.created_at,
        last_login: user.last_login,
      },
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

router.get('/list', authenticate, async (req, res) => {
    const clientIP = req.ip || req.connection.remoteAddress;
  try {
    const rows = await require('../utils/database').query(
      'SELECT id, username, email, created_at, last_login FROM users ORDER BY created_at DESC'
    );

    logUserActivity(req.user.id, 'USERS_LIST_ACCESSED', clientIP, {
      userAgent: req.get('user-agent')
    });

    res.json({ users: Array.isArray(rows) ? rows : [] });
  } catch (error) {
    logger.error('Get users list error:', error);
    res.status(500).json({ error: 'Failed to get users list' });
  }
});

module.exports = router;
