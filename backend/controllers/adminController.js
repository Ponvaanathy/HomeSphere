const pool = require('../config/db');

// GET /api/admin/stats
const getDashboardStats = async (req, res, next) => {
  try {
    const [userCounts] = await pool.query(`
      SELECT
        COUNT(*) as total_users,
        SUM(CASE WHEN role IN ('user', 'buyer') THEN 1 ELSE 0 END) as buyers,
        SUM(CASE WHEN role IN ('user', 'seller') THEN 1 ELSE 0 END) as sellers,
        SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admins
      FROM users
    `);

    const [propCounts] = await pool.query(`
      SELECT
        COUNT(*) as total_properties,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_properties,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_properties,
        SUM(CASE WHEN type = 'buy' THEN 1 ELSE 0 END) as for_sale,
        SUM(CASE WHEN type = 'rent' THEN 1 ELSE 0 END) as for_rent
      FROM properties
    `);

    const [docCounts] = await pool.query(`
      SELECT
        COUNT(*) as total_docs,
        SUM(CASE WHEN verified_status = 'pending' THEN 1 ELSE 0 END) as pending_verification,
        SUM(CASE WHEN verified_status = 'verified' THEN 1 ELSE 0 END) as verified_docs
      FROM property_documents
    `);

    const [inquiryCounts] = await pool.query('SELECT COUNT(*) as total_inquiries FROM contacts');

    const [recentActions] = await pool.query(`
      SELECT a.*, u.name as admin_name
      FROM admin_actions a
      JOIN users u ON a.admin_id = u.id
      ORDER BY a.created_at DESC
      LIMIT 6
    `);

    res.json({
      success: true,
      data: {
        users: userCounts[0],
        properties: propCounts[0],
        documents: docCounts[0],
        inquiries: inquiryCounts[0],
        recent_actions: recentActions
      }
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/users
const getUsers = async (req, res, next) => {
  try {
    const { role, status, search = '' } = req.query;
    let conditions = [];
    let params = [];

    if (role && role !== 'all') {
      conditions.push('role = ?');
      params.push(role);
    }

    if (status && status !== 'all') {
      conditions.push('status = ?');
      params.push(status);
    }

    if (search.trim()) {
      conditions.push('(name LIKE ? OR email LIKE ? OR phone LIKE ?)');
      params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [users] = await pool.query(
      `SELECT id, name, email, role, phone, avatar_url, status, created_at,
              (SELECT COUNT(*) FROM properties WHERE owner_id = users.id) as property_count
       FROM users
       ${whereClause}
       ORDER BY created_at DESC`,
      params
    );

    res.json({
      success: true,
      data: users
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/admin/users/:id/role
const updateUserRole = async (req, res, next) => {
  try {
    const targetUserId = req.params.id;
    const { role } = req.body;
    const adminId = req.user.id;

    if (!['user', 'buyer', 'seller', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role specified.' });
    }

    await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, targetUserId]);

    await pool.query(
      'INSERT INTO admin_actions (admin_id, action_type, target_id, target_type, notes) VALUES (?, "UPDATE_USER_ROLE", ?, "user", ?)',
      [adminId, targetUserId, `Updated user #${targetUserId} role to ${role}`]
    );

    res.json({
      success: true,
      message: `User role updated to ${role} successfully.`
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/admin/users/:id/status
const updateUserStatus = async (req, res, next) => {
  try {
    const targetUserId = req.params.id;
    const { status } = req.body;
    const adminId = req.user.id;

    if (!['active', 'banned', 'pending'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status specified.' });
    }

    await pool.query('UPDATE users SET status = ? WHERE id = ?', [status, targetUserId]);

    await pool.query(
      'INSERT INTO admin_actions (admin_id, action_type, target_id, target_type, notes) VALUES (?, "UPDATE_USER_STATUS", ?, "user", ?)',
      [adminId, targetUserId, `Updated user #${targetUserId} status to ${status}`]
    );

    res.json({
      success: true,
      message: `User status updated to ${status} successfully.`
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/properties
const getAllProperties = async (req, res, next) => {
  try {
    const { status = 'all', search = '' } = req.query;
    let conditions = [];
    let params = [];

    if (status !== 'all') {
      conditions.push('p.status = ?');
      params.push(status);
    }

    if (search.trim()) {
      conditions.push('(p.title LIKE ? OR p.city LIKE ? OR u.name LIKE ?)');
      params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [properties] = await pool.query(
      `SELECT p.*, u.name as owner_name, u.email as owner_email,
              ts.score as trust_score,
              (SELECT COUNT(*) FROM property_documents WHERE property_id = p.id) as doc_count,
              (SELECT COUNT(*) FROM property_documents WHERE property_id = p.id AND verified_status = 'verified') as verified_doc_count
       FROM properties p
       JOIN users u ON p.owner_id = u.id
       LEFT JOIN trust_scores ts ON p.id = ts.property_id
       ${whereClause}
       ORDER BY p.created_at DESC`,
      params
    );

    res.json({
      success: true,
      data: properties
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/admin/properties/:id/status
const updatePropertyStatus = async (req, res, next) => {
  try {
    const propertyId = req.params.id;
    const { status, notes = '' } = req.body;
    const adminId = req.user.id;

    if (!['pending', 'active', 'sold', 'rented', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid property status.' });
    }

    await pool.query('UPDATE properties SET status = ? WHERE id = ?', [status, propertyId]);

    await pool.query(
      'INSERT INTO admin_actions (admin_id, action_type, target_id, target_type, notes) VALUES (?, "UPDATE_PROPERTY_STATUS", ?, "property", ?)',
      [adminId, propertyId, `Status updated to ${status}. Notes: ${notes}`]
    );

    res.json({
      success: true,
      message: `Property #${propertyId} status changed to ${status}.`
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/verification-queue
const getVerificationQueue = async (req, res, next) => {
  try {
    const [queue] = await pool.query(
      `SELECT pd.*,
              p.title as property_title, p.city as property_city, p.price as property_price, p.type as property_intent,
              u.name as owner_name, u.email as owner_email
       FROM property_documents pd
       JOIN properties p ON pd.property_id = p.id
       JOIN users u ON p.owner_id = u.id
       ORDER BY (pd.verified_status = 'pending') DESC, pd.created_at DESC`
    );

    res.json({
      success: true,
      data: queue
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/admin/verify-document/:id
const verifyDocument = async (req, res, next) => {
  try {
    const docId = req.params.id;
    const adminId = req.user.id;
    const { verified_status, notes = '' } = req.body;

    if (!['verified', 'rejected', 'pending'].includes(verified_status)) {
      return res.status(400).json({ success: false, message: 'Invalid verification status.' });
    }

    // Update document record
    await pool.query(
      `UPDATE property_documents
       SET verified_status = ?, reviewed_by = ?, reviewed_at = NOW(), notes = ?
       WHERE id = ?`,
      [verified_status, adminId, notes, docId]
    );

    // Get property id for recalculating Trust Score
    const [docRows] = await pool.query('SELECT property_id FROM property_documents WHERE id = ?', [docId]);
    if (docRows.length > 0) {
      const propertyId = docRows[0].property_id;

      // Count verified vs total docs
      const [stats] = await pool.query(
        `SELECT
           COUNT(*) as total_docs,
           SUM(CASE WHEN verified_status = 'verified' THEN 1 ELSE 0 END) as verified_count
         FROM property_documents WHERE property_id = ?`,
        [propertyId]
      );

      const totalDocs = stats[0].total_docs || 1;
      const verifiedCount = stats[0].verified_count || 0;
      const docCompleteness = Math.min(100, Math.round((verifiedCount / Math.max(1, totalDocs)) * 100));
      const newScore = Math.min(99, Math.max(50, 60 + Math.round(docCompleteness * 0.35)));

      await pool.query(
        `UPDATE trust_scores SET
         score = ?,
         document_completeness = ?,
         verification_rating = ?
         WHERE property_id = ?`,
        [newScore, docCompleteness, Math.round(docCompleteness * 0.95), propertyId]
      );

      await pool.query(
        'INSERT INTO admin_actions (admin_id, action_type, target_id, target_type, notes) VALUES (?, "VERIFY_DOCUMENT", ?, "property_document", ?)',
        [adminId, docId, `Marked document #${docId} as ${verified_status}. Trust score updated to ${newScore}.`]
      );
    }

    res.json({
      success: true,
      message: `Document status updated to ${verified_status} and property Trust Score refreshed.`
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getDashboardStats,
  getUsers,
  updateUserRole,
  updateUserStatus,
  getAllProperties,
  updatePropertyStatus,
  getVerificationQueue,
  verifyDocument
};
