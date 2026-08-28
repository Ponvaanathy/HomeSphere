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

    // If transaction marked completed, automatically update property status to sold/rented
    if (status === 'completed') {
      const [txInfo] = await pool.query('SELECT property_id, deal_type FROM transactions WHERE id = ?', [txId]);
      if (txInfo.length > 0) {
        const propStatus = txInfo[0].deal_type === 'rent' ? 'rented' : (txInfo[0].deal_type === 'lease' ? 'leased' : 'sold');
        await pool.query('UPDATE properties SET status = ?, updated_at = NOW() WHERE id = ?', [propStatus, txInfo[0].property_id]);
        console.log(`🏠 [Transaction Completed] Property #${txInfo[0].property_id} status updated to "${propStatus}".`);
      }
    }

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

// GET /api/transactions/:id/report
const getTransactionReport = async (req, res, next) => {
  try {
    const txId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    const [transactions] = await pool.query(
      `SELECT t.*,
              p.title as property_title, p.category as property_category, p.subcategory as property_subcategory,
              p.address as property_address, p.locality as property_locality, p.city as property_city, p.state as property_state,
              p.bedrooms, p.bathrooms, p.area_sqft, p.price as base_price, p.type as listing_type,
              (SELECT image_url FROM property_images WHERE property_id = p.id ORDER BY is_primary DESC, id ASC LIMIT 1) as primary_image,
              u_b.name as buyer_name, u_b.role as buyer_role,
              u_s.name as seller_name, u_s.role as seller_role,
              ts.score as trust_score, gs.score as green_score, ls.score as life_score,
              hc.registration_cost, hc.stamp_duty, hc.maintenance_est_annual, hc.repair_contingency, hc.total_est_first_year
       FROM transactions t
       JOIN properties p ON t.property_id = p.id
       JOIN users u_b ON t.buyer_id = u_b.id
       JOIN users u_s ON t.seller_id = u_s.id
       LEFT JOIN trust_scores ts ON p.id = ts.property_id
       LEFT JOIN green_scores gs ON p.id = gs.property_id
       LEFT JOIN life_scores ls ON p.id = ls.property_id
       LEFT JOIN hidden_costs hc ON p.id = hc.property_id
       WHERE t.id = ?`,
      [txId]
    );

    if (!transactions || transactions.length === 0) {
      return res.status(404).json({ success: false, message: 'Transaction record not found.' });
    }

    const t = transactions[0];

    // Authorization check
    if (t.buyer_id !== userId && t.seller_id !== userId && userRole !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized access to transaction report.' });
    }

    const isRent = t.deal_type === 'rent' || t.deal_type === 'lease';
    const agreedAmount = Number(t.offer_amount || t.base_price);
    const depositAmount = Number(t.deposit_amount || (isRent ? agreedAmount * 3 : agreedAmount * 0.05));
    const stampDuty = Number(t.stamp_duty || Math.round(agreedAmount * (isRent ? 0.01 : 0.07)));
    const regFee = Number(t.registration_cost || (isRent ? 1000 : Math.round(agreedAmount * 0.01)));
    const annualMaint = Number(t.maintenance_est_annual || Math.round(Number(t.area_sqft || 1000) * 2.5 * 12));
    const totalOutlay = isRent ? (agreedAmount * 12) + depositAmount + annualMaint : agreedAmount + stampDuty + regFee + annualMaint;

    const reportData = {
      report_title: 'HOMESPHERE PROPERTY TRANSACTION SUMMARY',
      transaction_id: `HS-TX-${t.id}-2026`,
      transaction_raw_id: t.id,
      transaction_date: t.created_at,
      completion_date: t.updated_at || t.created_at,
      status: (t.status || 'completed').toUpperCase(),
      current_stage: t.current_stage,
      deal_type: (t.deal_type || 'buy').toUpperCase(),
      buyer: {
        id: t.buyer_id,
        name: t.buyer_name || 'HomeSphere Buyer',
        role: t.buyer_role || 'Buyer'
      },
      seller: {
        id: t.seller_id,
        name: t.seller_name || 'HomeSphere Seller',
        role: t.seller_role || 'Owner'
      },
      property: {
        id: t.property_id,
        title: t.property_title,
        category: (t.property_category || 'Residential').toUpperCase(),
        subcategory: t.property_subcategory || 'Apartment',
        address: t.property_address,
        locality: t.property_locality || '',
        city: t.property_city,
        state: t.property_state,
        bedrooms: t.bedrooms || 1,
        bathrooms: t.bathrooms || 1,
        area_sqft: t.area_sqft ? `${Number(t.area_sqft).toLocaleString()} sq.ft` : 'N/A',
        primary_image: t.primary_image || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=600&q=80'
      },
      financial_summary: {
        agreed_price: agreedAmount,
        deposit_amount: depositAmount,
        stamp_duty_charge: stampDuty,
        registration_charge: regFee,
        maintenance_annual: annualMaint,
        total_transaction_amount: totalOutlay,
        currency: 'INR'
      },
      decision_snapshot: {
        trust_score: `${t.trust_score || 94}/100`,
        green_living_score: `${t.green_score || 88}/100`,
        locality_life_score: `${t.life_score || 86}/100`
      },
      legal_disclaimer: 'This is a HomeSphere transaction summary based on information recorded on the platform. It is not a government registration certificate, title deed, or proof of legal ownership.'
    };

    res.json({
      success: true,
      data: reportData
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
  updateTransactionStatus,
  getTransactionReport
};

