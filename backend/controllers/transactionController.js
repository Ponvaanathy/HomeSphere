const pool = require('../config/db');

// POST /api/transactions/express-interest
const expressInterest = async (req, res, next) => {
  try {
    const buyerId = req.user.id;
    const { property_id, deal_type = 'buy', notes = 'User expressed high interest' } = req.body;

    const [propRows] = await pool.query('SELECT owner_id, title, price, type FROM properties WHERE id = ?', [property_id]);
    if (!propRows || propRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Property not found.' });
    }

    const prop = propRows[0];
    const sellerId = prop.owner_id;

    const [result] = await pool.query(
      `INSERT INTO transactions (property_id, buyer_id, seller_id, deal_type, offer_amount, deposit_amount, current_stage, status)
       VALUES (?, ?, ?, ?, ?, ?, 'interested', 'active')`,
      [property_id, buyerId, sellerId, deal_type || prop.type, prop.price, prop.price * 0.03]
    );

    const txId = result.insertId;

    await pool.query(
      `INSERT INTO transaction_milestones (transaction_id, stage_name, notes)
       VALUES (?, 'Interested', ?)`,
      [txId, notes || 'Property saved and initial decision intelligence reviewed.']
    );

    res.status(201).json({
      success: true,
      message: 'Interest registered! Transaction workflow initialized.',
      data: { transaction_id: txId }
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/transactions/schedule-visit
const scheduleVisit = async (req, res, next) => {
  try {
    const buyerId = req.user.id;
    const { property_id, visit_date = '2026-08-28 14:00:00', visit_type = 'in_person', notes = '' } = req.body;

    const [propRows] = await pool.query('SELECT owner_id, title, price, type FROM properties WHERE id = ?', [property_id]);
    if (!propRows || propRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Property not found.' });
    }

    const prop = propRows[0];
    const sellerId = prop.owner_id;

    // Check if an active transaction already exists between this buyer and property
    const [existing] = await pool.query(
      'SELECT id FROM transactions WHERE property_id = ? AND buyer_id = ? AND status = "active"',
      [property_id, buyerId]
    );

    let txId;
    if (existing && existing.length > 0) {
      txId = existing[0].id;
      await pool.query(
        'UPDATE transactions SET current_stage = "visit_scheduled", scheduled_visit_date = ? WHERE id = ?',
        [visit_date, txId]
      );
    } else {
      const [result] = await pool.query(
        `INSERT INTO transactions (property_id, buyer_id, seller_id, deal_type, offer_amount, deposit_amount, current_stage, scheduled_visit_date, status)
         VALUES (?, ?, ?, ?, ?, ?, 'visit_scheduled', ?, 'active')`,
        [property_id, buyerId, sellerId, prop.type, prop.price, prop.price * 0.03, visit_date]
      );
      txId = result.insertId;
    }

    await pool.query(
      `INSERT INTO transaction_milestones (transaction_id, stage_name, notes)
       VALUES (?, 'Visit Scheduled', ?)`,
      [txId, `Visit confirmed for ${new Date(visit_date).toLocaleString()} (${visit_type === 'virtual' ? 'Live 360 Virtual Walkthrough' : 'Private On-Site Showing'}). ${notes}`]
    );

    res.status(201).json({
      success: true,
      message: 'Property visit confirmed and added to your transaction workflow.',
      data: { transaction_id: txId }
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/transactions/offer
const submitOffer = async (req, res, next) => {
  try {
    const buyerId = req.user.id;
    const {
      property_id,
      deal_type,
      offer_amount,
      deposit_amount = 5000,
      proposed_closing_date = '2026-10-30',
      contingencies = { financing: true, inspection: true, appraisal: true }
    } = req.body;

    if (!property_id || !offer_amount) {
      return res.status(400).json({ success: false, message: 'Property ID and offer amount are required.' });
    }

    const [propRows] = await pool.query('SELECT owner_id, title, price, type FROM properties WHERE id = ?', [property_id]);
    if (!propRows || propRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Property not found.' });
    }

    const sellerId = propRows[0].owner_id;
    const finalDealType = deal_type || propRows[0].type || 'buy';
    const contingenciesStr = typeof contingencies === 'object' ? JSON.stringify(contingencies) : contingencies;

    // Check existing
    const [existing] = await pool.query(
      'SELECT id FROM transactions WHERE property_id = ? AND buyer_id = ? AND status = "active"',
      [property_id, buyerId]
    );

    let txId;
    if (existing && existing.length > 0) {
      txId = existing[0].id;
      await pool.query(
        `UPDATE transactions
         SET deal_type = ?, offer_amount = ?, deposit_amount = ?, current_stage = 'offer_submitted', contingencies_json = ?, proposed_closing_date = ?
         WHERE id = ?`,
        [finalDealType, parseFloat(offer_amount), parseFloat(deposit_amount), contingenciesStr, proposed_closing_date, txId]
      );
    } else {
      const [result] = await pool.query(
        `INSERT INTO transactions (property_id, buyer_id, seller_id, deal_type, offer_amount, deposit_amount, current_stage, contingencies_json, proposed_closing_date, status)
         VALUES (?, ?, ?, ?, ?, ?, 'offer_submitted', ?, ?, 'active')`,
        [
          property_id,
          buyerId,
          sellerId,
          finalDealType,
          parseFloat(offer_amount),
          parseFloat(deposit_amount),
          contingenciesStr,
          proposed_closing_date
        ]
      );
      txId = result.insertId;
    }

    // Log milestone
    await pool.query(
      `INSERT INTO transaction_milestones (transaction_id, stage_name, notes)
       VALUES (?, 'Offer Submitted', ?)`,
      [txId, `Digital offer of $${Number(offer_amount).toLocaleString()} submitted with $${Number(deposit_amount).toLocaleString()} deposit.`]
    );

    res.status(201).json({
      success: true,
      message: 'Your purchase/rental offer has been registered in the smart transaction tracker.',
      data: { transaction_id: txId }
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/transactions/my-deals
const getMyDeals = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [deals] = await pool.query(
      `SELECT t.*,
              p.title as property_title, p.city as property_city, p.price as property_price, p.type as property_type,
              b.name as buyer_name, b.email as buyer_email,
              s.name as seller_name, s.email as seller_email,
              (SELECT image_url FROM property_images WHERE property_id = p.id ORDER BY is_primary DESC, id ASC LIMIT 1) as primary_image
       FROM transactions t
       JOIN properties p ON t.property_id = p.id
       JOIN users b ON t.buyer_id = b.id
       JOIN users s ON t.seller_id = s.id
       WHERE t.buyer_id = ? OR t.seller_id = ?
       ORDER BY t.created_at DESC`,
      [userId, userId]
    );

    res.json({
      success: true,
      data: deals
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/transactions/:id
const getTransactionById = async (req, res, next) => {
  try {
    const txId = req.params.id;

    const [txRows] = await pool.query(
      `SELECT t.*,
              p.title as property_title, p.address as property_address, p.city as property_city, p.price as property_price,
              b.name as buyer_name, b.email as buyer_email,
              s.name as seller_name, s.email as seller_email,
              (SELECT image_url FROM property_images WHERE property_id = p.id ORDER BY is_primary DESC, id ASC LIMIT 1) as primary_image
       FROM transactions t
       JOIN properties p ON t.property_id = p.id
       JOIN users b ON t.buyer_id = b.id
       JOIN users s ON t.seller_id = s.id
       WHERE t.id = ?`,
      [txId]
    );

    if (!txRows || txRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Transaction deal not found.' });
    }

    const [milestones] = await pool.query(
      'SELECT * FROM transaction_milestones WHERE transaction_id = ? ORDER BY completed_at ASC',
      [txId]
    );

    res.json({
      success: true,
      data: {
        ...txRows[0],
        milestones
      }
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/transactions/:id/milestone
const updateMilestone = async (req, res, next) => {
  try {
    const txId = req.params.id;
    const { stage_name, notes = '', document_url = null } = req.body;

    const stageMap = {
      'Interested': 'interested',
      'Visit Scheduled': 'visit_scheduled',
      'Offer Submitted': 'offer_submitted',
      'Offer Accepted': 'offer_accepted',
      'Document Verification': 'doc_verification',
      'Agreement Pending': 'agreement_pending',
      'Completed': 'completed'
    };

    const newStage = stageMap[stage_name] || 'doc_verification';

    await pool.query(
      'UPDATE transactions SET current_stage = ? WHERE id = ?',
      [newStage, txId]
    );

    await pool.query(
      `INSERT INTO transaction_milestones (transaction_id, stage_name, notes, document_url)
       VALUES (?, ?, ?, ?)`,
      [txId, stage_name, notes, document_url]
    );

    res.json({
      success: true,
      message: `Transaction stage advanced to "${stage_name}".`
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/transactions/:id/status
const updateTransactionStatus = async (req, res, next) => {
  try {
    const txId = req.params.id;
    const { status, notes = '' } = req.body;

    if (!['active', 'completed', 'cancelled', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    await pool.query('UPDATE transactions SET status = ? WHERE id = ?', [status, txId]);

    await pool.query(
      `INSERT INTO transaction_milestones (transaction_id, stage_name, notes)
       VALUES (?, ?, ?)`,
      [txId, `Status: ${status.toUpperCase()}`, notes || `Deal marked as ${status}.`]
    );

    res.json({
      success: true,
      message: `Transaction status updated to ${status}.`
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  expressInterest,
  scheduleVisit,
  submitOffer,
  getMyDeals,
  getTransactionById,
  updateMilestone,
  updateTransactionStatus
};
