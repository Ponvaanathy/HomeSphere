const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Helper to generate JWT Token
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET || 'homesphere_jwt_secret_key_ultra_secure_2026_antigravity',
    { expiresIn: '7d' }
  );
};

// POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const { name, email, password, role = 'user', phone = '' } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

    const validRoles = ['user', 'buyer', 'seller', 'admin'];
    const userRole = validRoles.includes(role) ? role : 'user';

    // Check if user already exists
    const [existingUsers] = await pool.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existingUsers && existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), email.toLowerCase().trim(), passwordHash, userRole, phone.trim()]
    );

    const newUserId = result.insertId;

    // Create default user preferences entry
    await pool.query(
      'INSERT INTO user_preferences (user_id, budget_min, budget_max, preferred_city, preferred_type, lifestyle_json) VALUES (?, 100000, 2000000, "Austin", "apartment", ?)',
      [newUserId, JSON.stringify({ prioritize_green: true, near_transit: true, top_schools: false })]
    );

    const newUser = {
      id: newUserId,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      role: userRole,
      phone: phone.trim(),
      avatar_url: '/images/users/default-avatar.png'
    };

    const token = generateToken(newUser);

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      data: {
        user: newUser,
        token
      }
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.'
      });
    }

    // Find user by email
    const [rows] = await pool.query(
      'SELECT id, name, email, password_hash, role, phone, avatar_url, status FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    );

    if (!rows || rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const user = rows[0];

    if (user.status === 'banned') {
      return res.status(403).json({
        success: false,
        message: 'This account has been suspended by administration. Please contact support.'
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      avatar_url: user.avatar_url,
      status: user.status
    };

    const token = generateToken(safeUser);

    res.json({
      success: true,
      message: 'Logged in successfully.',
      data: {
        user: safeUser,
        token
      }
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/me
const getMe = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.phone, u.avatar_url, u.status, u.created_at,
              p.budget_min, p.budget_max, p.preferred_city, p.preferred_type, p.lifestyle_json
       FROM users u
       LEFT JOIN user_preferences p ON u.id = p.user_id
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.'
      });
    }

    const user = rows[0];
    res.json({
      success: true,
      data: user
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/reset-password
const resetPassword = async (req, res, next) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email and new password are required.' });
    }

    const [users] = await pool.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (!users || users.length === 0) {
      return res.status(404).json({ success: false, message: 'No account associated with that email address.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPassword, salt);

    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, users[0].id]);

    res.json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new credentials.'
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/change-password
const changePassword = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both your current password and new password.'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long.'
      });
    }

    const [rows] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [userId]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect.'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPassword, salt);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, userId]);

    res.json({
      success: true,
      message: 'Password changed successfully.'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  login,
  getMe,
  resetPassword,
  changePassword
};



