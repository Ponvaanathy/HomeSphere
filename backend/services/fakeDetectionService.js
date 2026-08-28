const crypto = require('crypto');

/**
 * Computes a standard SHA-256 hash for an image buffer or file stream.
 */
function computeImageHash(bufferOrString) {
  if (!bufferOrString) return null;
  return crypto.createHash('sha256').update(bufferOrString).digest('hex');
}

/**
 * Checks whether an image hash is reused in unrelated property listings.
 */
async function checkImageReuse(pool, imageHash, currentPropertyId = null, ownerId = null) {
  if (!imageHash || !pool) return { isReused: false, matches: [] };

  try {
    let query = `
      SELECT pi.id as image_id, pi.property_id, p.title, p.address, p.owner_id, u.name as owner_name
      FROM property_images pi
      JOIN properties p ON pi.property_id = p.id
      JOIN users u ON p.owner_id = u.id
      WHERE pi.image_hash = ?
    `;
    const params = [imageHash];

    if (currentPropertyId) {
      query += ` AND pi.property_id != ?`;
      params.push(currentPropertyId);
    }

    const [rows] = await pool.query(query, params);
    const unrelatedMatches = ownerId ? rows.filter(r => r.owner_id !== ownerId) : rows;

    return {
      isReused: unrelatedMatches.length > 0,
      matches: unrelatedMatches,
      matchCount: unrelatedMatches.length
    };
  } catch (err) {
    console.error('Image reuse check error:', err.message);
    return { isReused: false, matches: [] };
  }
}

/**
 * Dynamic Fraud & Fake Listing Risk Assessment Engine
 * Combines price deviation, image authenticity, listing completeness, and seller signals.
 */
function calculateFraudRisk(property, options = {}) {
  const {
    neighborhoodMedianPerSqft = 550,
    hasReusedImages = false,
    reusedImageCount = 0,
    isOwnerVerified = false,
    imageCount = 1
  } = options;

  let priceRisk = 0;
  let imageRisk = 0;
  let completenessRisk = 0;
  let sellerRisk = isOwnerVerified ? 0 : 10;
  const signals = [];

  const price = Number(property.price) || 0;
  const area = Number(property.area_sqft) || 1000;
  const pricePerSqft = area > 0 ? Math.round(price / area) : 500;
  const benchmark = Number(neighborhoodMedianPerSqft) || 550;

  // 1. Price Anomaly Signal
  if (pricePerSqft > 0 && benchmark > 0) {
    const ratio = pricePerSqft / benchmark;
    if (ratio < 0.40) {
      priceRisk = 45;
      signals.push(`Severe underpricing anomaly: Price per sq.ft (₹${pricePerSqft}) is ${Math.round((1 - ratio) * 100)}% below neighborhood median (₹${benchmark}). High fake/spam risk.`);
    } else if (ratio < 0.65) {
      priceRisk = 25;
      signals.push(`Moderate discount anomaly: Price per sq.ft (₹${pricePerSqft}) is significantly below local benchmark.`);
    } else if (ratio > 3.0) {
      priceRisk = 20;
      signals.push(`Extreme luxury premium: Price per sq.ft is over 300% of neighborhood median.`);
    } else {
      signals.push(`Price is within realistic market benchmark parameters (₹${pricePerSqft}/sqft vs median ₹${benchmark}/sqft).`);
    }
  }

  // 2. Image Authenticity & Reuse Signal
  if (hasReusedImages && reusedImageCount > 0) {
    imageRisk = 35;
    signals.push(`Image reuse signal detected: ${reusedImageCount} image(s) match existing listings by other accounts.`);
  } else if (imageCount === 0) {
    imageRisk = 20;
    signals.push(`No physical property photos provided. High verification requirement.`);
  } else {
    signals.push(`Authentic photo signal: Uploaded images are unique with zero duplicates detected across other seller listings.`);
  }

  // 3. Information Completeness Signal
  const desc = property.description || '';
  const addr = property.address || '';
  if (!addr || addr.length < 5) {
    completenessRisk += 15;
    signals.push(`Incomplete address information provided.`);
  }
  if (!desc || desc.length < 20) {
    completenessRisk += 10;
    signals.push(`Sparse or missing listing description.`);
  }

  // 4. Seller Trust
  if (isOwnerVerified) {
    signals.push(`Owner government ID & municipal title deed verification verified.`);
  } else {
    signals.push(`Self-declared listing: Pending municipal document verification.`);
  }

  // Aggregate Total Fraud Risk (0–100)
  const totalRisk = Math.max(0, Math.min(100, priceRisk + imageRisk + completenessRisk + sellerRisk));

  let riskVerdict = 'Low Risk (Safe & Verified)';
  let verdictBadge = 'safe';
  if (totalRisk >= 55) {
    riskVerdict = 'High Risk (Suspicious / Needs Verification)';
    verdictBadge = 'high';
  } else if (totalRisk >= 25) {
    riskVerdict = 'Moderate Risk (Review Required)';
    verdictBadge = 'moderate';
  }

  return {
    fraud_risk_score: totalRisk,
    risk_verdict: riskVerdict,
    verdict_badge: verdictBadge,
    breakdown: {
      price_risk: priceRisk,
      image_risk: imageRisk,
      completeness_risk: completenessRisk,
      seller_risk: sellerRisk
    },
    signals
  };
}

module.exports = {
  computeImageHash,
  checkImageReuse,
  calculateFraudRisk
};
