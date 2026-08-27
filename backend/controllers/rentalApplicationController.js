const pool = require('../config/db');

// POST /api/rental-applications
const submitApplication = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      property_id,
      applicant_name,
      applicant_email,
      applicant_income_monthly,
      credit_score_est = 720,
      employment_status = 'Employed Full-Time',
      move_in_date,
      occupants_count = 1,
      notes = ''
    } = req.body;

    const name = (applicant_name || req.user.name || 'Applicant').trim();
    const email = (applicant_email || req.user.email || 'applicant@example.com').toLowerCase().trim();
    const income = applicant_income_monthly || req.body.monthly_income;

    if (!property_id || !income || !move_in_date) {
      return res.status(400).json({ success: false, message: 'Please complete all required application fields (property, monthly income, move-in date).' });
    }

    const [result] = await pool.query(
      `INSERT INTO rental_applications
       (property_id, user_id, applicant_name, applicant_email, applicant_income_monthly, credit_score_est, employment_status, move_in_date, occupants_count, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        property_id,
        userId,
        name,
        email,
        parseFloat(income),
        parseInt(credit_score_est),
        employment_status,
        move_in_date,
        parseInt(occupants_count),
        notes
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Rental application submitted successfully. The landlord/agent has received your profile.',
      data: { application_id: result.insertId }
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/rental-applications/my-applications
const getMyApplications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [apps] = await pool.query(
      `SELECT ra.*, p.title as property_title, p.city as property_city, p.price as property_price
       FROM rental_applications ra
       JOIN properties p ON ra.property_id = p.id
       WHERE ra.user_id = ?
       ORDER BY ra.created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: apps
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/rental-applications/seller
const getSellerApplications = async (req, res, next) => {
  try {
    const sellerId = req.user.id;
    const [apps] = await pool.query(
      `SELECT ra.*, p.title as property_title, p.city as property_city, p.price as property_price
       FROM rental_applications ra
       JOIN properties p ON ra.property_id = p.id
       WHERE p.owner_id = ?
       ORDER BY ra.created_at DESC`,
      [sellerId]
    );

    res.json({
      success: true,
      data: apps
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/rental-applications/:id/status
const updateApplicationStatus = async (req, res, next) => {
  try {
    const appId = req.params.id;
    const { status } = req.body;

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    await pool.query('UPDATE rental_applications SET status = ? WHERE id = ?', [status, appId]);

    res.json({
      success: true,
      message: `Rental application #${appId} marked as ${status}.`
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  submitApplication,
  getMyApplications,
  getSellerApplications,
  updateApplicationStatus
};
