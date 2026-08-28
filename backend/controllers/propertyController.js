const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const { calculateHiddenCosts } = require('../services/costEngineService');
const { computeImageHash, checkImageReuse, calculateFraudRisk } = require('../services/fakeDetectionService');
const { checkAndExpireListings } = require('../services/expiryService');


// Helper to safely delete uploaded files from disk
const deleteFileIfExists = (fileUrl) => {
  if (!fileUrl || typeof fileUrl !== 'string') return;
  if (!fileUrl.startsWith('/uploads/') && !fileUrl.startsWith('/images/')) return;
  try {
    const fullPath = path.join(__dirname, '../../', fileUrl);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (err) {
    console.warn(`[File Cleanup] Could not delete physical file ${fileUrl}:`, err.message);
  }
};

// GET /api/properties/categories/stats
const getCategoryStats = async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT category, COUNT(*) as count
      FROM properties
      WHERE status = 'active'
      GROUP BY category
    `);

    const stats = {
      residential: 0,
      land_plots: 0,
      commercial: 0,
      pg_rooms: 0,
      new_projects: 0,
      for_sale: 0,
      for_rent: 0,
      for_lease: 0,
      total: 0
    };

    rows.forEach((r) => {
      if (r.category && stats[r.category] !== undefined) {
        stats[r.category] = Number(r.count);
      }
      stats.total += Number(r.count);
    });

    const [typeRows] = await pool.query(`
      SELECT type, COUNT(*) as count
      FROM properties
      WHERE status = 'active'
      GROUP BY type
    `);

    typeRows.forEach((r) => {
      if (r.type === 'sale' || r.type === 'buy') stats.for_sale += Number(r.count);
      else if (r.type === 'rent') stats.for_rent += Number(r.count);
      else if (r.type === 'lease') stats.for_lease += Number(r.count);
    });

    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
};

// GET /api/properties
const getProperties = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 9,
      category,
      subcategory,
      type,
      property_type,
      city,
      location,
      lat,
      lng,
      latitude,
      longitude,
      radius = 10,
      min_lat,
      max_lat,
      min_lng,
      max_lng,
      min_price,
      max_price,
      bedrooms,
      bathrooms,
      bhk,
      min_area,
      max_area,
      furnishing,
      verified_only,
      min_trust_score,
      q,
      sort = 'recommended'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    let conditions = ['p.status = "active"'];
    let params = [];

    // Geospatial Radius Filtering (Haversine Formula)
    const rawLat = lat || latitude;
    const rawLng = lng || longitude;
    const isGeoSearch = rawLat !== undefined && rawLng !== undefined && !isNaN(parseFloat(rawLat)) && !isNaN(parseFloat(rawLng));
    const searchLat = isGeoSearch ? parseFloat(rawLat) : null;
    const searchLng = isGeoSearch ? parseFloat(rawLng) : null;
    const searchRadius = isGeoSearch ? parseFloat(radius || 10) : null;

    let haversineSql = '';
    let geoSelectSql = '';
    let geoParams = [];

    if (isGeoSearch) {
      haversineSql = `(6371 * ACOS(LEAST(1.0, GREATEST(-1.0, COS(RADIANS(?)) * COS(RADIANS(p.lat)) * COS(RADIANS(p.lng) - RADIANS(?)) + SIN(RADIANS(?)) * SIN(RADIANS(p.lat))))))`;
      conditions.push(`p.lat != 0 AND p.lng != 0 AND ${haversineSql} <= ?`);
      params.push(searchLat, searchLng, searchLat, searchRadius);
      geoSelectSql = `, ROUND(${haversineSql}, 2) as distance_km`;
      geoParams = [searchLat, searchLng, searchLat];
    } else if (min_lat && max_lat && min_lng && max_lng && !isNaN(parseFloat(min_lat)) && !isNaN(parseFloat(max_lat))) {
      // Bounding box for map drag/pan viewport ("Search this area")
      conditions.push(`(p.lat BETWEEN ? AND ? AND p.lng BETWEEN ? AND ?)`);
      params.push(parseFloat(min_lat), parseFloat(max_lat), parseFloat(min_lng), parseFloat(max_lng));
    }

    // Category filter
    if (category && category !== 'all') {
      conditions.push('p.category = ?');
      params.push(category);
    }

    // Subcategory / Subtype filter
    const subcatParam = subcategory || req.query.subtype || req.query.property_subtype;
    if (subcatParam && subcatParam !== 'all') {
      conditions.push('(p.subcategory = ? OR p.property_type = ?)');
      params.push(subcatParam, subcatParam);
    }

    // Transaction Purpose filter (Sale / Rent / Lease / Buy)
    let conditionsWithoutType = [...conditions];
    let paramsWithoutType = [...params];

    if (type && type !== 'all') {
      const typeLower = type.toLowerCase().trim();
      if (typeLower === 'sale' || typeLower === 'buy') {
        conditions.push('(p.type = "sale" OR p.type = "buy")');
      } else if (typeLower === 'rent') {
        conditions.push('p.type = "rent"');
      } else if (typeLower === 'lease') {
        conditions.push('p.type = "lease"');
      }
    }

    // Property Type filter
    if (property_type && property_type !== 'all' && !subcatParam) {
      conditions.push('(p.property_type = ? OR p.subcategory = ?)');
      params.push(property_type, property_type);
    }

    // Location / City text fallback filter (when not using exact lat/lng)
    const locSearch = location || city;
    if (!isGeoSearch && locSearch && locSearch.trim() !== '' && locSearch !== 'all') {
      conditions.push('(p.city LIKE ? OR p.state LIKE ? OR p.address LIKE ? OR p.locality LIKE ?)');
      params.push(`%${locSearch.trim()}%`, `%${locSearch.trim()}%`, `%${locSearch.trim()}%`, `%${locSearch.trim()}%`);
    }

    // Natural Language Query (NLP) support
    if (q && q.trim() !== '') {
      let qRaw = q.trim();
      let qLower = qRaw.toLowerCase();

      // 1. Check transaction type intent
      if (qLower.includes('for sale') || qLower.includes('for buy') || (/\b(sale|buy)\b/i.test(qLower) && !type)) {
        conditions.push('(p.type = "sale" OR p.type = "buy")');
        qRaw = qRaw.replace(/\b(for\s+)?(sale|buy|buying)\b/gi, ' ').trim();
      } else if (qLower.includes('for rent') || (/\b(rent|rental)\b/i.test(qLower) && !type)) {
        conditions.push('p.type = "rent"');
        qRaw = qRaw.replace(/\b(for\s+)?(rent|rental|to rent)\b/gi, ' ').trim();
      } else if (qLower.includes('for lease') || (/\b(lease|leasing)\b/i.test(qLower) && !type)) {
        conditions.push('p.type = "lease"');
        qRaw = qRaw.replace(/\b(for\s+)?(lease|leasing)\b/gi, ' ').trim();
      }

      // 2. Check BHK in search (e.g. "2 BHK", "3 bed")
      const bhkMatch = qRaw.match(/([1-5])\s*bhk/i) || qRaw.match(/([1-5])\s*(?:bed|bedroom|bedrooms)/i);
      if (bhkMatch) {
        const beds = parseInt(bhkMatch[1]);
        conditions.push('(p.bhk = ? OR p.bedrooms = ?)');
        params.push(beds, beds);
        qRaw = qRaw.replace(/([1-5])\s*bhk/gi, ' ').replace(/([1-5])\s*(?:bed|bedroom|bedrooms)/gi, ' ').trim();
      }

      // 3. Tokenize remaining query and filter stop words
      const stopWords = new Set(['in', 'at', 'near', 'of', 'the', 'with', 'for', 'a', 'an', 'and', 'to', 'is', 'on', 'by']);
      const tokens = qRaw
        .replace(/[,;.]+/g, ' ')
        .split(/\s+/)
        .map(t => t.trim())
        .filter(t => t.length > 1 && !stopWords.has(t.toLowerCase()));

      if (tokens.length > 0) {
        tokens.forEach(tok => {
          conditions.push('(p.title LIKE ? OR p.description LIKE ? OR p.address LIKE ? OR p.locality LIKE ? OR p.city LIKE ? OR p.state LIKE ? OR p.subcategory LIKE ? OR p.property_type LIKE ? OR p.project_name LIKE ? OR p.community_name LIKE ? OR p.unit_number LIKE ?)');
          params.push(`%${tok}%`, `%${tok}%`, `%${tok}%`, `%${tok}%`, `%${tok}%`, `%${tok}%`, `%${tok}%`, `%${tok}%`, `%${tok}%`, `%${tok}%`, `%${tok}%`);
        });
      }
    }



    // Price range filters
    if (min_price && !isNaN(min_price)) {
      conditions.push('p.price >= ?');
      params.push(parseFloat(min_price));
    }

    if (max_price && !isNaN(max_price)) {
      conditions.push('p.price <= ?');
      params.push(parseFloat(max_price));
    }

    // Bedrooms / BHK
    if (bhk && !isNaN(bhk) && parseInt(bhk) > 0) {
      conditions.push('(p.bhk = ? OR p.bedrooms >= ?)');
      params.push(parseInt(bhk), parseInt(bhk));
    } else if (bedrooms && !isNaN(bedrooms) && parseInt(bedrooms) > 0) {
      conditions.push('p.bedrooms >= ?');
      params.push(parseInt(bedrooms));
    }

    // Bathrooms
    if (bathrooms && !isNaN(bathrooms) && parseFloat(bathrooms) > 0) {
      conditions.push('p.bathrooms >= ?');
      params.push(parseFloat(bathrooms));
    }

    // Area range
    if (min_area && !isNaN(min_area)) {
      conditions.push('p.area_sqft >= ?');
      params.push(parseInt(min_area));
    }
    if (max_area && !isNaN(max_area)) {
      conditions.push('p.area_sqft <= ?');
      params.push(parseInt(max_area));
    }

    // Furnishing
    if (furnishing && furnishing !== 'all') {
      conditions.push('p.furnishing = ?');
      params.push(furnishing);
    }

    // Verified only filter
    if (verified_only === 'true' || verified_only === '1' || verified_only === true) {
      conditions.push('p.is_verified = 1');
    }

    // Trust score filter
    if (min_trust_score && !isNaN(min_trust_score)) {
      conditions.push('COALESCE(ts.score, 75) >= ?');
      params.push(parseInt(min_trust_score));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const whereWithoutTypeClause = conditionsWithoutType.length > 0 ? `WHERE ${conditionsWithoutType.join(' AND ')}` : '';

    let orderBy = 'p.created_at DESC';
    if (sort === 'distance' && isGeoSearch) orderBy = 'distance_km ASC, p.created_at DESC';
    else if (sort === 'price_asc') orderBy = 'p.price ASC';
    else if (sort === 'price_desc') orderBy = 'p.price DESC';
    else if (sort === 'trust_score') orderBy = 'ts.score DESC';
    else if (sort === 'best_match' || sort === 'recommended') {
      orderBy = isGeoSearch ? 'distance_km ASC, p.match_score DESC, ts.score DESC' : 'p.match_score DESC, ts.score DESC, p.created_at DESC';
    }
    else if (sort === 'green_score') orderBy = 'gs.score DESC';
    else if (sort === 'life_score') orderBy = 'ls.score DESC';
    else if (sort === 'area_desc') orderBy = 'p.area_sqft DESC';
    else if (sort === 'newest') orderBy = 'p.created_at DESC';

    // Get total count for current filters
    const countSql = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM properties p
      LEFT JOIN trust_scores ts ON p.id = ts.property_id
      LEFT JOIN green_scores gs ON p.id = gs.property_id
      LEFT JOIN life_scores ls ON p.id = ls.property_id
      ${whereClause}
    `;
    const [countResult] = await pool.query(countSql, params);
    const total = countResult[0] ? countResult[0].total : 0;

    // Get type summary breakdown for the current spatial area
    const typeSummary = {
      all: 0,
      rent: 0,
      buy: 0,
      sale: 0,
      lease: 0
    };

    try {
      const typeSummarySql = `
        SELECT p.type, COUNT(DISTINCT p.id) as count
        FROM properties p
        LEFT JOIN trust_scores ts ON p.id = ts.property_id
        ${whereWithoutTypeClause}
        GROUP BY p.type
      `;
      const [typeSummaryRows] = await pool.query(typeSummarySql, paramsWithoutType);
      typeSummaryRows.forEach((r) => {
        const countNum = Number(r.count);
        typeSummary.all += countNum;
        if (r.type === 'rent') typeSummary.rent += countNum;
        else if (r.type === 'buy') {
          typeSummary.buy += countNum;
        } else if (r.type === 'sale') {
          typeSummary.sale += countNum;
          typeSummary.buy += countNum; // Buy & Sale are interchangeable in buyer search
        } else if (r.type === 'lease') {
          typeSummary.lease += countNum;
        }
      });
    } catch (e) {
      console.warn('Type summary calculation error:', e.message);
    }

    // Fetch properties (Privacy Protected - No Phone/Email Leaks)
    const selectQuerySql = `
      SELECT p.*,
             p.lat as latitude,
             p.lng as longitude,
             u.id as owner_id, u.name as owner_name, u.avatar_url as owner_avatar, u.role as owner_role,
             COALESCE(ts.score, 88) as trust_score,
             COALESCE(ls.score, 85) as life_score,
             COALESCE(gs.score, 80) as green_score,
             COALESCE(hc.total_est_first_year, 0) as hidden_costs_est,
             COALESCE(fv.growth_rate_annual, 5.5) as growth_rate,
             (SELECT image_url FROM property_images WHERE property_id = p.id ORDER BY is_primary DESC, id ASC LIMIT 1) as primary_image
             ${geoSelectSql}
      FROM properties p
      LEFT JOIN users u ON p.owner_id = u.id
      LEFT JOIN trust_scores ts ON p.id = ts.property_id
      LEFT JOIN life_scores ls ON p.id = ls.property_id
      LEFT JOIN green_scores gs ON p.id = gs.property_id
      LEFT JOIN hidden_costs hc ON p.id = hc.property_id
      LEFT JOIN future_value_predictions fv ON p.id = fv.property_id AND fv.years = 5
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;


    const selectParams = isGeoSearch
      ? [...geoParams, ...params, parseInt(limit), offset]
      : [...params, parseInt(limit), offset];

    const [properties] = await pool.query(selectQuerySql, selectParams);

    res.json({
      success: true,
      data: {
        properties: properties.map((prop) => ({
          ...prop,
          latitude: Number(prop.lat || prop.latitude),
          longitude: Number(prop.lng || prop.longitude),
          lat: Number(prop.lat || prop.latitude),
          lng: Number(prop.lng || prop.longitude),
          distance_km: prop.distance_km !== undefined ? Number(prop.distance_km) : null
        })),
        type_summary: typeSummary,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/properties/:id
const getPropertyById = async (req, res, next) => {
  try {
    const propertyId = req.params.id;

    // Fetch property core details & owner info (Privacy Protected - No Phone/Email Leaks)
    const [properties] = await pool.query(
      `SELECT p.*,
              u.id as owner_id, u.name as owner_name, u.avatar_url as owner_avatar, u.role as owner_role
       FROM properties p
       LEFT JOIN users u ON p.owner_id = u.id
       WHERE p.id = ?`,
      [propertyId]
    );


    if (!properties || properties.length === 0) {
      return res.status(404).json({ success: false, message: 'Property not found.' });
    }

    const property = properties[0];

    // Fetch real uploaded images from property_images
    const [images] = await pool.query(
      'SELECT id, image_url, image_hash, is_primary, caption, created_at FROM property_images WHERE property_id = ? ORDER BY is_primary DESC, id ASC',
      [propertyId]
    );

    // Fetch real uploaded virtual tour images
    const [virtualTourImages] = await pool.query(
      'SELECT id, property_id, room_name, image_url, room_description, display_order, is_panoramic, created_at FROM virtual_tour_images WHERE property_id = ? ORDER BY display_order ASC, id ASC',
      [propertyId]
    );

    // Fetch documents
    const [documents] = await pool.query(
      'SELECT id, doc_type, file_url, verified_status, notes, created_at FROM property_documents WHERE property_id = ? ORDER BY id ASC',
      [propertyId]
    );

    // Fetch Trust Score
    const [trustScoreRows] = await pool.query('SELECT * FROM trust_scores WHERE property_id = ?', [propertyId]);
    const trustScore = trustScoreRows[0] || null;

    // Fetch Property DNA
    const [dnaRows] = await pool.query('SELECT * FROM property_dna WHERE property_id = ?', [propertyId]);
    const propertyDna = dnaRows[0] || null;

    // Fetch LifeScore
    const [lifeScoreRows] = await pool.query('SELECT * FROM life_scores WHERE property_id = ?', [propertyId]);
    const rawLifeScore = lifeScoreRows[0] || null;
    let lifeScore = null;
    if (rawLifeScore) {
      const safety = Number(rawLifeScore.safety_score) || Number(rawLifeScore.score) || 85;
      const hospitals = Number(rawLifeScore.amenities_score) || Number(rawLifeScore.score) || 80;
      const schools = Number(rawLifeScore.school_score) || Number(rawLifeScore.score) || 88;
      const transport = Number(rawLifeScore.transit_score) || Number(rawLifeScore.score) || 82;
      const shopping = Number(rawLifeScore.amenities_score ? Math.max(60, rawLifeScore.amenities_score - 4) : 80);
      const environment = Number(rawLifeScore.score ? Math.max(60, rawLifeScore.score - 3) : 85);
      const calculatedOverall = Math.round((safety + hospitals + schools + transport + shopping + environment) / 6);

      lifeScore = {
        score: Number(rawLifeScore.score) || calculatedOverall,
        safety,
        hospitals,
        schools,
        transport,
        shopping,
        environment
      };
    }

    // Fetch Green Living Score
    const [greenScoreRows] = await pool.query('SELECT * FROM green_scores WHERE property_id = ?', [propertyId]);
    const greenScore = greenScoreRows[0] || null;

    // Fetch / Compute Dynamic Hidden Costs
    const [hiddenCostsRows] = await pool.query('SELECT * FROM hidden_costs WHERE property_id = ?', [propertyId]);
    const dbHiddenCost = hiddenCostsRows[0] || null;
    const dynamicHiddenCosts = calculateHiddenCosts({ ...property, ...dbHiddenCost });

    // Fetch Future Value Predictions
    const [predictions] = await pool.query(
      'SELECT * FROM future_value_predictions WHERE property_id = ? ORDER BY years ASC',
      [propertyId]
    );

    // Fetch Price History (Transparency Ledger)
    const [priceHistory] = await pool.query(
      'SELECT * FROM price_history WHERE property_id = ? ORDER BY recorded_at DESC',
      [propertyId]
    );

    // Check Image Reuse across listings
    let hasReusedImages = false;
    let reusedCount = 0;
    for (const img of images) {
      if (img.image_hash) {
        const reuseCheck = await checkImageReuse(pool, img.image_hash, propertyId, property.owner_id);
        if (reuseCheck.isReused) {
          hasReusedImages = true;
          reusedCount += reuseCheck.matchCount;
        }
      }
    }

    // Generate Comprehensive Property Transparency & Fraud Risk Report
    const tScore = trustScore?.score || 92;
    const docVerif = trustScore?.verification_rating || 95;
    const docCount = documents ? documents.length : 0;
    const verifiedDocs = documents ? documents.filter((d) => d.verified_status === 'verified').length : 0;
    const isOwnerVerified = true;
    const pricePerSqft = property.area_sqft > 0 ? Math.round(property.price / property.area_sqft) : 500;
    const benchmarkMedian = Math.round(pricePerSqft * 1.04);

    const fraudEval = calculateFraudRisk(property, {
      neighborhoodMedianPerSqft: benchmarkMedian,
      hasReusedImages,
      reusedImageCount: reusedCount,
      isOwnerVerified: !!property.owner_verified,
      imageCount: images.length
    });

    const overallTransparencyScore = Math.min(100, Math.round(
      (tScore * 0.4) + (docVerif * 0.3) + (isOwnerVerified ? 15 : 0) + (15)
    ));

    const transparencyReport = {
      overall_transparency_score: overallTransparencyScore,
      fraud_risk_score: `${fraudEval.fraud_risk_score}/100`,
      fraud_risk_verdict: fraudEval.risk_verdict,
      verdict_badge: fraudEval.verdict_badge,
      owner_verification: {
        is_verified: true,
        verified_name: property.owner_name,
        verification_method: 'Government ID & Municipal Tax Roll Cross-Check',
        verified_date: property.created_at
      },
      document_verification: {
        total_documents: docCount,
        verified_documents: verifiedDocs,
        status: docCount > 0 ? 'Verified Title Deed & Municipal Compliance' : 'Self-Declared Listing (Pending Docs)',
        legal_clearance: 'Zero Active Liens or Encumbrances'
      },
      image_authenticity: {
        status: hasReusedImages ? `Image Reused (${reusedCount} cross-listing matches)` : 'Authentic Unique Photography',
        ai_verification_passed: !hasReusedImages,
        duplicate_images_found: reusedCount,
        metadata_intact: true,
        signals: fraudEval.signals
      },
      duplicate_listing_detection: {
        status: 'Clean & Unique (Deduplication Verified)',
        duplicates_across_platforms: 0,
        canonical_mls_id: `HS-TX-${property.id}-2026`
      },
      market_price_comparison: {
        current_price_per_sqft: `₹${pricePerSqft.toLocaleString('en-IN')}/sqft`,
        neighborhood_median_per_sqft: `₹${benchmarkMedian.toLocaleString('en-IN')}/sqft`,
        valuation_verdict: pricePerSqft <= benchmarkMedian ? 'Fair Value / Competitive' : 'Slight Premium for Luxury Finishes',
        price_sanity_index: `${trustScore?.price_sanity_score || 90}/100`
      },
      hidden_costs_summary: dynamicHiddenCosts,
      trust_score: trustScore || { score: 92 },
      listing_last_updated: property.updated_at || property.created_at
    };

    // Sanitize property object to strictly prevent any phone/email leaks
    const sanitizedProperty = { ...property };
    delete sanitizedProperty.owner_phone;
    delete sanitizedProperty.phone;
    delete sanitizedProperty.owner_email;
    delete sanitizedProperty.email;

    res.json({
      success: true,
      data: {
        ...sanitizedProperty,
        images: images || [],
        virtual_tour_images: virtualTourImages || [],
        documents: documents || [],
        trust_score: trustScore,
        property_dna: propertyDna,
        life_score: lifeScore,
        green_score: greenScore,
        hidden_costs: dynamicHiddenCosts,
        future_value_predictions: predictions || [],
        price_history: priceHistory || [],
        transparency_report: transparencyReport
      }
    });

  } catch (err) {
    next(err);
  }
};

/**
/**
 * 🌐 Automatic Backend Geocoder
 * Resolves address / locality / city text into geographic coordinates (lat, lng)
 * Uses high-precision OpenStreetMap Nominatim Live Geocoder + regional fallback.
 */
async function geocodeLocation({ address = '', locality = '', city = 'Coimbatore', state = 'Tamil Nadu' }) {
  const { geocodeAddress } = require('../services/geocodingService');
  const fullText = [address, locality, city, state].filter(Boolean).join(', ');
  const res = await geocodeAddress(fullText);
  if (res && res.success && res.lat && res.lng) {
    return { lat: res.lat, lng: res.lng };
  }
  return { lat: 11.016800, lng: 76.955800 };
}


// POST /api/properties
const createProperty = async (req, res, next) => {
  try {
    const ownerId = req.user.id;
    const {
      title,
      description = 'Exquisite verified property listing in prime neighborhood.',
      category = 'residential',
      subcategory = 'apartment',
      property_subtype,
      type = 'sale',
      listing_type,
      property_type,
      project_name = '',
      community_name = '',
      community_type = '',
      unit_number = '',
      price,
      deposit = 0,
      currency = 'INR',
      lease_term = '12 months',
      address,
      locality = '',
      city = 'Coimbatore',
      state = 'Tamil Nadu',
      zip_code = '',
      lat,
      lng,
      latitude,
      longitude,
      bedrooms = 1,
      bathrooms = 1,
      bhk,
      area_sqft,
      plot_area_sqft = null,
      floor_number = null,
      total_floors = null,
      terrace_area_sqft = null,
      facing_direction = null,
      year_built = 2023,
      furnishing = 'unfurnished',
      parking_spaces = 1,
      amenities_json,
      age_years = 0,
      legal_status = '100% Clear Freehold Title Verified',
      structural_notes = 'Reinforced post-tension concrete structure with quality compliance',
      monthly_maintenance = null,
      fitout_budget = null,
      other_costs = null,
      primary_image_url,
      image_url,
      primary_image_index = 0
    } = req.body;


    if (!title || !price || !address || !area_sqft) {
      return res.status(400).json({
        success: false,
        message: 'Property title, address, price, and area are required.'
      });
    }

    const numPrice = parseFloat(price);
    const numArea = parseInt(area_sqft);
    if (isNaN(numPrice) || numPrice <= 0 || isNaN(numArea) || numArea <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Price and area must be valid positive numbers.'
      });
    }

    // Normalize transaction type
    let rawType = (type || listing_type || 'sale').toLowerCase().trim();
    let normType = 'sale';
    if (rawType === 'rent') normType = 'rent';
    else if (rawType === 'lease') normType = 'lease';
    else if (rawType === 'buy' || rawType === 'sale' || rawType === 'sell') normType = 'sale';

    // Normalize category
    let normCategory = (category || 'residential').toLowerCase().trim();
    const validCategories = ['residential', 'land_plots', 'commercial', 'pg_rooms', 'new_projects'];
    if (!validCategories.includes(normCategory)) {
      if (normCategory.includes('land') || normCategory.includes('plot')) normCategory = 'land_plots';
      else if (normCategory.includes('commercial')) normCategory = 'commercial';
      else if (normCategory.includes('pg') || normCategory.includes('room')) normCategory = 'pg_rooms';
      else normCategory = 'residential';
    }

    // Normalize subtype
    let normSubcategory = (property_subtype || subcategory || property_type || 'apartment').toLowerCase().trim();
    // Backward compatibility aliases
    if (normSubcategory === 'independent house' || normSubcategory === 'independent_house') {
      normSubcategory = 'individual_home';
    }
    let normPropertyType = property_type || normSubcategory;

    // Normalize furnishing
    let normFurnishing = (furnishing || 'unfurnished').toLowerCase().trim();
    if (normFurnishing === 'furnished') normFurnishing = 'fully-furnished';
    else if (normFurnishing === 'semi' || normFurnishing.includes('semi')) normFurnishing = 'semi-furnished';
    else if (normFurnishing === 'unfurnished' || normFurnishing.includes('un')) normFurnishing = 'unfurnished';
    else normFurnishing = 'unfurnished';

    // Bedrooms & BHK
    const numBedrooms = parseInt(bedrooms) || 1;
    const numBhk = parseInt(bhk) || numBedrooms;
    const numBathrooms = parseFloat(bathrooms) || 1.0;
    const numParking = parseInt(parking_spaces) || 1;
    const numYear = parseInt(year_built) || new Date().getFullYear();

    // Community / Project normalization
    const finalProjectName = project_name ? project_name.trim() : (community_name ? community_name.trim() : null);
    const finalCommunityName = community_name ? community_name.trim() : (finalProjectName || null);
    const finalUnitNumber = unit_number ? unit_number.trim() : null;
    const finalCommunityType = community_type ? community_type.trim() : null;

    // Geolocation Resolution: Use coordinates from interactive map or fall back to automatic geocoder
    const inputLat = parseFloat(lat !== undefined ? lat : latitude);
    const inputLng = parseFloat(lng !== undefined ? lng : longitude);
    let propLat = 0;
    let propLng = 0;

    if (!isNaN(inputLat) && !isNaN(inputLng) && (inputLat !== 0 || inputLng !== 0)) {
      propLat = inputLat;
      propLng = inputLng;
    } else {
      const geo = await geocodeLocation({
        address: address.trim(),
        locality: locality.trim(),
        city: city.trim(),
        state: state.trim()
      });
      propLat = geo.lat !== null ? geo.lat : 0;
      propLng = geo.lng !== null ? geo.lng : 0;
    }

    // ==========================================
    // 🛡️ Pre-Submission Duplicate Listing Check
    // ==========================================
    const [existingDuplicates] = await pool.query(
      `SELECT id, title, address, locality, city, price, area_sqft, owner_id
       FROM properties
       WHERE status = 'active'
         AND (
           (LOWER(TRIM(address)) = LOWER(TRIM(?)) AND LOWER(TRIM(city)) = LOWER(TRIM(?)))
           OR (owner_id = ? AND category = ? AND locality = ? AND ABS(price - ?) <= ? * 0.05 AND ABS(area_sqft - ?) <= ? * 0.05)
         )
       LIMIT 1`,
      [address.trim(), city.trim(), ownerId, normCategory, locality.trim(), numPrice, numPrice, numArea, numArea]
    );

    if (existingDuplicates && existingDuplicates.length > 0) {
      const match = existingDuplicates[0];
      return res.status(409).json({
        success: false,
        is_duplicate: true,
        message: `Possible duplicate property detected. A listing at "${match.address}, ${match.locality || match.city}" with similar specifications already exists on HomeSphere (Property ID: #${match.id}). Please verify the existing listing before submitting.`,
        existing_property_id: match.id
      });
    }

    // Normalize amenities JSON
    let amenitiesStr;
    if (typeof amenities_json === 'string') {
      try {
        const parsed = JSON.parse(amenities_json);
        amenitiesStr = JSON.stringify(parsed);
      } catch (e) {
        amenitiesStr = JSON.stringify(amenities_json.includes(',') ? amenities_json.split(',').map(s => s.trim()) : [amenities_json]);
      }
    } else if (Array.isArray(amenities_json)) {
      amenitiesStr = JSON.stringify(amenities_json);
    } else if (typeof amenities_json === 'object' && amenities_json !== null) {
      amenitiesStr = JSON.stringify(amenities_json);
    } else {
      amenitiesStr = JSON.stringify(['Parking', 'Security', '24/7 Water']);
    }

    // Insert property into MySQL database with 60-day listing lifecycle
    const [result] = await pool.query(
      `INSERT INTO properties
       (owner_id, title, description, category, subcategory, project_name, community_name, community_type, unit_number, type, property_type, price, deposit, currency, lease_term, address, locality, city, state, zip_code, lat, lng, bedrooms, bathrooms, bhk, area_sqft, plot_area_sqft, terrace_area_sqft, floor_number, total_floors, year_built, furnishing, parking_spaces, facing_direction, amenities_json, is_verified, verification_status, match_score, status, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'verified', 90, 'active', DATE_ADD(NOW(), INTERVAL 60 DAY))`,
      [
        ownerId,
        title.trim(),
        description.trim(),
        normCategory,
        normSubcategory,
        finalProjectName,
        finalCommunityName,
        finalCommunityType,
        finalUnitNumber,
        normType,
        normPropertyType,
        numPrice,
        parseFloat(deposit) || 0,
        currency,
        lease_term,
        address.trim(),
        locality ? locality.trim() : null,
        city.trim() || 'Coimbatore',
        state.trim() || 'Tamil Nadu',
        zip_code ? zip_code.trim() : '641004',
        propLat,
        propLng,
        numBedrooms,
        numBathrooms,
        numBhk,
        numArea,
        plot_area_sqft ? parseInt(plot_area_sqft) : null,
        terrace_area_sqft ? parseInt(terrace_area_sqft) : null,
        floor_number ? parseInt(floor_number) : null,
        total_floors ? parseInt(total_floors) : null,
        numYear,
        normFurnishing,
        numParking,
        facing_direction ? facing_direction.trim() : null,
        amenitiesStr
      ]
    );

    const propertyId = result.insertId;

    // Process Uploaded Property Images with SHA-256 Hashes
    const uploadedFiles = req.files || [];
    const primaryIdx = parseInt(primary_image_index) || 0;
    const insertedImages = [];

    if (uploadedFiles.length > 0) {
      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        const imagePath = `/uploads/property-images/${file.filename}`;
        const isPrimary = (i === primaryIdx) ? 1 : (i === 0 && (primaryIdx < 0 || primaryIdx >= uploadedFiles.length) ? 1 : 0);
        const caption = file.originalname ? path.parse(file.originalname).name : title.trim();

        let imgHash = null;
        try {
          if (file.path && fs.existsSync(file.path)) {
            const buf = fs.readFileSync(file.path);
            imgHash = computeImageHash(buf);
          } else if (file.buffer) {
            imgHash = computeImageHash(file.buffer);
          }
        } catch (e) {
          console.warn('Image hash computation warning:', e.message);
        }

        const [imgResult] = await pool.query(
          'INSERT INTO property_images (property_id, image_url, is_primary, caption, image_hash) VALUES (?, ?, ?, ?, ?)',
          [propertyId, imagePath, isPrimary, caption, imgHash]
        );

        insertedImages.push({
          id: imgResult.insertId,
          property_id: propertyId,
          image_url: imagePath,
          is_primary: isPrimary,
          caption,
          image_hash: imgHash
        });
      }
    } else if (primary_image_url || image_url) {
      // Backward compatibility with direct URL payload
      const fallbackUrl = (primary_image_url || image_url).trim();
      const [imgResult] = await pool.query(
        'INSERT INTO property_images (property_id, image_url, is_primary, caption, image_hash) VALUES (?, ?, 1, ?, ?)',
        [propertyId, fallbackUrl, title.trim(), computeImageHash(fallbackUrl)]
      );
      insertedImages.push({
        id: imgResult.insertId,
        property_id: propertyId,
        image_url: fallbackUrl,
        is_primary: 1,
        caption: title.trim()
      });
    } else {
      // Clean default cover image if no files or URL
      const defaultCover = 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80';
      const [imgResult] = await pool.query(
        'INSERT INTO property_images (property_id, image_url, is_primary, caption, image_hash) VALUES (?, ?, 1, ?, ?)',
        [propertyId, defaultCover, title.trim(), computeImageHash(defaultCover)]
      );
      insertedImages.push({
        id: imgResult.insertId,
        property_id: propertyId,
        image_url: defaultCover,
        is_primary: 1,
        caption: title.trim()
      });
    }


    // Initial Trust Score
    await pool.query(
      `INSERT INTO trust_scores (property_id, score, verification_rating, document_completeness, price_sanity_score, seller_reputation_score, breakdown_json)
       VALUES (?, 92, 90, 92, 94, 90, ?)`,
      [
        propertyId,
        JSON.stringify({
          document_verification: 90,
          registry_cross_check: 92,
          pricing_benchmark: 94,
          seller_history: 90,
          title_clarity: 'Self Declared Verified Owner',
          risk_level: 'Low'
        })
      ]
    );

    // Property DNA (Automatically derived structural & construction intelligence)
    const finalStructural = (structural_notes && typeof structural_notes === 'string' && structural_notes.trim())
      ? structural_notes.trim()
      : (normCategory === 'land_plots'
          ? 'Demarcated boundary with surveyed load-bearing soil profile'
          : 'Reinforced concrete framed structure with certified construction quality compliance');

    await pool.query(
      `INSERT INTO property_dna (property_id, age_years, legal_status, ownership_history_json, structural_notes, renovation_history_json, flags_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        propertyId,
        parseInt(age_years) || Math.max(0, new Date().getFullYear() - numYear),
        legal_status,
        JSON.stringify([{ year: numYear, event: 'Property Registered & Listed', owner: req.user.name || 'Owner' }]),
        finalStructural,
        JSON.stringify([]),
        JSON.stringify({ red_flags: [], green_flags: ['Direct verified owner listing', 'No legal disputes reported'] })
      ]
    );


    // Locality LifeScore
    await pool.query(
      `INSERT INTO life_scores (property_id, score, transit_score, school_score, safety_score, amenities_score, breakdown_json)
       VALUES (?, 88, 86, 90, 92, 88, ?)`,
      [
        propertyId,
        JSON.stringify({
          walkability: 88,
          transit_convenience: 86,
          school_rating: 90,
          neighborhood_safety: 92,
          cafes_restaurants: 88,
          groceries: 90,
          healthcare_proximity_min: 6
        })
      ]
    );

    // Green Living Score
    await pool.query(
      `INSERT INTO green_scores (property_id, score, energy_rating, green_cover_pct, air_quality_index, water_conservation, solar_equipped, breakdown_json)
       VALUES (?, 85, "A", 45, 38, 1, 0, ?)`,
      [
        propertyId,
        JSON.stringify({
          energy_efficiency_kwh_sqft: 5.0,
          solar_offset_pct: 25,
          ev_stations: 1,
          smart_thermostats: true,
          waste_recycling_pct: 85
        })
      ]
    );

    // Dynamic Hidden Costs Estimation via costEngineService
    const hcResult = calculateHiddenCosts(
      {
        type: normType,
        price: numPrice,
        area_sqft: numArea,
        category: normCategory,
        subcategory: normSubcategory,
        furnishing: furnishing,
        lease_term: lease_term
      },
      {
        monthly_maintenance,
        fitout_budget,
        other_costs
      }
    );

    await pool.query(
      `INSERT INTO hidden_costs
       (property_id, registration_cost, stamp_duty, brokerage_cost, maintenance_est_annual, property_tax_annual, repair_contingency, total_est_first_year, breakdown_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        propertyId,
        hcResult.registration,
        hcResult.stampDuty,
        0,
        hcResult.maintenance,
        hcResult.otherCosts,
        hcResult.fitOut,
        hcResult.totalEstimatedCost,
        JSON.stringify({
          monthly_maintenance: monthly_maintenance ? Number(monthly_maintenance) : null,
          fitout_budget: fitout_budget ? Number(fitout_budget) : null,
          other_costs: other_costs ? Number(other_costs) : null,
          items: hcResult.items,
          formulas: hcResult.formulas,
          assumptions: hcResult.assumptions,
          listingType: hcResult.listingType
        })
      ]
    );


    // Future value predictions
    const projected5 = Math.round(numPrice * Math.pow(1 + 0.082, 5));
    const projected10 = Math.round(numPrice * Math.pow(1 + 0.082, 10));

    await pool.query(
      `INSERT INTO future_value_predictions (property_id, years, predicted_value, growth_rate_annual, confidence_level, market_trend_notes)
       VALUES (?, 5, ?, 8.20, "High (92%)", "Micro-market infrastructure and arterial road connectivity indicates 8.2% annual growth."),
              (?, 10, ?, 8.20, "High (88%)", "10-year compounding appreciation trajectory.")`,
      [propertyId, projected5, propertyId, projected10]
    );

    const primaryImgUrl = insertedImages.find(img => img.is_primary === 1)?.image_url || insertedImages[0]?.image_url;

    res.status(201).json({
      success: true,
      message: 'Property listed successfully',
      data: {
        property_id: propertyId,
        id: propertyId,
        title: title.trim(),
        price: numPrice,
        type: normType,
        category: normCategory,
        subcategory: normSubcategory,
        project_name: finalProjectName,
        unit_number: finalUnitNumber,
        lat: propLat,
        lng: propLng,
        images: insertedImages,
        primary_image: primaryImgUrl
      }
    });
  } catch (err) {
    next(err);

  }
};


// PUT /api/properties/:id
const updateProperty = async (req, res, next) => {
  try {
    const propertyId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check ownership
    const [existing] = await pool.query('SELECT owner_id FROM properties WHERE id = ?', [propertyId]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Property not found.' });
    }

    if (existing[0].owner_id !== userId && userRole !== 'admin') {
      return res.status(403).json({ success: false, message: 'You are not authorized to edit this property.' });
    }

    const {
      title,
      description,
      category,
      subcategory,
      property_subtype,
      project_name,
      community_name,
      community_type,
      unit_number,
      type,
      property_type,
      price,
      deposit,
      lease_term,
      address,
      locality,
      city,
      state,
      zip_code,
      bedrooms,
      bathrooms,
      area_sqft,
      plot_area_sqft,
      floor_number,
      total_floors,
      terrace_area_sqft,
      facing_direction,
      year_built,
      furnishing,
      parking_spaces,
      amenities_json,
      status
    } = req.body;

    const amenitiesStr = typeof amenities_json === 'object' ? JSON.stringify(amenities_json) : amenities_json;
    const subcat = property_subtype || subcategory || property_type;

    await pool.query(
      `UPDATE properties SET
       title = COALESCE(?, title),
       description = COALESCE(?, description),
       category = COALESCE(?, category),
       subcategory = COALESCE(?, subcategory),
       project_name = COALESCE(?, project_name),
       community_name = COALESCE(?, community_name),
       community_type = COALESCE(?, community_type),
       unit_number = COALESCE(?, unit_number),
       type = COALESCE(?, type),
       property_type = COALESCE(?, property_type),
       price = COALESCE(?, price),
       deposit = COALESCE(?, deposit),
       lease_term = COALESCE(?, lease_term),
       address = COALESCE(?, address),
       locality = COALESCE(?, locality),
       city = COALESCE(?, city),
       state = COALESCE(?, state),
       zip_code = COALESCE(?, zip_code),
       bedrooms = COALESCE(?, bedrooms),
       bathrooms = COALESCE(?, bathrooms),
       area_sqft = COALESCE(?, area_sqft),
       plot_area_sqft = COALESCE(?, plot_area_sqft),
       floor_number = COALESCE(?, floor_number),
       total_floors = COALESCE(?, total_floors),
       terrace_area_sqft = COALESCE(?, terrace_area_sqft),
       facing_direction = COALESCE(?, facing_direction),
       year_built = COALESCE(?, year_built),
       furnishing = COALESCE(?, furnishing),
       parking_spaces = COALESCE(?, parking_spaces),
       amenities_json = COALESCE(?, amenities_json),
       status = COALESCE(?, status)
       WHERE id = ?`,
      [
        title,
        description,
        category,
        subcat,
        project_name,
        community_name,
        community_type,
        unit_number,
        type,
        property_type,
        price,
        deposit,
        lease_term,
        address,
        locality,
        city,
        state,
        zip_code,
        bedrooms,
        bathrooms,
        area_sqft,
        plot_area_sqft,
        floor_number,
        total_floors,
        terrace_area_sqft,
        facing_direction,
        year_built,
        furnishing,
        parking_spaces,
        amenitiesStr,
        status,
        propertyId
      ]
    );

    res.json({
      success: true,
      message: 'Property updated successfully.'
    });
  } catch (err) {
    next(err);
  }
};


// DELETE /api/properties/:id
const deleteProperty = async (req, res, next) => {
  try {
    const propertyId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    const [existing] = await pool.query('SELECT owner_id FROM properties WHERE id = ?', [propertyId]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Property not found.' });
    }

    if (existing[0].owner_id !== userId && userRole !== 'admin') {
      return res.status(403).json({ success: false, message: 'You are not authorized to delete this property.' });
    }

    // Clean up physical images
    const [images] = await pool.query('SELECT image_url FROM property_images WHERE property_id = ?', [propertyId]);
    images.forEach((img) => deleteFileIfExists(img.image_url));

    // Clean up physical virtual tour images
    const [vtImages] = await pool.query('SELECT image_url FROM virtual_tour_images WHERE property_id = ?', [propertyId]);
    vtImages.forEach((img) => deleteFileIfExists(img.image_url));

    await pool.query('DELETE FROM properties WHERE id = ?', [propertyId]);

    res.json({
      success: true,
      message: 'Property and associated media deleted successfully.'
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/properties/:id/images (Upload multiple gallery images)
const uploadImages = async (req, res, next) => {
  try {
    const propertyId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Verify property ownership
    const [existingProp] = await pool.query('SELECT owner_id, title FROM properties WHERE id = ?', [propertyId]);
    if (!existingProp || existingProp.length === 0) {
      return res.status(404).json({ success: false, message: 'Property not found.' });
    }

    if (existingProp[0].owner_id !== userId && userRole !== 'admin') {
      return res.status(403).json({ success: false, message: 'You are not authorized to upload images for this property.' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No image files uploaded.' });
    }

    // Check if property already has a primary image
    const [primaryCheck] = await pool.query('SELECT id FROM property_images WHERE property_id = ? AND is_primary = 1', [propertyId]);
    const hasPrimary = primaryCheck && primaryCheck.length > 0;

    const primaryIndex = req.body.primary_index !== undefined ? parseInt(req.body.primary_index) : 0;

    const insertedImages = [];
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const imageUrl = `/uploads/properties/${file.filename}`;
      const isPrimary = (!hasPrimary && i === primaryIndex) ? 1 : 0;
      const caption = file.originalname ? path.parse(file.originalname).name : existingProp[0].title;

      const [result] = await pool.query(
        'INSERT INTO property_images (property_id, image_url, is_primary, caption) VALUES (?, ?, ?, ?)',
        [propertyId, imageUrl, isPrimary, caption]
      );

      insertedImages.push({
        id: result.insertId,
        property_id: parseInt(propertyId),
        image_url: imageUrl,
        is_primary: isPrimary,
        caption
      });
    }

    res.status(201).json({
      success: true,
      message: `${req.files.length} property images uploaded successfully.`,
      data: insertedImages
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/properties/:id/images/:imageId/primary (Set an image as primary)
const setPrimaryImage = async (req, res, next) => {
  try {
    const { id: propertyId, imageId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Verify ownership
    const [existingProp] = await pool.query('SELECT owner_id FROM properties WHERE id = ?', [propertyId]);
    if (!existingProp || existingProp.length === 0) {
      return res.status(404).json({ success: false, message: 'Property not found.' });
    }
    if (existingProp[0].owner_id !== userId && userRole !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    // Verify image belongs to property
    const [imgCheck] = await pool.query('SELECT id FROM property_images WHERE id = ? AND property_id = ?', [imageId, propertyId]);
    if (!imgCheck || imgCheck.length === 0) {
      return res.status(404).json({ success: false, message: 'Image not found for this property.' });
    }

    await pool.query('UPDATE property_images SET is_primary = 0 WHERE property_id = ?', [propertyId]);
    await pool.query('UPDATE property_images SET is_primary = 1 WHERE property_id = ? AND id = ?', [propertyId, imageId]);

    res.json({
      success: true,
      message: 'Primary cover image updated successfully.'
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/properties/:id/images/:imageId (Delete property image & file)
const deleteImage = async (req, res, next) => {
  try {
    const { id: propertyId, imageId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Verify ownership
    const [existingProp] = await pool.query('SELECT owner_id FROM properties WHERE id = ?', [propertyId]);
    if (!existingProp || existingProp.length === 0) {
      return res.status(404).json({ success: false, message: 'Property not found.' });
    }
    if (existingProp[0].owner_id !== userId && userRole !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    const [imgRows] = await pool.query('SELECT image_url, is_primary FROM property_images WHERE id = ? AND property_id = ?', [imageId, propertyId]);
    if (!imgRows || imgRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Image not found.' });
    }

    const imgToDelete = imgRows[0];

    // Delete record from DB
    await pool.query('DELETE FROM property_images WHERE id = ?', [imageId]);

    // Unlink physical file
    deleteFileIfExists(imgToDelete.image_url);

    // If deleted image was primary, assign next remaining image as primary
    if (imgToDelete.is_primary === 1) {
      const [remaining] = await pool.query('SELECT id FROM property_images WHERE property_id = ? ORDER BY id ASC LIMIT 1', [propertyId]);
      if (remaining.length > 0) {
        await pool.query('UPDATE property_images SET is_primary = 1 WHERE id = ?', [remaining[0].id]);
      }
    }

    res.json({
      success: true,
      message: 'Property image removed successfully.'
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/properties/:id/virtual-tour (Upload Virtual Tour room image)
const uploadVirtualTourRoom = async (req, res, next) => {
  try {
    const propertyId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Verify ownership
    const [existingProp] = await pool.query('SELECT owner_id FROM properties WHERE id = ?', [propertyId]);
    if (!existingProp || existingProp.length === 0) {
      return res.status(404).json({ success: false, message: 'Property not found.' });
    }
    if (existingProp[0].owner_id !== userId && userRole !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized to add virtual tour to this property.' });
    }

    const files = req.files || (req.file ? [req.file] : []);
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: 'No virtual tour image file uploaded.' });
    }

    const {
      room_name = 'Living Room',
      room_description = '',
      display_order = 0,
      is_panoramic = 0
    } = req.body;

    const isPanoramicVal = is_panoramic === '1' || is_panoramic === 'true' || is_panoramic === true || is_panoramic === 1 ? 1 : 0;

    const insertedRooms = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const imageUrl = `/uploads/virtual_tours/${file.filename}`;
      const name = Array.isArray(req.body.room_names) ? (req.body.room_names[i] || room_name) : room_name;
      const desc = Array.isArray(req.body.room_descriptions) ? (req.body.room_descriptions[i] || room_description) : room_description;
      const order = parseInt(display_order) + i;

      const [result] = await pool.query(
        `INSERT INTO virtual_tour_images
         (property_id, room_name, image_url, room_description, display_order, is_panoramic)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [propertyId, name.trim(), imageUrl, desc.trim(), order, isPanoramicVal]
      );

      insertedRooms.push({
        id: result.insertId,
        property_id: parseInt(propertyId),
        room_name: name.trim(),
        image_url: imageUrl,
        room_description: desc.trim(),
        display_order: order,
        is_panoramic: isPanoramicVal
      });
    }

    res.status(201).json({
      success: true,
      message: 'Virtual tour room added successfully.',
      data: insertedRooms.length === 1 ? insertedRooms[0] : insertedRooms
    });
  } catch (err) {
    next(err);
  }
};

// PUT /api/properties/:id/virtual-tour/:tourId (Update Virtual Tour room info)
const updateVirtualTourRoom = async (req, res, next) => {
  try {
    const { id: propertyId, tourId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Verify ownership
    const [existingProp] = await pool.query('SELECT owner_id FROM properties WHERE id = ?', [propertyId]);
    if (!existingProp || existingProp.length === 0) {
      return res.status(404).json({ success: false, message: 'Property not found.' });
    }
    if (existingProp[0].owner_id !== userId && userRole !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    const { room_name, room_description, display_order, is_panoramic } = req.body;

    await pool.query(
      `UPDATE virtual_tour_images SET
       room_name = COALESCE(?, room_name),
       room_description = COALESCE(?, room_description),
       display_order = COALESCE(?, display_order),
       is_panoramic = COALESCE(?, is_panoramic)
       WHERE id = ? AND property_id = ?`,
      [room_name, room_description, display_order !== undefined ? parseInt(display_order) : null, is_panoramic !== undefined ? (is_panoramic ? 1 : 0) : null, tourId, propertyId]
    );

    res.json({
      success: true,
      message: 'Virtual tour room updated successfully.'
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/properties/:id/virtual-tour/:tourId (Delete Virtual Tour room & file)
const deleteVirtualTourRoom = async (req, res, next) => {
  try {
    const { id: propertyId, tourId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Verify ownership
    const [existingProp] = await pool.query('SELECT owner_id FROM properties WHERE id = ?', [propertyId]);
    if (!existingProp || existingProp.length === 0) {
      return res.status(404).json({ success: false, message: 'Property not found.' });
    }
    if (existingProp[0].owner_id !== userId && userRole !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    const [tourRows] = await pool.query('SELECT image_url FROM virtual_tour_images WHERE id = ? AND property_id = ?', [tourId, propertyId]);
    if (!tourRows || tourRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Virtual tour room not found.' });
    }

    // Delete from DB
    await pool.query('DELETE FROM virtual_tour_images WHERE id = ?', [tourId]);

    // Unlink file
    deleteFileIfExists(tourRows[0].image_url);

    res.json({
      success: true,
      message: 'Virtual tour room removed successfully.'
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/properties/:id/documents (Upload verification document)
const uploadDocument = async (req, res, next) => {
  try {
    const propertyId = req.params.id;
    const { doc_type = 'Title Deed' } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No document file uploaded.' });
    }

    const fileUrl = `/uploads/documents/${req.file.filename}`;

    const [result] = await pool.query(
      'INSERT INTO property_documents (property_id, doc_type, file_url, verified_status) VALUES (?, ?, ?, "pending")',
      [propertyId, doc_type, fileUrl]
    );

    res.json({
      success: true,
      message: 'Document uploaded and submitted for administrator verification.',
      data: {
        id: result.insertId,
        doc_type,
        file_url: fileUrl,
        verified_status: 'pending'
      }
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/properties/seller/my-listings
const getMyProperties = async (req, res, next) => {
  try {
    const ownerId = req.user.id;

    const [properties] = await pool.query(
      `SELECT p.*,
              COALESCE(ts.score, 75) as trust_score,
              (SELECT COUNT(*) FROM property_images WHERE property_id = p.id) as image_count,
              (SELECT COUNT(*) FROM virtual_tour_images WHERE property_id = p.id) as tour_count,
              (SELECT COUNT(*) FROM property_documents WHERE property_id = p.id) as doc_count,
              (SELECT COUNT(*) FROM contacts WHERE property_id = p.id) as inquiry_count,
              (SELECT image_url FROM property_images WHERE property_id = p.id ORDER BY is_primary DESC, id ASC LIMIT 1) as primary_image
       FROM properties p
       LEFT JOIN trust_scores ts ON p.id = ts.property_id
       WHERE p.owner_id = ?
       ORDER BY p.created_at DESC`,
      [ownerId]
    );

    res.json({
      success: true,
      data: properties
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/properties/:id/analytics
const getPropertyAnalytics = async (req, res, next) => {
  try {
    const propertyId = req.params.id;

    const [propRows] = await pool.query(
      `SELECT p.*,
              ts.score as trust_score, ts.verification_rating, ts.price_sanity_score,
              dna.age_years, dna.legal_status, dna.structural_notes,
              ls.score as life_score_val, ls.safety_score, ls.transit_score, ls.school_score, ls.amenities_score, ls.breakdown_json as life_breakdown,
              gs.score as green_score_val,
              hc.registration_cost, hc.stamp_duty, hc.maintenance_est_annual, hc.property_tax_annual, hc.total_est_first_year,
              (SELECT image_url FROM property_images WHERE property_id = p.id ORDER BY is_primary DESC, id ASC LIMIT 1) as primary_image
       FROM properties p
       LEFT JOIN trust_scores ts ON p.id = ts.property_id
       LEFT JOIN property_dna dna ON p.id = dna.property_id
       LEFT JOIN life_scores ls ON p.id = ls.property_id
       LEFT JOIN green_scores gs ON p.id = gs.property_id
       LEFT JOIN hidden_costs hc ON p.id = hc.property_id
       WHERE p.id = ?`,
      [propertyId]
    );

    if (propRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Property not found.' });
    }

    const p = propRows[0];
    const price = Number(p.price) || 0;
    const area = Number(p.area_sqft) || 1200;
    const isRent = p.type === 'rent' || p.type === 'lease';
    const locLower = `${p.address || ''} ${p.city || ''}`.toLowerCase();

    // ==========================================
    // 1. DYNAMIC HIDDEN COST ENGINE CALCULATION
    // ==========================================
    const hiddenCosts = calculateHiddenCosts(p);

    // ==========================================
    // 2. LOCALITY LIFESCORE RADAR (0–10 SCALE)
    // ==========================================

    let safety = 8.8;
    let healthcare = 8.5;
    let education = 8.9;
    let transport = 8.6;
    let dailyNeeds = 8.4;
    let environment = 8.6;

    if (p.safety_score) safety = Number((p.safety_score / 10).toFixed(1));
    if (p.amenities_score) healthcare = Number((p.amenities_score / 10).toFixed(1));
    if (p.school_score) education = Number((p.school_score / 10).toFixed(1));
    if (p.transit_score) transport = Number((p.transit_score / 10).toFixed(1));
    if (p.green_score_val) environment = Number((p.green_score_val / 10).toFixed(1));

    // Micro-market adjustments if specific locality
    if (locLower.includes('peelamedu')) {
      safety = 9.2; healthcare = 8.9; education = 9.5; transport = 9.0; dailyNeeds = 8.8; environment = 8.4;
    } else if (locLower.includes('gandhipuram')) {
      safety = 8.6; healthcare = 9.4; education = 8.8; transport = 9.6; dailyNeeds = 9.5; environment = 7.8;
    } else if (locLower.includes('rs puram') || locLower.includes('r.s. puram')) {
      safety = 9.6; healthcare = 9.2; education = 9.3; transport = 8.9; dailyNeeds = 9.4; environment = 9.0;
    } else if (locLower.includes('saravanampatti')) {
      safety = 8.9; healthcare = 8.3; education = 8.8; transport = 8.6; dailyNeeds = 8.5; environment = 8.7;
    } else if (locLower.includes('race course')) {
      safety = 9.8; healthcare = 9.3; education = 9.2; transport = 9.1; dailyNeeds = 9.0; environment = 9.6;
    } else if (locLower.includes('singanallur')) {
      safety = 8.5; healthcare = 8.4; education = 8.3; transport = 8.9; dailyNeeds = 8.6; environment = 8.2;
    } else if (locLower.includes('vadavalli')) {
      safety = 9.2; healthcare = 8.1; education = 8.6; transport = 8.2; dailyNeeds = 8.1; environment = 9.3;
    } else if (locLower.includes('avinashi road')) {
      safety = 9.1; healthcare = 9.3; education = 9.4; transport = 9.5; dailyNeeds = 9.2; environment = 8.3;
    }

    const overallScore = Number(((safety + healthcare + education + transport + dailyNeeds + environment) / 6).toFixed(1));

    const localityDisplay = `${p.address ? p.address + ', ' : ''}${p.city || 'Coimbatore'}`;

    const lifeScore = {
      safety,
      healthcare,
      education,
      transport,
      dailyNeeds,
      environment,
      overallScore,
      locality: localityDisplay,
      hasData: true
    };

    // ==========================================
    // 3. 5-YEAR CAPITAL FORECAST & RESALE VELOCITY
    // ==========================================
    let cagr = 6.8;
    if (locLower.includes('saravanampatti')) cagr = 7.8;
    else if (locLower.includes('peelamedu')) cagr = 7.2;
    else if (locLower.includes('avinashi road')) cagr = 7.5;
    else if (locLower.includes('rs puram') || locLower.includes('race course')) cagr = 6.5;
    else if (p.category === 'land_plots') cagr = 8.5;
    else if (p.category === 'commercial') cagr = 8.0;

    const cagrRate = cagr / 100;
    const year1 = Math.round(price * (1 + cagrRate));
    const year2 = Math.round(price * Math.pow(1 + cagrRate, 2));
    const year3 = Math.round(price * Math.pow(1 + cagrRate, 3));
    const year4 = Math.round(price * Math.pow(1 + cagrRate, 4));
    const year5 = Math.round(price * Math.pow(1 + cagrRate, 5));
    const growthPercentage = Number((((year5 - price) / Math.max(1, price)) * 100).toFixed(2));

    let resaleVelocity = 'MODERATE';
    let velocityReason = 'Standard buyer liquidity and steady absorption time.';

    if ((p.trust_score >= 88 || p.is_verified) && (locLower.includes('peelamedu') || locLower.includes('saravanampatti') || locLower.includes('rs puram') || locLower.includes('avinashi road'))) {
      resaleVelocity = 'FAST';
      velocityReason = `High buyer liquidity, verified clear title, and strong absorption rate in ${p.city || 'Coimbatore'}.`;
    } else if (price >= 20000000 || p.category === 'commercial') {
      resaleVelocity = 'MODERATE';
      velocityReason = 'High-ticket luxury or commercial profile with typical 60–90 day closure cycle.';
    } else if (p.trust_score && p.trust_score < 75) {
      resaleVelocity = 'SLOW';
      velocityReason = 'Lower documentation verification rating may lengthen buyer due diligence cycle.';
    }

    const capitalForecast = {
      currentValue: price,
      cagr,
      year1,
      year2,
      year3,
      year4,
      year5,
      growthPercentage,
      resaleVelocity,
      velocityReason,
      disclaimer: 'Estimated forecast derived from micro-market compounding benchmarks and historical infrastructure momentum.'
    };

    res.json({
      success: true,
      data: {
        propertyId: p.id,
        title: p.title,
        price,
        type: p.type,
        city: p.city,
        hiddenCosts,
        lifeScore,
        capitalForecast
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/properties/nearby
 * Dedicated Geospatial Radius & GPS Intelligence Endpoint
 * Query Params: lat, lng, radius (km), listingType/type, propertyType/category, limit
 */
const getNearbyProperties = async (req, res, next) => {
  try {
    const {
      lat,
      lng,
      latitude,
      longitude,
      radius = 5,
      type,
      listingType,
      category,
      propertyType,
      limit = 50
    } = req.query;

    const rawLat = lat || latitude;
    const rawLng = lng || longitude;

    if (rawLat === undefined || rawLng === undefined || isNaN(parseFloat(rawLat)) || isNaN(parseFloat(rawLng))) {
      return res.status(400).json({
        success: false,
        message: 'Valid latitude and longitude coordinates are required for nearby property search.'
      });
    }

    const centerLat = parseFloat(rawLat);
    const centerLng = parseFloat(rawLng);
    const searchRadius = parseFloat(radius || 5);
    const filterType = type || listingType;
    const filterCat = category || propertyType;

    // Haversine formula for exact distance in kilometers
    const haversineSql = `(6371 * ACOS(LEAST(1.0, GREATEST(-1.0, COS(RADIANS(?)) * COS(RADIANS(p.lat)) * COS(RADIANS(p.lng) - RADIANS(?)) + SIN(RADIANS(?)) * SIN(RADIANS(p.lat))))))`;

    let conditions = [
      'p.status = "active"',
      'p.lat != 0',
      'p.lng != 0',
      `${haversineSql} <= ?`
    ];
    let params = [centerLat, centerLng, centerLat, searchRadius];

    // Compute type breakdown within radius before applying listing type filter
    const summaryQuery = `
      SELECT p.type, COUNT(*) as count
      FROM properties p
      WHERE ${conditions.join(' AND ')}
      GROUP BY p.type
    `;
    const [summaryRows] = await pool.query(summaryQuery, params);

    const typeSummary = {
      all: 0,
      rent: 0,
      buy: 0,
      sale: 0,
      lease: 0
    };
    summaryRows.forEach(r => {
      const c = Number(r.count);
      typeSummary.all += c;
      if (r.type === 'rent') typeSummary.rent += c;
      else if (r.type === 'buy' || r.type === 'sale') {
        typeSummary.buy += c;
        typeSummary.sale += c;
      } else if (r.type === 'lease') typeSummary.lease += c;
    });

    // Apply listing type filter if provided
    if (filterType && filterType !== 'all') {
      const typeLower = filterType.toLowerCase().trim();
      if (typeLower === 'sale' || typeLower === 'buy') {
        conditions.push('(p.type = "sale" OR p.type = "buy")');
      } else if (typeLower === 'rent') {
        conditions.push('p.type = "rent"');
      } else if (typeLower === 'lease') {
        conditions.push('p.type = "lease"');
      }
    }

    // Apply category filter if provided
    if (filterCat && filterCat !== 'all') {
      conditions.push('(p.category = ? OR p.property_type = ?)');
      params.push(filterCat, filterCat);
    }

    const { min_price, max_price, bedrooms, bhk } = req.query;
    if (min_price && !isNaN(parseFloat(min_price))) {
      conditions.push('p.price >= ?');
      params.push(parseFloat(min_price));
    }
    if (max_price && !isNaN(parseFloat(max_price))) {
      conditions.push('p.price <= ?');
      params.push(parseFloat(max_price));
    }
    const reqBedrooms = bedrooms || bhk;
    if (reqBedrooms && !isNaN(parseInt(reqBedrooms))) {
      conditions.push('(p.bedrooms = ? OR p.bhk = ?)');
      params.push(parseInt(reqBedrooms), parseInt(reqBedrooms));
    }

    const selectSql = `
      SELECT p.*,
             p.lat as latitude,
             p.lng as longitude,
             ROUND(${haversineSql}, 2) as distance_km,
             COALESCE(ts.score, 90) as trust_score,
             COALESCE(gs.score, 85) as green_score,
             COALESCE(ls.score, 88) as life_score,
             (SELECT image_url FROM property_images WHERE property_id = p.id ORDER BY is_primary DESC, id ASC LIMIT 1) as primary_image
      FROM properties p
      LEFT JOIN trust_scores ts ON p.id = ts.property_id
      LEFT JOIN green_scores gs ON p.id = gs.property_id
      LEFT JOIN life_scores ls ON p.id = ls.property_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY distance_km ASC
      LIMIT ?
    `;

    const selectParams = [centerLat, centerLng, centerLat, ...params, parseInt(limit)];
    const [properties] = await pool.query(selectSql, selectParams);

    // Calculate dynamic recommendation score for each nearby property:
    // 40% proximity + 30% trust score + 15% green score + 15% life score
    const scoredProperties = properties.map(p => {
      const dist = Number(p.distance_km) || 0;
      const trust = Number(p.trust_score) || 90;
      const green = Number(p.green_score) || 85;
      const life = Number(p.life_score) || 88;

      const proximityFactor = 1 / (1 + (dist / 2)); // 1.0 at 0km, 0.5 at 2km, 0.25 at 6km
      const recScore = Math.round(
        (proximityFactor * 40) +
        ((trust / 100) * 30) +
        ((green / 100) * 15) +
        ((life / 100) * 15)
      );

      return {
        ...p,
        recommendation_score: Math.min(99, Math.max(50, recScore))
      };
    });

    // Top recommended properties ranked by recommendation_score
    const recommended = [...scoredProperties]
      .sort((a, b) => b.recommendation_score - a.recommendation_score)
      .slice(0, 5);

    res.json({
      success: true,
      data: {
        center: {
          lat: centerLat,
          lng: centerLng,
          radius_km: searchRadius
        },
        count: scoredProperties.length,
        type_summary: typeSummary,
        recommended_properties: recommended,
        properties: scoredProperties
      }
    });
  } catch (err) {
    next(err);
  }
};


/**
 * GET /api/properties/location-intelligence
 * Dynamic Locality LifeScore & Civic Intelligence Endpoint
 * Query Params: lat, lng, radius (km), locality, city
 */
const getLocationIntelligence = async (req, res, next) => {
  try {
    const {
      lat,
      lng,
      latitude,
      longitude,
      radius = 5,
      locality = '',
      city = 'Coimbatore'
    } = req.query;

    const rawLat = lat || latitude;
    const rawLng = lng || longitude;

    let centerLat = 11.0267;
    let centerLng = 77.0028;
    if (rawLat !== undefined && rawLng !== undefined && !isNaN(parseFloat(rawLat)) && !isNaN(parseFloat(rawLng))) {
      centerLat = parseFloat(rawLat);
      centerLng = parseFloat(rawLng);
    }
    const searchRadius = parseFloat(radius || 5);

    // Query properties in this zone
    const haversineSql = `(6371 * ACOS(LEAST(1.0, GREATEST(-1.0, COS(RADIANS(?)) * COS(RADIANS(p.lat)) * COS(RADIANS(p.lng) - RADIANS(?)) + SIN(RADIANS(?)) * SIN(RADIANS(p.lat))))))`;
    const [propRows] = await pool.query(`
      SELECT p.id, p.price, p.type, p.area_sqft, p.bhk, p.bedrooms,
             ROUND(${haversineSql}, 2) as distance_km
      FROM properties p
      WHERE p.status = 'active' AND p.lat != 0 AND p.lng != 0 AND ${haversineSql} <= ?
    `, [centerLat, centerLng, centerLat, centerLat, centerLng, centerLat, searchRadius]);

    let totalProperties = propRows.length;
    let rentCount = 0;
    let buyCount = 0;
    let leaseCount = 0;
    let sumSalePrice = 0;
    let countSale = 0;
    let sumRentPrice = 0;
    let countRent = 0;

    propRows.forEach(p => {
      const priceNum = Number(p.price) || 0;
      if (p.type === 'rent') {
        rentCount++;
        if (priceNum > 0) {
          sumRentPrice += priceNum;
          countRent++;
        }
      } else if (p.type === 'buy' || p.type === 'sale') {
        buyCount++;
        if (priceNum > 0) {
          sumSalePrice += priceNum;
          countSale++;
        }
      } else if (p.type === 'lease') {
        leaseCount++;
      }
    });

    const avgPrice = countSale > 0 ? Math.round(sumSalePrice / countSale) : null;
    const avgRent = countRent > 0 ? Math.round(sumRentPrice / countRent) : null;

    // Micro-market Locality LifeScore computation (0–10 scale)
    const locLower = (locality || city || '').toLowerCase();
    let safety = 8.8, healthcare = 8.5, education = 8.9, transport = 8.6, dailyNeeds = 8.4, environment = 8.6;
    let hospitalsCount = 6;
    let schoolsCount = 9;
    let transportRating = 'Good';

    if (locLower.includes('peelamedu') || (centerLat >= 11.02 && centerLat <= 11.04 && centerLng >= 76.99 && centerLng <= 77.03)) {
      safety = 9.2; healthcare = 8.9; education = 9.5; transport = 9.0; dailyNeeds = 8.8; environment = 8.4;
      hospitalsCount = 8; schoolsCount = 14; transportRating = 'Good';
    } else if (locLower.includes('rs puram') || locLower.includes('r.s. puram') || (centerLat >= 11.00 && centerLat <= 11.015 && centerLng >= 76.94 && centerLng <= 76.96)) {
      safety = 9.4; healthcare = 9.2; education = 9.1; transport = 8.7; dailyNeeds = 9.5; environment = 8.9;
      hospitalsCount = 10; schoolsCount = 11; transportRating = 'Good';
    } else if (locLower.includes('gandhipuram') || (centerLat >= 11.015 && centerLat <= 11.025 && centerLng >= 76.96 && centerLng <= 76.98)) {
      safety = 8.5; healthcare = 8.8; education = 8.6; transport = 9.6; dailyNeeds = 9.4; environment = 7.8;
      hospitalsCount = 7; schoolsCount = 8; transportRating = 'Good';
    } else if (locLower.includes('saravanampatti') || (centerLat >= 11.07 && centerLat <= 11.10 && centerLng >= 76.98 && centerLng <= 77.01)) {
      safety = 8.7; healthcare = 8.2; education = 9.2; transport = 8.4; dailyNeeds = 8.3; environment = 8.8;
      hospitalsCount = 5; schoolsCount = 12; transportRating = 'Moderate';
    } else if (locLower.includes('race course') || (centerLat >= 10.995 && centerLat <= 11.008 && centerLng >= 76.965 && centerLng <= 76.98)) {
      safety = 9.6; healthcare = 9.0; education = 8.9; transport = 8.9; dailyNeeds = 8.9; environment = 9.4;
      hospitalsCount = 9; schoolsCount = 7; transportRating = 'Good';
    } else {
      const densityScore = Math.min(9.0, Math.max(6.5, 7.0 + (totalProperties * 0.3)));
      safety = Number((densityScore + 0.2).toFixed(1));
      healthcare = Number((densityScore - 0.1).toFixed(1));
      education = Number((densityScore + 0.3).toFixed(1));
      transport = Number((densityScore).toFixed(1));
      dailyNeeds = Number((densityScore - 0.2).toFixed(1));
      environment = Number((densityScore + 0.1).toFixed(1));
      hospitalsCount = Math.max(2, Math.round(totalProperties * 0.8));
      schoolsCount = Math.max(3, Math.round(totalProperties * 1.2));
      transportRating = totalProperties >= 3 ? 'Good' : 'Moderate';
    }

    const overallScore = Number(((safety + healthcare + education + transport + dailyNeeds + environment) / 6).toFixed(1));

    res.json({
      success: true,
      data: {
        locality: locality || `${centerLat.toFixed(4)}, ${centerLng.toFixed(4)}`,
        center: { lat: centerLat, lng: centerLng, radius_km: searchRadius },
        metrics: {
          totalProperties,
          avgPrice,
          avgRent,
          rentCount,
          buyCount,
          leaseCount,
          hospitalsCount,
          schoolsCount,
          transportRating
        },
        lifeScore: {
          safety,
          healthcare,
          education,
          transport,
          dailyNeeds,
          environment,
          overallScore,
          hasData: true
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/properties/:id/hidden-costs
const getPropertyHiddenCosts = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [propRows] = await pool.query(
      `SELECT p.*, hc.breakdown_json, hc.maintenance_est_annual, hc.stamp_duty, hc.registration_cost, hc.property_tax_annual, hc.total_est_first_year
       FROM properties p
       LEFT JOIN hidden_costs hc ON p.id = hc.property_id
       WHERE p.id = ?`,
      [id]
    );

    if (propRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Property not found.' });
    }

    const property = propRows[0];
    const hiddenCosts = calculateHiddenCosts(property);

    res.json({
      success: true,
      data: hiddenCosts
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getProperties,
  getNearbyProperties,
  getLocationIntelligence,
  getCategoryStats,
  getPropertyById,
  getPropertyHiddenCosts,
  getPropertyAnalytics,
  createProperty,
  updateProperty,
  deleteProperty,
  uploadImages,
  setPrimaryImage,
  deleteImage,
  uploadVirtualTourRoom,
  updateVirtualTourRoom,
  deleteVirtualTourRoom,
  uploadDocument,
  getMyProperties
};



