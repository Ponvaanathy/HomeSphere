const pool = require('../config/db');

// GET /api/compare
const compareProperties = async (req, res, next) => {
  try {
    const { ids } = req.query;

    if (!ids) {
      return res.status(400).json({
        success: false,
        message: 'Please provide comma-separated property IDs to compare (e.g., ?ids=1,2,3).'
      });
    }

    const idList = ids
      .split(',')
      .map((id) => parseInt(id.trim()))
      .filter((id) => !isNaN(id) && id > 0)
      .slice(0, 4); // Max 4 properties

    if (idList.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid property IDs provided.'
      });
    }

    const placeholders = idList.map(() => '?').join(',');

    // Fetch properties with all AI metrics
    const [properties] = await pool.query(
      `SELECT p.*,
              u.name as owner_name, u.email as owner_email,
              ts.score as trust_score, ts.verification_rating, ts.document_completeness, ts.price_sanity_score, ts.seller_reputation_score, ts.breakdown_json as trust_breakdown,
              dna.age_years, dna.legal_status, dna.structural_notes, dna.flags_json,
              ls.score as life_score, ls.transit_score, ls.school_score, ls.safety_score, ls.amenities_score, ls.breakdown_json as life_breakdown,
              gs.score as green_score, gs.energy_rating, gs.green_cover_pct, gs.air_quality_index, gs.water_conservation, gs.solar_equipped,
              hc.registration_cost, hc.stamp_duty, hc.brokerage_cost, hc.maintenance_est_annual, hc.property_tax_annual, hc.repair_contingency, hc.total_est_first_year,
              fv.predicted_value as fv_5yr, fv.growth_rate_annual,
              (SELECT image_url FROM property_images WHERE property_id = p.id ORDER BY is_primary DESC, id ASC LIMIT 1) as primary_image
       FROM properties p
       JOIN users u ON p.owner_id = u.id
       LEFT JOIN trust_scores ts ON p.id = ts.property_id
       LEFT JOIN property_dna dna ON p.id = dna.property_id
       LEFT JOIN life_scores ls ON p.id = ls.property_id
       LEFT JOIN green_scores gs ON p.id = gs.property_id
       LEFT JOIN hidden_costs hc ON p.id = hc.property_id
       LEFT JOIN future_value_predictions fv ON p.id = fv.property_id AND fv.years = 5
       WHERE p.id IN (${placeholders})`,
      idList
    );

    // AI comparison highlights synthesis
    const comparisonSummary = {
      highest_trust: properties.reduce((prev, curr) => ((prev.trust_score || 0) > (curr.trust_score || 0) ? prev : curr), properties[0]),
      most_sustainable: properties.reduce((prev, curr) => ((prev.green_score || 0) > (curr.green_score || 0) ? prev : curr), properties[0]),
      best_livability: properties.reduce((prev, curr) => ((prev.life_score || 0) > (curr.life_score || 0) ? prev : curr), properties[0]),
      lowest_hidden_costs: properties.reduce((prev, curr) => ((prev.total_est_first_year || 0) < (curr.total_est_first_year || 0) ? prev : curr), properties[0]),
      best_value_growth: properties.reduce((prev, curr) => ((prev.growth_rate_annual || 0) > (curr.growth_rate_annual || 0) ? prev : curr), properties[0])
    };

    res.json({
      success: true,
      data: {
        properties,
        summary: comparisonSummary
      }
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/compare/save
const saveComparison = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { property_ids } = req.body;

    if (!property_ids || !Array.isArray(property_ids) || property_ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid property_ids array.' });
    }

    await pool.query(
      'INSERT INTO comparisons (user_id, property_ids_json) VALUES (?, ?)',
      [userId, JSON.stringify(property_ids)]
    );

    res.json({
      success: true,
      message: 'Comparison saved to your profile history.'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  compareProperties,
  saveComparison
};
