const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        sessionInvalid: true,
        message: 'Authentication required. Please provide a valid Bearer token in the Authorization header.'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'homesphere_jwt_secret_key_ultra_secure_2026_antigravity');

    // Verify user actually exists in MySQL database
    const [rows] = await pool.query('SELECT id, name, email, role, status FROM users WHERE id = ?', [decoded.id]);
    if (!rows || rows.length === 0) {
      return res.status(401).json({
        success: false,
        sessionInvalid: true,
        message: 'Your login session is invalid or the account was not found in the database. Please sign in or register.'
      });
    }

    const user = rows[0];
    if (user.status === 'banned') {
      return res.status(403).json({
        success: false,
        message: 'This account has been suspended by administration.'
      });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, sessionInvalid: true, message: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ success: false, sessionInvalid: true, message: 'Invalid authentication token.' });
  }
};

// Optional auth for public routes where user context improves personalization
const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'homesphere_jwt_secret_key_ultra_secure_2026_antigravity');
      const [rows] = await pool.query('SELECT id, name, email, role, status FROM users WHERE id = ?', [decoded.id]);
      if (rows && rows.length > 0) {
        req.user = rows[0];
      } else {
        req.user = null;
      }
    }
  } catch (err) {
    // Silently continue without user
    req.user = null;
  }
  next();
};

module.exports = { authMiddleware, optionalAuthMiddleware };
