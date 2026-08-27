const pool = require('../config/db');

// GET /api/saved
const getSavedProperties = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [saved] = await pool.query(
      `SELECT sp.id as saved_id, sp.notes as saved_notes, sp.saved_at,
              p.*,
              ts.score as trust_score,
              ls.score as life_score,
              gs.score as green_score,
              (SELECT image_url FROM property_images WHERE property_id = p.id ORDER BY is_primary DESC, id ASC LIMIT 1) as primary_image
       FROM saved_properties sp
       JOIN properties p ON sp.property_id = p.id
       LEFT JOIN trust_scores ts ON p.id = ts.property_id
       LEFT JOIN life_scores ls ON p.id = ls.property_id
       LEFT JOIN green_scores gs ON p.id = gs.property_id
       WHERE sp.user_id = ?
       ORDER BY sp.saved_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        properties: saved
      },
      properties: saved
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/saved or POST /api/saved/:propertyId
const saveProperty = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const propertyId = req.params.propertyId || req.body.property_id || req.body.propertyId;
    const { notes = '' } = req.body;

    if (!propertyId) {
      return res.status(400).json({ success: false, message: 'Property ID is required.' });
    }

    await pool.query(
      `INSERT INTO saved_properties (user_id, property_id, notes)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE notes = VALUES(notes)`,
      [userId, propertyId, notes]
    );

    res.json({
      success: true,
      message: 'Property added to saved collection.'
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/saved or DELETE /api/saved/:propertyId
const removeSavedProperty = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const propertyId = req.params.propertyId || req.body.property_id || req.body.propertyId;

    if (!propertyId) {
      return res.status(400).json({ success: false, message: 'Property ID is required.' });
    }

    await pool.query(
      'DELETE FROM saved_properties WHERE user_id = ? AND property_id = ?',
      [userId, propertyId]
    );

    res.json({
      success: true,
      message: 'Property removed from saved collection.'
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/saved/check/:propertyId
const checkIsSaved = async (req, res, next) => {
  try {
    const userId = req.user ? req.user.id : null;
    if (!userId) {
      return res.json({ success: true, is_saved: false });
    }

    const propertyId = req.params.propertyId || req.query.property_id;
    const [rows] = await pool.query(
      'SELECT id FROM saved_properties WHERE user_id = ? AND property_id = ?',
      [userId, propertyId]
    );

    res.json({
      success: true,
      is_saved: rows.length > 0
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getSavedProperties,
  saveProperty,
  removeSavedProperty,
  checkIsSaved
};
