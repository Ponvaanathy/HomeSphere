const pool = require('../config/db');

// GET /api/users/profile
const getProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [users] = await pool.query(
      `SELECT id, name, email, role, phone, avatar_url, status, created_at
       FROM users WHERE id = ?`,
      [userId]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const [prefs] = await pool.query(
      `SELECT budget_min, budget_max, preferred_city, preferred_type, lifestyle_json, priority_weights_json
       FROM user_preferences WHERE user_id = ?`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        ...users[0],
        preferences: prefs[0] || null
      }
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/users/profile
const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, phone } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Name cannot be empty.' });
    }

    await pool.query(
      'UPDATE users SET name = ?, phone = ? WHERE id = ?',
      [name.trim(), phone ? phone.trim() : null, userId]
    );

    res.json({
      success: true,
      message: 'Profile updated successfully.'
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/users/avatar
const updateAvatar = async (req, res, next) => {
  try {
    const userId = req.user.id;
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file uploaded.' });
    }

    const avatarUrl = `/images/users/${req.file.filename}`;
    await pool.query('UPDATE users SET avatar_url = ? WHERE id = ?', [avatarUrl, userId]);

    res.json({
      success: true,
      message: 'Avatar updated successfully.',
      data: { avatar_url: avatarUrl }
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/users/preferences
const getPreferences = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [rows] = await pool.query('SELECT * FROM user_preferences WHERE user_id = ?', [userId]);

    if (!rows || rows.length === 0) {
      return res.json({
        success: true,
        data: {
          budget_min: 100000,
          budget_max: 1500000,
          preferred_city: 'Austin',
          preferred_type: 'apartment',
          lifestyle_json: { prioritize_green: true, near_transit: true, top_schools: true }
        }
      });
    }

    res.json({
      success: true,
      data: rows[0]
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/users/preferences
const updatePreferences = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { budget_min, budget_max, preferred_city, preferred_type, lifestyle_json, priority_weights_json } = req.body;

    const lifestyleStr = typeof lifestyle_json === 'object' ? JSON.stringify(lifestyle_json) : lifestyle_json;
    const weightsStr = typeof priority_weights_json === 'object' ? JSON.stringify(priority_weights_json) : priority_weights_json;

    await pool.query(
      `INSERT INTO user_preferences (user_id, budget_min, budget_max, preferred_city, preferred_type, lifestyle_json, priority_weights_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       budget_min = VALUES(budget_min),
       budget_max = VALUES(budget_max),
       preferred_city = VALUES(preferred_city),
       preferred_type = VALUES(preferred_type),
       lifestyle_json = VALUES(lifestyle_json),
       priority_weights_json = VALUES(priority_weights_json)`,
      [
        userId,
        budget_min || 100000,
        budget_max || 1500000,
        preferred_city || 'Austin',
        preferred_type || 'apartment',
        lifestyleStr || null,
        weightsStr || null
      ]
    );

    res.json({
      success: true,
      message: 'Decision preferences updated successfully.'
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/users/activity
const getUserActivity = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Saved properties count
    const [savedRows] = await pool.query('SELECT COUNT(*) as count FROM saved_properties WHERE user_id = ?', [userId]);

    // Recent inquiries count
    const [contactRows] = await pool.query('SELECT COUNT(*) as count FROM contacts WHERE user_id = ?', [userId]);

    // Properties listed if seller
    const [listedRows] = await pool.query('SELECT COUNT(*) as count FROM properties WHERE owner_id = ?', [userId]);

    // Recent saved properties preview
    const [recentSaved] = await pool.query(
      `SELECT p.id, p.title, p.price, p.type, p.city, p.bedrooms, p.bathrooms, p.area_sqft,
              ts.score as trust_score,
              (SELECT image_url FROM property_images WHERE property_id = p.id ORDER BY is_primary DESC, id ASC LIMIT 1) as primary_image
       FROM saved_properties sp
       JOIN properties p ON sp.property_id = p.id
       LEFT JOIN trust_scores ts ON p.id = ts.property_id
       WHERE sp.user_id = ?
       ORDER BY sp.saved_at DESC
       LIMIT 4`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        saved_count: savedRows?.[0]?.count || 0,
        inquiries_count: contactRows?.[0]?.count || 0,
        listed_count: listedRows?.[0]?.count || 0,
        recent_saved: recentSaved || []
      }
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/users/dashboard-stats
const getDashboardStats = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // 1. Properties Listed for Sale by this user
    const [forSaleRows] = await pool.query(
      `SELECT COUNT(*) as count FROM properties WHERE owner_id = ? AND (type = 'buy' OR type = 'sale')`,
      [userId]
    );
    const propertiesForSale = Number(forSaleRows[0]?.count || 0);

    // 2. Properties Listed for Rent by this user
    const [forRentRows] = await pool.query(
      `SELECT COUNT(*) as count FROM properties WHERE owner_id = ? AND type = 'rent'`,
      [userId]
    );
    const propertiesForRent = Number(forRentRows[0]?.count || 0);

    // 3. Properties Purchased by this user (completed / closed buy transactions)
    const [purchasedRows] = await pool.query(
      `SELECT COUNT(*) as count FROM transactions
       WHERE buyer_id = ? AND deal_type = 'buy' AND (status = 'completed' OR current_stage = 'completed')`,
      [userId]
    );
    const propertiesPurchased = Number(purchasedRows[0]?.count || 0);

    // 4. Properties Rented by this user (approved rental applications OR completed rent transactions)
    const [rentedCombinedRows] = await pool.query(
      `SELECT COUNT(DISTINCT property_id) as count FROM (
         SELECT property_id FROM rental_applications WHERE user_id = ? AND status = 'approved'
         UNION
         SELECT property_id FROM transactions WHERE buyer_id = ? AND deal_type = 'rent' AND (status = 'completed' OR current_stage = 'completed')
       ) as user_rentals`,
      [userId, userId]
    );
    const propertiesRented = Number(rentedCombinedRows[0]?.count || 0);

    // 5. Additional live activity counters for the dashboard hubs
    // Saved properties count
    const [savedRows] = await pool.query(
      `SELECT COUNT(*) as count FROM saved_properties WHERE user_id = ?`,
      [userId]
    );
    const savedProperties = Number(savedRows[0]?.count || 0);

    // Active buy transactions / offers submitted by this user
    const [activeDealsRows] = await pool.query(
      `SELECT COUNT(*) as count FROM transactions WHERE buyer_id = ? AND deal_type = 'buy' AND status = 'active'`,
      [userId]
    );
    const activeDeals = Number(activeDealsRows[0]?.count || 0);

    // Scheduled visits (as buyer or seller)
    const [visitsRows] = await pool.query(
      `SELECT COUNT(*) as count FROM transactions
       WHERE (buyer_id = ? OR seller_id = ?) AND current_stage = 'visit_scheduled' AND status = 'active'`,
      [userId, userId]
    );
    const scheduledVisits = Number(visitsRows[0]?.count || 0);

    // Offers received on user's listings
    const [offersReceivedRows] = await pool.query(
      `SELECT COUNT(*) as count FROM transactions WHERE seller_id = ? AND status = 'active'`,
      [userId]
    );
    const offersReceived = Number(offersReceivedRows[0]?.count || 0);

    // Inquiries received on user's listings
    const [inquiriesRows] = await pool.query(
      `SELECT COUNT(*) as count FROM contacts WHERE property_id IN (SELECT id FROM properties WHERE owner_id = ?)`,
      [userId]
    );
    const inquiriesReceived = Number(inquiriesRows[0]?.count || 0);

    // Average trust score of user's listings
    const [trustScoreRows] = await pool.query(
      `SELECT AVG(ts.score) as avg_score
       FROM properties p
       JOIN trust_scores ts ON p.id = ts.property_id
       WHERE p.owner_id = ?`,
      [userId]
    );
    const avgTrustScore = trustScoreRows[0]?.avg_score ? Math.round(Number(trustScoreRows[0].avg_score)) : 0;

    // Unread messages count
    const [unreadRows] = await pool.query(
      `SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND is_read = 0`,
      [userId]
    );
    const unreadMessages = Number(unreadRows[0]?.count || 0);

    // Total rental applications submitted by user
    const [rentalAppsRows] = await pool.query(
      `SELECT COUNT(*) as count FROM rental_applications WHERE user_id = ?`,
      [userId]
    );
    const rentalApplicationsCount = Number(rentalAppsRows[0]?.count || 0);

    res.json({
      success: true,
      data: {
        properties_for_sale: propertiesForSale,
        properties_for_rent: propertiesForRent,
        properties_purchased: propertiesPurchased,
        properties_rented: propertiesRented,
        saved_properties: savedProperties,
        active_buy_deals: activeDeals,
        scheduled_visits: scheduledVisits,
        offers_received: offersReceived,
        inquiries_received: inquiriesReceived,
        avg_trust_score: avgTrustScore,
        unread_messages: unreadMessages,
        rental_applications_count: rentalApplicationsCount
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  updateAvatar,
  getPreferences,
  updatePreferences,
  getUserActivity,
  getDashboardStats
};
