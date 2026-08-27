const pool = require('../config/db');

// POST /api/contact
const submitInquiry = async (req, res, next) => {
  try {
    const userId = req.user ? req.user.id : null;
    const { property_id, name, email, phone, message, inquiry_type = 'general' } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and message are required.'
      });
    }

    const [result] = await pool.query(
      `INSERT INTO contacts (user_id, property_id, name, email, phone, message, inquiry_type, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'new')`,
      [userId, property_id || null, name.trim(), email.toLowerCase().trim(), phone ? phone.trim() : null, message.trim(), inquiry_type]
    );

    res.status(201).json({
      success: true,
      message: 'Your inquiry has been sent successfully. The agent/team will get back to you shortly.',
      data: { id: result.insertId }
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/contact/my-inquiries
const getMyInquiries = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [inquiries] = await pool.query(
      `SELECT c.*, p.title as property_title, p.city as property_city, p.price as property_price
       FROM contacts c
       LEFT JOIN properties p ON c.property_id = p.id
       WHERE c.user_id = ?
       ORDER BY c.created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: inquiries
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/contact/seller/received
const getSellerInquiries = async (req, res, next) => {
  try {
    const sellerId = req.user.id;

    const [inquiries] = await pool.query(
      `SELECT c.*, p.title as property_title, p.city as property_city, p.price as property_price
       FROM contacts c
       JOIN properties p ON c.property_id = p.id
       WHERE p.owner_id = ?
       ORDER BY c.created_at DESC`,
      [sellerId]
    );

    res.json({
      success: true,
      data: inquiries
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/contact/:id/status
const updateInquiryStatus = async (req, res, next) => {
  try {
    const inquiryId = req.params.id;
    const { status } = req.body;

    const validStatuses = ['new', 'in_progress', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }

    await pool.query('UPDATE contacts SET status = ? WHERE id = ?', [status, inquiryId]);

    res.json({
      success: true,
      message: 'Inquiry status updated successfully.'
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/contact/admin/all
const getAllInquiries = async (req, res, next) => {
  try {
    const [inquiries] = await pool.query(
      `SELECT c.*, p.title as property_title, u.name as registered_user_name
       FROM contacts c
       LEFT JOIN properties p ON c.property_id = p.id
       LEFT JOIN users u ON c.user_id = u.id
       ORDER BY c.created_at DESC`
    );

    res.json({
      success: true,
      data: inquiries
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  submitInquiry,
  getMyInquiries,
  getSellerInquiries,
  updateInquiryStatus,
  getAllInquiries
};
