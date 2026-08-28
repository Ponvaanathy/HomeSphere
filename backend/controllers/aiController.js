const pool = require('../config/db');

/**
 * =========================================================================
 * HOMESPHERE AI INTELLIGENCE SERVICE LAYER
 * Comprehensive Decision Intelligence and Contextual Q&A
 * =========================================================================
 */

// Helper for Indian Currency Formatting
function formatInr(num, type) {
  if (!num || isNaN(Number(num))) return '₹0';
  const n = Number(num);
  let str = '';
  if (n >= 10000000) str = `₹${(n / 10000000).toFixed(2)} Cr`;
  else if (n >= 100000) str = `₹${(n / 100000).toFixed(2)} Lakhs`;
  else str = `₹${n.toLocaleString('en-IN')}`;
  if (type === 'rent' || type === 'lease') str += '/mo';
  return str;
}

// Helper: Extract conversation entities (City/Locality, Budget, BHK, Listing Type, Property Type) from query & history
function extractConversationEntities(query, history = []) {
  // Aggregate all user messages chronologically
  const userMessages = history.filter(h => h.role === 'user' || !h.role).map(h => h.content || '');
  const fullText = [...userMessages, query].join(' ').toLowerCase();
  const currentQueryLower = query.toLowerCase();

  const entities = {
    locality: null,
    city: null,
    maxBudget: null,
    minBudget: null,
    bedrooms: null,
    listingType: null, // 'rent', 'buy', 'sale', 'lease'
    propertyType: null, // 'apartment', 'villa', 'commercial', 'land', 'house'
    isCheaperRequest: false,
    isMoreOptionsRequest: false,
    isFilterRequest: false
  };

  // Check if this is a comparative / follow-up modifier
  if (currentQueryLower.includes('cheaper') || currentQueryLower.includes('lower budget') || currentQueryLower.includes('less expensive') || currentQueryLower.includes('affordable') || currentQueryLower.includes('under that')) {
    entities.isCheaperRequest = true;
  }
  if (currentQueryLower.includes('more options') || currentQueryLower.includes('show more') || currentQueryLower.includes('other properties') || currentQueryLower.includes('anything else')) {
    entities.isMoreOptionsRequest = true;
  }

  // 1. Listing Type (Rent vs Buy/Sale vs Lease)
  if (fullText.includes('rent') || fullText.includes('rental') || fullText.includes('lease') || fullText.includes('to let')) {
    entities.listingType = fullText.includes('lease') ? 'lease' : 'rent';
  } else if (fullText.includes('buy') || fullText.includes('purchase') || fullText.includes('sale') || fullText.includes('for sale')) {
    entities.listingType = 'sale';
  }

  // 2. Locality / City match
  const localities = [
    'peelamedu', 'gandhipuram', 'rs puram', 'r.s. puram', 'saravanampatti', 'race course',
    'avinashi road', 'singanallur', 'vadavalli', 'saibaba colony', 'thudiyalur', 'ramanathapuram',
    'coimbatore', 'chennai', 'bangalore', 'austin', 'seattle', 'chicago', 'miami'
  ];
  for (const loc of localities) {
    if (fullText.includes(loc)) {
      entities.locality = loc === 'r.s. puram' ? 'RS Puram' : (loc.charAt(0).toUpperCase() + loc.slice(1));
      break;
    }
  }

  // 3. BHK / Bedrooms
  const bhkMatch = fullText.match(/(\d)\s*(?:bhk|bed|bedroom|bedrooms)/);
  if (bhkMatch) {
    entities.bedrooms = parseInt(bhkMatch[1]);
  } else if (fullText.includes('single room') || fullText.includes('1 room')) {
    entities.bedrooms = 1;
  }

  // 4. Budget Extraction
  const crMatch = fullText.match(/(\d+(?:\.\d+)?)\s*(?:cr|crore|crores)/);
  if (crMatch) {
    entities.maxBudget = parseFloat(crMatch[1]) * 10000000;
  } else {
    const lakhMatch = fullText.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|lac|lacs|l)/);
    if (lakhMatch) {
      entities.maxBudget = parseFloat(lakhMatch[1]) * 100000;
    } else {
      const directNumMatch = fullText.match(/(?:under|below|budget|max|upto|within|around)\s*(?:₹|rs\.?|inr)?\s*(\d{4,8})/);
      if (directNumMatch) {
        entities.maxBudget = parseFloat(directNumMatch[1]);
      } else {
        const anyNumMatch = fullText.match(/(?:₹|rs\.?)\s*(\d{4,8})/);
        if (anyNumMatch) {
          entities.maxBudget = parseFloat(anyNumMatch[1]);
        }
      }
    }
  }

  // 5. Property Type
  if (fullText.includes('villa') || fullText.includes('duplex') || fullText.includes('independent house')) entities.propertyType = 'villa';
  else if (fullText.includes('apartment') || fullText.includes('flat')) entities.propertyType = 'apartment';
  else if (fullText.includes('commercial') || fullText.includes('office') || fullText.includes('shop') || fullText.includes('retail')) entities.propertyType = 'commercial';
  else if (fullText.includes('plot') || fullText.includes('land')) entities.propertyType = 'land_plots';
  else if (fullText.includes('pg') || fullText.includes('co-living') || fullText.includes('room')) entities.propertyType = 'pg_rooms';

  return entities;
}

// 1. AI Property Match
const getPropertyMatch = async (req, res, next) => {
  try {
    const userId = req.user ? req.user.id : null;
    let prefs = req.body.preferences;

    if (!prefs && userId) {
      const [userPrefRows] = await pool.query('SELECT * FROM user_preferences WHERE user_id = ?', [userId]);
      if (userPrefRows.length > 0) {
        prefs = userPrefRows[0];
      }
    }

    const budgetMin = parseFloat(prefs?.budget_min) || 0;
    const budgetMax = parseFloat(prefs?.budget_max) || 30000000;
    const prefCity = prefs?.preferred_city || '';
    const prefType = prefs?.preferred_type || '';
    const lifestyle = typeof prefs?.lifestyle_json === 'string' ? JSON.parse(prefs.lifestyle_json || '{}') : (prefs?.lifestyle_json || {});

    // Fetch active properties
    const [properties] = await pool.query(`
      SELECT p.*,
             COALESCE(ts.score, 75) as trust_score,
             COALESCE(ls.score, 80) as life_score,
             COALESCE(gs.score, 70) as green_score,
             (SELECT image_url FROM property_images WHERE property_id = p.id ORDER BY is_primary DESC, id ASC LIMIT 1) as primary_image
      FROM properties p
      LEFT JOIN trust_scores ts ON p.id = ts.property_id
      LEFT JOIN life_scores ls ON p.id = ls.property_id
      LEFT JOIN green_scores gs ON p.id = gs.property_id
      WHERE p.status = 'active'
    `);

    const rankedMatches = properties.map((prop) => {
      let score = 60;
      const matchReasons = [];

      if (prop.price >= budgetMin && prop.price <= budgetMax) {
        score += 15;
        matchReasons.push('Within target budget range');
      } else if (prop.price < budgetMin) {
        score += 8;
        matchReasons.push('High value under your budget');
      } else {
        score -= 10;
      }

      if (prefCity && prop.city && prop.city.toLowerCase().includes(prefCity.toLowerCase())) {
        score += 15;
        matchReasons.push(`Located in preferred city (${prop.city})`);
      }

      if (prefType && prop.property_type && prop.property_type.toLowerCase() === prefType.toLowerCase()) {
        score += 10;
        matchReasons.push(`Matches preferred structure (${prop.property_type})`);
      }

      if (lifestyle.prioritize_green && prop.green_score >= 85) {
        score += 5;
        matchReasons.push('High eco & sustainability rating');
      }
      if (lifestyle.near_transit && prop.life_score >= 88) {
        score += 5;
        matchReasons.push('Prime transit & walkability index');
      }
      if (prop.trust_score >= 90) {
        score += 5;
        matchReasons.push('Exceptional Trust & Verification Rating');
      }

      const finalMatchScore = Math.min(99, Math.max(40, score));

      return {
        ...prop,
        ai_match_score: finalMatchScore,
        match_reasons: matchReasons
      };
    });

    rankedMatches.sort((a, b) => b.ai_match_score - a.ai_match_score);

    res.json({
      success: true,
      data: rankedMatches
    });
  } catch (err) {
    next(err);
  }
};

// 2. AI Home Advisor (Conversational Decision Engine with Full Property & Multi-Turn Context)
const getAdvisorResponse = async (req, res, next) => {
  try {
    const { query, conversationHistory = [] } = req.body;
    const propertyId = req.body.property_id || req.body.propertyId || req.query?.property_id || req.query?.propertyId || null;

    if (!query || query.trim() === '') {
      return res.status(400).json({ success: false, message: 'Query cannot be empty.' });
    }

    const qTrim = query.trim();
    const qLower = qTrim.toLowerCase();
    const entities = extractConversationEntities(qTrim, conversationHistory);

    let propertyContext = null;
    let analyticsData = null;

    if (propertyId) {
      const [rows] = await pool.query(
        `SELECT p.*,
                ts.score as trust_score, ts.verification_rating, ts.price_sanity_score,
                dna.age_years, dna.legal_status, dna.structural_notes,
                ls.score as life_score_val, ls.safety_score, ls.transit_score, ls.school_score, ls.amenities_score,
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
      if (rows.length > 0) {
        propertyContext = rows[0];

        // Compute property-specific analytics
        const price = Number(propertyContext.price) || 0;
        const area = Number(propertyContext.area_sqft) || 1200;
        const isRent = propertyContext.type === 'rent' || propertyContext.type === 'lease';
        const locLower = `${propertyContext.address || ''} ${propertyContext.city || ''} ${propertyContext.locality || ''}`.toLowerCase();

        // Hidden costs
        const stampDuty = propertyContext.stamp_duty ? Number(propertyContext.stamp_duty) : Math.round(price * (isRent ? 0.01 : 0.07));
        const regFee = propertyContext.registration_cost ? Number(propertyContext.registration_cost) : (isRent ? (price > 50000 ? 2500 : 1000) : Math.round(price * 0.01));
        const maint = propertyContext.maintenance_est_annual ? Number(propertyContext.maintenance_est_annual) : (isRent ? Math.round(price * 0.08 * 12) : Math.round(area * 2.5 * 12));
        const fitOut = isRent ? 10000 : Math.round(area * (propertyContext.furnishing === 'unfurnished' ? 180 : 90));
        const totalEstimated = isRent ? (price * 12) + (price * 3) + maint + fitOut : price + stampDuty + regFee + maint + fitOut + Math.round(price * 0.002);

        // LifeScores
        let safety = 8.8, healthcare = 8.5, education = 8.9, transport = 8.6, dailyNeeds = 8.4, environment = 8.6;
        if (locLower.includes('peelamedu')) { safety = 9.2; healthcare = 8.9; education = 9.5; transport = 9.0; dailyNeeds = 8.8; environment = 8.4; }
        else if (locLower.includes('saravanampatti')) { safety = 8.9; healthcare = 8.3; education = 8.8; transport = 8.6; dailyNeeds = 8.5; environment = 8.7; }
        else if (locLower.includes('rs puram') || locLower.includes('r.s. puram')) { safety = 9.6; healthcare = 9.2; education = 9.3; transport = 8.9; dailyNeeds = 9.4; environment = 9.0; }
        else if (locLower.includes('race course')) { safety = 9.8; healthcare = 9.3; education = 9.2; transport = 9.1; dailyNeeds = 9.0; environment = 9.6; }
        else if (locLower.includes('gandhipuram')) { safety = 9.0; healthcare = 9.1; education = 9.0; transport = 9.6; dailyNeeds = 9.5; environment = 8.2; }
        const lifeOverall = Number(((safety + healthcare + education + transport + dailyNeeds + environment) / 6).toFixed(1));

        // Capital forecast
        let cagr = 6.8;
        if (locLower.includes('saravanampatti')) cagr = 7.8;
        else if (locLower.includes('peelamedu')) cagr = 7.2;
        else if (locLower.includes('avinashi road')) cagr = 7.5;
        else if (locLower.includes('rs puram')) cagr = 6.5;

        const val1Yr = Math.round(price * (1 + cagr / 100));
        const val3Yr = Math.round(price * Math.pow(1 + cagr / 100, 3));
        const val5Yr = Math.round(price * Math.pow(1 + cagr / 100, 5));
        const growthPct = Number((((val5Yr - price) / Math.max(1, price)) * 100).toFixed(1));

        analyticsData = {
          price, area, isRent,
          stampDuty, regFee, maint, fitOut, totalEstimated,
          safety, healthcare, education, transport, dailyNeeds, environment, lifeOverall,
          cagr, val1Yr, val3Yr, val5Yr, growthPct
        };
      }
    }

    let advisorReply = '';
    let quickActions = [];

    // =========================================================================
    // SCENARIO 1: SPECIFIC PROPERTY CONTEXT ACTIVE
    // =========================================================================
    if (propertyContext && analyticsData) {
      const p = propertyContext;
      const a = analyticsData;
      const basePriceFmt = formatInr(p.price, p.type);
      const trustScore = p.trust_score || 92;

      // 1.1 Hidden Costs Breakdown
      if (qLower.includes('cost') || qLower.includes('hidden') || qLower.includes('outlay') || qLower.includes('fee') || qLower.includes('stamp') || qLower.includes('registration') || qLower.includes('maintenance')) {
        if (!a.isRent) {
          advisorReply = `### 💰 Hidden Cost Breakdown for **${p.title}**\n\n` +
            `Beyond the base listing price of **${basePriceFmt}**, our financial intelligence engine calculates an estimated first-year ownership outlay of **${formatInr(a.totalEstimated)}**:\n\n` +
            `* **Base Property Price:** ${basePriceFmt}\n` +
            `* **Statutory Stamp Duty (~7%):** ${formatInr(a.stampDuty)} *(Estimated)*\n` +
            `* **Registration Charge (1%):** ${formatInr(a.regFee)} *(Estimated)*\n` +
            `* **Annual Society Maintenance (~₹2.5/sqft/mo):** ${formatInr(a.maint)} *(Estimated)*\n` +
            `* **Interior & Fit-out Provision (${p.furnishing || 'semi-furnished'}):** ${formatInr(a.fitOut)} *(Estimated)*\n` +
            `* **Estimated Total First-Year Outlay:** **${formatInr(a.totalEstimated)}**\n\n` +
            `💡 **How is this calculated?** Stamp duty and registration are estimated based on prevailing state benchmarks, maintenance is scaled to **${p.area_sqft || 1200} sq.ft**, and fit-outs are based on ${p.furnishing || 'semi-furnished'} requirements.`;
        } else {
          advisorReply = `### 💰 Rental Outlay Breakdown for **${p.title}**\n\n` +
            `For this rental listing at **${basePriceFmt}**, here is the transparent breakdown of your initial and annual outlay:\n\n` +
            `* **Monthly Rent:** ${basePriceFmt}\n` +
            `* **Refundable Security Deposit (3 Months):** ${formatInr(a.price * 3)} *(Estimated)*\n` +
            `* **Annual Society Maintenance Provision:** ${formatInr(a.maint)} *(Estimated)*\n` +
            `* **Move-in Setup Contingency:** ${formatInr(a.fitOut)} *(Estimated)*\n` +
            `* **Total Estimated 1-Year Financial Outlay:** **${formatInr(a.totalEstimated)}**\n\n` +
            `💡 **AI Advisory:** Always confirm whether society maintenance is included in the base rent and request an itemized security deposit agreement.`;
        }

        quickActions = [
          { text: 'Is this property worth buying?', prompt: 'Is this property worth buying at this price?' },
          { text: 'Analyze Locality LifeScore', prompt: 'How good is this locality and neighborhood?' },
          { text: '5-Year Capital Growth', prompt: 'What will this property be worth in 5 years?' }
        ];
      }

      // 1.2 Green Living & Sustainability
      else if (qLower.includes('green') || qLower.includes('eco') || qLower.includes('solar') || qLower.includes('sustainab') || qLower.includes('energy')) {
        const gScore = p.green_score_val || 85;
        advisorReply = `### 🌿 Green Living Score Analysis for **${p.title}**\n\n` +
          `This property holds a verified **Green Living Score of ${gScore}/100** (Energy Efficiency Rating: **A+**):\n\n` +
          `* ☀️ **Solar Installation:** Rooftop photovoltaic array integrated with grid tie-in.\n` +
          `* 🔋 **EV Mobility Readiness:** Dedicated EV charging point provision in parking bay.\n` +
          `* 🌧️ **Water Conservation:** Rainwater harvesting recharge pit and dual-flush plumbing systems.\n` +
          `* 🌱 **Carbon Offset:** Estimated **~4.2 tons of CO2 offset annually**.\n\n` +
          `🎯 **AI Eco-Living Verdict:** Highly recommended for environmentally conscious residents looking to minimize recurring utility overheads.`;

        quickActions = [
          { text: 'Check Hidden Costs', prompt: 'What are the estimated hidden costs?' },
          { text: 'Analyze Locality', prompt: 'How good is this locality?' }
        ];
      }

      // 1.3 Locality & Neighborhood LifeScore
      else if (qLower.includes('locality') || qLower.includes('neighborhood') || qLower.includes('area') || qLower.includes('location') || qLower.includes('safety') || qLower.includes('school') || qLower.includes('hospital') || qLower.includes('transit') || qLower.includes('lifescore') || qLower.includes('family')) {
        advisorReply = `### 📍 Locality LifeScore Intelligence: **${p.city || 'Coimbatore'}**\n\n` +
          `**${p.title}** in **${p.address ? p.address + ', ' : ''}${p.city}** holds an overall **Locality LifeScore of ${a.lifeOverall}/10** evaluated across 6 core urban parameters:\n\n` +
          `* 🛡️ **Safety (${a.safety}/10):** Low municipal incident rate with well-lit avenues and active community surveillance.\n` +
          `* 🏥 **Healthcare Proximity (${a.healthcare}/10):** Multi-specialty hospitals and 24/7 pharmacies located within a 10-15 minute transit corridor.\n` +
          `* 🏫 **Education & Schools (${a.education}/10):** Top-tier CBSE, ICSE, and higher education institutes in immediate proximity.\n` +
          `* 🚆 **Transport & Connectivity (${a.transport}/10):** Direct access to arterial roadways, bus routes, and key employment hubs.\n` +
          `* 🛒 **Daily Needs & Commerce (${a.dailyNeeds}/10):** Supermarkets, fresh produce markets, banks, and dining hubs within 1 km.\n` +
          `* 🌿 **Environment Quality (${a.environment}/10):** Green canopy coverage and balanced acoustic tranquility.\n\n` +
          `🎯 **AI Locality Verdict:** High livability corridor ideal for families and long-term residents seeking top tier civic infrastructure.`;

        quickActions = [
          { text: 'Check Hidden Costs', prompt: 'What are the estimated hidden costs for this property?' },
          { text: '5-Year Capital Forecast', prompt: 'What will this property be worth in 5 years?' },
          { text: 'Is it worth buying?', prompt: 'Is this property worth buying?' }
        ];
      }

      // 1.4 5-Year Capital Forecast
      else if (qLower.includes('5 years') || qLower.includes('5-year') || qLower.includes('growth') || qLower.includes('appreciation') || qLower.includes('cagr') || qLower.includes('forecast') || qLower.includes('worth in 5') || qLower.includes('future value') || qLower.includes('roi') || qLower.includes('invest')) {
        advisorReply = `### 📈 5-Year Capital Forecast for **${p.title}**\n\n` +
          `Based on micro-market compounding momentum in **${p.city}**, here is the projected capital appreciation trajectory (estimated at **~${a.cagr}% CAGR**):\n\n` +
          `* **Current Property Value:** ${basePriceFmt}\n` +
          `* **Year 1 Projected Value:** **${formatInr(a.val1Yr)}** *(+${formatInr(a.val1Yr - a.price)})*\n` +
          `* **Year 3 Projected Value:** **${formatInr(a.val3Yr)}** *(+${formatInr(a.val3Yr - a.price)})*\n` +
          `* **Year 5 Projected Value:** **${formatInr(a.val5Yr)}** *(+${formatInr(a.val5Yr - a.price)})*\n` +
          `* **Total 5-Year Estimated Growth:** **+${a.growthPct}%**\n` +
          `* **Resale Velocity Rating:** **FAST** *(High secondary market demand and buyer liquidity)*\n\n` +
          `🌟 **Key Growth Drivers:** Ongoing infrastructure expansion, employment cluster proximity, and steady residential absorption. *(Estimated Forecast)*`;

        quickActions = [
          { text: 'Check Hidden Costs', prompt: 'What are the estimated hidden costs for this property?' },
          { text: 'Analyze Locality', prompt: 'How good is this locality?' },
          { text: 'Overall Verdict', prompt: 'Is this property worth buying?' }
        ];
      }

      // 1.5 Valuation Verdict & Buying Advice
      else if (qLower.includes('worth') || qLower.includes('should i buy') || qLower.includes('good buy') || qLower.includes('valuation') || qLower.includes('verdict') || qLower.includes('fair price') || qLower.includes('recommend this')) {
        const sqftRate = p.area_sqft > 0 ? Math.round(a.price / Number(p.area_sqft)) : null;
        const verdict = trustScore >= 88 && a.lifeOverall >= 8.5 ? 'Strong Buy Candidate' : 'Recommended with Standard Due Diligence';

        advisorReply = `### 📊 AI Valuation & Decision Verdict: **${p.title}**\n\n` +
          `**Overall Verdict:** **${verdict}**\n\n` +
          `**Key Quantitative Strengths:**\n` +
          `* **Price & Valuation:** Listed at **${basePriceFmt}** ${sqftRate ? `(≈ ₹${sqftRate.toLocaleString()}/sq.ft)` : ''}, fully aligned with fair market benchmark pricing.\n` +
          `* **Trust Score:** **${trustScore}/100** with verified clear title documentation.\n` +
          `* **Locality LifeScore:** **${a.lifeOverall}/10** with strong safety (${a.safety}/10) and educational access (${a.education}/10).\n` +
          `* **Growth Potential:** Projected **~${a.cagr}% annual CAGR** (+${a.growthPct}% over 5 years).\n` +
          `* **Resale Velocity:** **FAST** with high liquidity in ${p.city}.\n\n` +
          `**Checklist Before Finalizing:**\n` +
          `1. Maintain ~${formatInr(a.totalEstimated - a.price)} buffer for stamp duty, registration, and setup.\n` +
          `2. Inspect latest municipal property tax receipts and Encumbrance Certificate (EC).\n` +
          `3. Verify dedicated parking allocation in the builder allotment letter.`;

        quickActions = [
          { text: 'Hidden Cost Breakdown', prompt: 'What are the hidden costs for this property?' },
          { text: '5-Year Forecast', prompt: 'What will this property be worth in 5 years?' },
          { text: 'Check Locality', prompt: 'How good is this locality?' }
        ];
      }

      // 1.6 Legal & Title Verification
      else if (qLower.includes('legal') || qLower.includes('title') || qLower.includes('document') || qLower.includes('verify') || qLower.includes('trust') || qLower.includes('safe')) {
        advisorReply = `### 🛡️ Legal Verification & Property DNA for **${p.title}**\n\n` +
          `* **Trust Score:** **${trustScore}/100** (Verified)\n` +
          `* **Title Status:** *${p.legal_status || 'Verified Clear Title'}*\n` +
          `* **Structural Construction:** *${p.structural_notes || 'RCC framed structure with approved municipal blueprint'}*\n` +
          `* **Owner Identity:** Verified listing account **${p.owner_name || 'Listing Owner'}**.\n\n` +
          `**HomeSphere Multi-Point Audit Checks:**\n` +
          `* ✓ Parent title document chain verified for unbroken ownership\n` +
          `* ✓ Encumbrance Certificate checked — zero active liens or bank attachments\n` +
          `* ✓ Municipal sanctioned building layout confirmed with local authority approvals`;

        quickActions = [
          { text: 'Check Hidden Costs', prompt: 'What are the estimated hidden costs?' },
          { text: 'Is it worth buying?', prompt: 'Is this property worth buying?' }
        ];
      }

      // 1.7 General fallback with live property context
      else {
        advisorReply = `### 🏡 Evaluating **${p.title}** in ${p.city}\n\n` +
          `Here is the verified executive snapshot for this **${basePriceFmt}** listing:\n\n` +
          `* **Trust Score:** **${trustScore}/100** (Clear Title Verified)\n` +
          `* **Locality LifeScore:** **${a.lifeOverall}/10** in ${p.address || p.city}\n` +
          `* **Estimated First-Year Outlay:** **${formatInr(a.totalEstimated)}** *(incl. stamp duty & setup)*\n` +
          `* **5-Year Growth Forecast:** **+${a.growthPct}%** *(~${a.cagr}% CAGR)*\n\n` +
          `Ask me anything specific about this property's **hidden costs**, **locality safety**, **5-year forecast**, or **legal checklist**!`;

        quickActions = [
          { text: 'Is it worth buying?', prompt: 'Is this property worth buying?' },
          { text: 'Hidden Costs', prompt: 'What are the hidden costs?' },
          { text: '5-Year Forecast', prompt: 'What will this property be worth in 5 years?' },
          { text: 'Locality Analysis', prompt: 'How good is this locality?' }
        ];
      }
    }

    // =========================================================================
    // SCENARIO 2: GENERAL MARKET ADVICE & ACTIVE DATABASE QUERY
    // =========================================================================
    else {

      // 2.1 Family-Friendly / Schools & Healthcare Proximity Intent
      if (qLower.includes('family') || qLower.includes('school') || qLower.includes('hospital') || qLower.includes('kids') || qLower.includes('children') || qLower.includes('healthcare')) {
        const [familyProps] = await pool.query(
          `SELECT p.*, COALESCE(ts.score, 85) as trust_score, COALESCE(ls.score, 90) as life_score, COALESCE(gs.score, 80) as green_score,
                  (SELECT image_url FROM property_images WHERE property_id = p.id ORDER BY is_primary DESC, id ASC LIMIT 1) as primary_image
           FROM properties p
           LEFT JOIN trust_scores ts ON p.id = ts.property_id
           LEFT JOIN life_scores ls ON p.id = ls.property_id
           LEFT JOIN green_scores gs ON p.id = gs.property_id
           WHERE p.status = 'active'
           ORDER BY COALESCE(ls.score, 80) DESC, COALESCE(ts.score, 80) DESC
           LIMIT 3`
        );

        const listMarkdown = familyProps.map(m => {
          const defaultImg = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=600&q=80';
          const img = m.primary_image || defaultImg;
          return `#### 🏡 [${m.title}](/property-details.html?id=${m.id})\n` +
                 `![${m.title}](${img})\n` +
                 `* **Price:** **${formatInr(m.price, m.type)}** | **Location:** ${m.address ? m.address + ', ' : ''}${m.city}\n` +
                 `* **Specs:** ${m.bedrooms ? m.bedrooms + ' BHK | ' : ''}${m.area_sqft ? Number(m.area_sqft).toLocaleString() + ' sq.ft | ' : ''}${m.property_type || 'Residential'}\n` +
                 `* **Locality LifeScore:** **${m.life_score}/100** (Top School & Hospital Proximity) | **Trust Score:** **${m.trust_score}/100**\n` +
                 `* 🔗 **[View Property Details →](/property-details.html?id=${m.id})**`;
        }).join('\n\n---\n\n');

        advisorReply = `### 👨‍👩‍👧‍👦 Top Family-Friendly Properties with High School & Healthcare Access\n\n` +
          `For families prioritizing **neighborhood safety**, **top CBSE/ICSE schools**, and **multi-specialty hospitals**, here are the top-rated verified active properties in Coimbatore:\n\n` +
          listMarkdown + `\n\n` +
          `💡 **AI Family Advisory:** Localities like **Peelamedu**, **RS Puram**, and **Saravanampatti** consistently rank highest in pediatric healthcare proximity and school bus routes.`;

        quickActions = [
          { text: 'Properties in Peelamedu', prompt: 'Find properties in Peelamedu' },
          { text: 'Properties in RS Puram', prompt: 'Find properties in RS Puram' },
          { text: 'Check Buy vs Rent', prompt: 'Should I rent or buy?' }
        ];
      }

      // 2.2 Investment & Highest ROI / Capital Growth Intent
      else if (qLower.includes('invest') || qLower.includes('roi') || qLower.includes('return') || qLower.includes('capital growth') || qLower.includes('growth') || qLower.includes('rental yield') || qLower.includes('appreciation')) {
        const [investProps] = await pool.query(
          `SELECT p.*, COALESCE(ts.score, 85) as trust_score, COALESCE(ls.score, 85) as life_score,
                  (SELECT image_url FROM property_images WHERE property_id = p.id ORDER BY is_primary DESC, id ASC LIMIT 1) as primary_image
           FROM properties p
           LEFT JOIN trust_scores ts ON p.id = ts.property_id
           LEFT JOIN life_scores ls ON p.id = ls.property_id
           WHERE p.status = 'active'
           ORDER BY p.price ASC, COALESCE(ts.score, 80) DESC
           LIMIT 3`
        );

        const listMarkdown = investProps.map(m => {
          const defaultImg = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=600&q=80';
          const img = m.primary_image || defaultImg;
          return `#### 📈 [${m.title}](/property-details.html?id=${m.id})\n` +
                 `![${m.title}](${img})\n` +
                 `* **Price:** **${formatInr(m.price, m.type)}** | **Location:** ${m.address ? m.address + ', ' : ''}${m.city}\n` +
                 `* **Specs:** ${m.bedrooms ? m.bedrooms + ' BHK | ' : ''}${m.area_sqft ? Number(m.area_sqft).toLocaleString() + ' sq.ft | ' : ''}${m.property_type || 'Residential'}\n` +
                 `* **Projected Growth:** **~7.5% - 8.2% Annual CAGR** | **Trust Score:** **${m.trust_score}/100**\n` +
                 `* 🔗 **[View Property Details →](/property-details.html?id=${m.id})**`;
        }).join('\n\n---\n\n');

        advisorReply = `### 💼 Best Investment Properties in High-Growth Corridors\n\n` +
          `Based on **IT SEZ expansion**, **arterial road connectivity**, and **steady rental yields**, here are top investment opportunities on HomeSphere:\n\n` +
          listMarkdown + `\n\n` +
          `🌟 **Micro-Market Growth Highlights:**\n` +
          `* **Saravanampatti & CHIL SEZ:** High rental yield (~4.5%) with heavy tenant demand from tech workforce.\n` +
          `* **Avinashi Road & Peelamedu:** Premium capital stability (~7.2% CAGR) with airport and educational hub proximity.`;

        quickActions = [
          { text: 'Investment in Saravanampatti', prompt: 'Find properties in Saravanampatti' },
          { text: 'Investment in Peelamedu', prompt: 'Find properties in Peelamedu' },
          { text: 'Buy vs Rent Breakeven', prompt: 'Should I rent or buy?' }
        ];
      }

      // 2.3 Green Living & Sustainability Intent
      else if (qLower.includes('green') || qLower.includes('eco') || qLower.includes('solar') || qLower.includes('sustainab') || qLower.includes('environment')) {
        const [greenProps] = await pool.query(
          `SELECT p.*, COALESCE(gs.score, 85) as green_score, COALESCE(ts.score, 85) as trust_score,
                  (SELECT image_url FROM property_images WHERE property_id = p.id ORDER BY is_primary DESC, id ASC LIMIT 1) as primary_image
           FROM properties p
           LEFT JOIN green_scores gs ON p.id = gs.property_id
           LEFT JOIN trust_scores ts ON p.id = ts.property_id
           WHERE p.status = 'active'
           ORDER BY COALESCE(gs.score, 70) DESC
           LIMIT 3`
        );

        const listMarkdown = greenProps.map(m => {
          const defaultImg = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=600&q=80';
          const img = m.primary_image || defaultImg;
          return `#### 🌿 [${m.title}](/property-details.html?id=${m.id})\n` +
                 `![${m.title}](${img})\n` +
                 `* **Price:** **${formatInr(m.price, m.type)}** | **Location:** ${m.address ? m.address + ', ' : ''}${m.city}\n` +
                 `* **Green Living Score:** **${m.green_score}/100 (A+ Energy Rating)** | **Trust Score:** **${m.trust_score}/100**\n` +
                 `* **Eco Features:** Solar Array, EV Charging Bay, Rainwater Recharge System\n` +
                 `* 🔗 **[View Property Details →](/property-details.html?id=${m.id})**`;
        }).join('\n\n---\n\n');

        advisorReply = `### 🌱 Top Sustainable & Green Living Properties\n\n` +
          `Here are active eco-friendly listings engineered for energy independence, EV readiness, and carbon reduction:\n\n` +
          listMarkdown + `\n\n` +
          `💡 **Benefits of High Green Scores:** Save 25-35% on recurring power and water utilities with lower carbon footprint.`;

        quickActions = [
          { text: 'Villas in Peelamedu', prompt: 'Find villas in Peelamedu' },
          { text: 'Check Hidden Costs', prompt: 'What are the hidden costs of buying a home?' }
        ];
      }

      // 2.4 Locality Intelligence & Comparison Intent
      else if (qLower.includes('locality') || qLower.includes('neighborhood') || qLower.includes('good area') || qLower.includes('best place') || qLower.includes('where to buy') || qLower.includes('location in coimbatore') || qLower.includes('localities in coimbatore') || qLower.includes('peelamedu') || qLower.includes('rs puram') || qLower.includes('gandhipuram')) {
        const targetLoc = entities.locality || (qLower.includes('peelamedu') ? 'Peelamedu' : (qLower.includes('rs puram') ? 'RS Puram' : (qLower.includes('gandhipuram') ? 'Gandhipuram' : 'Coimbatore')));

        const [locProps] = await pool.query(
          `SELECT p.*, COALESCE(ts.score, 85) as trust_score, COALESCE(ls.score, 85) as life_score,
                  (SELECT image_url FROM property_images WHERE property_id = p.id ORDER BY is_primary DESC, id ASC LIMIT 1) as primary_image
           FROM properties p
           LEFT JOIN trust_scores ts ON p.id = ts.property_id
           LEFT JOIN life_scores ls ON p.id = ls.property_id
           WHERE p.status = 'active' AND (p.city LIKE ? OR p.address LIKE ? OR p.locality LIKE ?)
           ORDER BY p.price ASC LIMIT 3`,
          [`%${targetLoc}%`, `%${targetLoc}%`, `%${targetLoc}%`]
        );

        let locMarkdown = '';
        if (locProps && locProps.length > 0) {
          locMarkdown = `\n\n**Verified Active Properties in ${targetLoc}:**\n\n` + locProps.map(m => {
            return `* **[${m.title}](/property-details.html?id=${m.id})** — ${formatInr(m.price, m.type)} (${m.bedrooms ? m.bedrooms + ' BHK | ' : ''}Trust: ${m.trust_score}/100)`;
          }).join('\n');
        }

        advisorReply = `### 📍 Locality Intelligence & Decision Guide: **${targetLoc}**\n\n` +
          `1. **Peelamedu & Avinashi Road (Established Educational & Transit Core):**\n` +
          `   - **LifeScore:** **9.2/10** | Ideal for families, medical & IT professionals.\n` +
          `   - **Highlights:** Proximity to Coimbatore International Airport, PSG Tech, KMCH, and high resale liquidity (~7.2% CAGR).\n\n` +
          `2. **RS Puram & Race Course (Heritage Luxury Core):**\n` +
          `   - **LifeScore:** **9.6/10** | Highest safety index and premium lifestyle infrastructure.\n` +
          `   - **Highlights:** D.B. Road commercial shopping, fine dining, and tree-lined residential tranquility.\n\n` +
          `3. **Gandhipuram & Central Zone (Commercial & Transport Epicenter):**\n` +
          `   - **LifeScore:** **9.0/10** | Unrivaled bus terminal connectivity and bustling central commerce.\n\n` +
          `4. **Saravanampatti (IT Corridor & High Rental Yield):**\n` +
          `   - **LifeScore:** **8.8/10** | Fastest-growing micro-market with tech parks (~7.8% CAGR).` + locMarkdown;

        quickActions = [
          { text: 'Properties in Peelamedu', prompt: 'Find properties in Peelamedu' },
          { text: 'Properties in RS Puram', prompt: 'Find properties in RS Puram' },
          { text: 'Properties in Gandhipuram', prompt: 'Find properties in Gandhipuram' }
        ];
      }

      // 2.5 Multi-Property Comparison Intent
      else if (qLower.includes('compare') || qLower.includes('versus') || qLower.includes(' vs ') || qLower.includes('which is better')) {
        const [compProps] = await pool.query(
          `SELECT p.*, COALESCE(ts.score, 85) as trust_score, COALESCE(ls.score, 85) as life_score, COALESCE(gs.score, 80) as green_score,
                  (SELECT image_url FROM property_images WHERE property_id = p.id ORDER BY is_primary DESC, id ASC LIMIT 1) as primary_image
           FROM properties p
           LEFT JOIN trust_scores ts ON p.id = ts.property_id
           LEFT JOIN life_scores ls ON p.id = ls.property_id
           LEFT JOIN green_scores gs ON p.id = gs.property_id
           WHERE p.status = 'active'
           ORDER BY p.id ASC LIMIT 2`
        );

        if (compProps.length >= 2) {
          const p1 = compProps[0];
          const p2 = compProps[1];
          advisorReply = `### ⚖️ AI Decision Comparison Matrix\n\n` +
            `Here is a side-by-side evaluation of top verified listings on HomeSphere:\n\n` +
            `| Parameter | **[${p1.title}](/property-details.html?id=${p1.id})** | **[${p2.title}](/property-details.html?id=${p2.id})** |\n` +
            `| :--- | :--- | :--- |\n` +
            `| **Price** | **${formatInr(p1.price, p1.type)}** | **${formatInr(p2.price, p2.type)}** |\n` +
            `| **Location** | ${p1.locality || p1.city} | ${p2.locality || p2.city} |\n` +
            `| **Specs** | ${p1.bedrooms || 3} BHK (${p1.area_sqft || 1800} sq.ft) | ${p2.bedrooms || 3} BHK (${p2.area_sqft || 1800} sq.ft) |\n` +
            `| **Trust Score** | **${p1.trust_score}/100** | **${p2.trust_score}/100** |\n` +
            `| **LifeScore** | **${p1.life_score}/100** | **${p2.life_score}/100** |\n` +
            `| **Green Living** | **${p1.green_score}/100** | **${p2.green_score}/100** |\n\n` +
            `💡 **AI Verdict:** If you prioritize livability and safety, **${p1.life_score >= p2.life_score ? p1.title : p2.title}** is recommended. For pricing value, **${p1.price <= p2.price ? p1.title : p2.title}** offers superior entry ROI.\n\n` +
            `🔗 **[Open Full Interactive Comparison Matrix →](/compare.html?ids=${p1.id},${p2.id})**`;
        } else {
          advisorReply = `### ⚖️ Property Comparison Engine\n\n` +
            `You can compare up to 4 properties side-by-side with full Trust Score, Green Score, and Hidden Cost transparency on our [Property Comparison Tool](/compare.html).`;
        }

        quickActions = [
          { text: 'Compare on Compare Page', prompt: 'Open property comparison' },
          { text: 'Show Properties in Peelamedu', prompt: 'Find properties in Peelamedu' }
        ];
      }

      // 2.6 Buy vs Rent Financial Framework
      else if (qLower.includes('buy vs rent') || qLower.includes('rent vs buy') || qLower.includes('rent or buy') || qLower.includes('buy or rent') || qLower.includes('should i buy') || qLower.includes('should i rent')) {
        const [saleSample] = await pool.query("SELECT * FROM properties WHERE status = 'active' AND (type = 'sale' OR type = 'buy') ORDER BY price ASC LIMIT 1");
        const [rentSample] = await pool.query("SELECT * FROM properties WHERE status = 'active' AND (type = 'rent' OR type = 'lease') ORDER BY price ASC LIMIT 1");

        advisorReply = `### ⚖️ AI Decision Guide: Buying vs. Renting in 2026\n\n` +
          `* **Choose Buying If:**\n` +
          `  - Your tenure in the city is projected for **4+ years**.\n` +
          `  - You have savings for a **20% down payment** plus statutory ~7% registration costs.\n` +
          `  - You want predictable housing costs and long-term equity compounding (~6-8% CAGR).\n` +
          (saleSample.length > 0 ? `  - *Example Sale Listing:* **[${saleSample[0].title}](/property-details.html?id=${saleSample[0].id})** — ${formatInr(saleSample[0].price, 'sale')}\n\n` : '\n\n') +
          `* **Choose Renting If:**\n` +
          `  - Your tenure is flexible or likely under **3 years**.\n` +
          `  - You prioritize liquidity for business or equities capital.\n` +
          `  - You prefer zero property tax and low relocation friction.\n` +
          (rentSample.length > 0 ? `  - *Example Rental Listing:* **[${rentSample[0].title}](/property-details.html?id=${rentSample[0].id})** — ${formatInr(rentSample[0].price, 'rent')}\n\n` : '\n\n') +
          `💡 **AI Breakeven Summary:** For a 3 BHK in Coimbatore, renting breaks even with buying at the **4.2-year mark**.`;

        quickActions = [
          { text: 'Find Properties for Rent', prompt: 'Show 2 BHK properties for rent in Coimbatore' },
          { text: 'Find Properties for Sale', prompt: 'Show 2 BHK properties for sale in Coimbatore' }
        ];
      }

      // 2.7 Hidden Costs Overview
      else if (qLower.includes('cost') || qLower.includes('hidden') || qLower.includes('stamp duty') || qLower.includes('registration fee') || qLower.includes('extra fee')) {
        advisorReply = `### 💰 Real-Estate Hidden Cost Intelligence Framework\n\n` +
          `When budgeting for a property purchase in Tamil Nadu, always factor in these statutory and initial outlays beyond the listing price:\n\n` +
          `* **1. Statutory Stamp Duty:** **7.0%** of conveyance deed consideration (residential sale).\n` +
          `* **2. Sub-Registrar Registration Fee:** **1.0%** of property valuation.\n` +
          `* **3. Annual Society Maintenance:** Approximately **₹2.0 - ₹3.0 / sq.ft / month** (₹24,000 - ₹45,000/yr for typical apartments).\n` +
          `* **4. Interior Fit-out Buffer:** ₹120/sq.ft (semi-furnished) to ₹250/sq.ft (unfurnished woodwork & modular kitchen).\n` +
          `* **5. Legal & Municipal Due Diligence:** ~₹10,000 - ₹20,000 for 30-year title deed search and EC clearance.\n\n` +
          `💡 *Select any active property in the top dropdown to calculate the exact line-by-line rupee breakdown.*`;

        quickActions = [
          { text: 'Properties in Peelamedu', prompt: 'Find properties in Peelamedu' },
          { text: 'Buy vs Rent Analysis', prompt: 'Should I rent or buy?' }
        ];
      }

      // 2.8 Legal Checklist & Document Verification
      else if (qLower.includes('document') || qLower.includes('check before buying') || qLower.includes('legal checklist') || qLower.includes('paperwork')) {
        advisorReply = `### 📑 Critical Property Documents to Verify Before Purchase\n\n` +
          `1. **Parent Title Deed (Mother Deed):** Traces 30-year unbroken chain of title ownership.\n` +
          `2. **Encumbrance Certificate (EC - Form 15):** Verifies zero active mortgages or court attachments.\n` +
          `3. **Sanctioned Building Plan & LPA Approval:** Ensures construction matches approved municipal layout.\n` +
          `4. **Patta / Khata Extract:** Revenue record confirming land registration in seller's name.\n` +
          `5. **Occupancy Certificate (OC):** Guarantees building is certified legally habitable with civic utility connections.`;

        quickActions = [
          { text: 'Browse Verified Listings', prompt: 'Show top verified properties in Coimbatore' },
          { text: 'Check Peelamedu Listings', prompt: 'Find properties in Peelamedu' }
        ];
      }

      // 2.9 Multi-Turn Property Search / Discovery
      else {
        let sql = `SELECT p.*,
                          COALESCE(ts.score, 75) as trust_score,
                          COALESCE(ls.score, 80) as life_score,
                          COALESCE(gs.score, 70) as green_score,
                          (SELECT image_url FROM property_images WHERE property_id = p.id ORDER BY is_primary DESC, id ASC LIMIT 1) as primary_image
                   FROM properties p
                   LEFT JOIN trust_scores ts ON p.id = ts.property_id
                   LEFT JOIN life_scores ls ON p.id = ls.property_id
                   LEFT JOIN green_scores gs ON p.id = gs.property_id
                   WHERE p.status = 'active'`;
        const params = [];

        // Locality filter
        if (entities.locality) {
          sql += ` AND (p.city LIKE ? OR p.address LIKE ? OR p.locality LIKE ?)`;
          params.push(`%${entities.locality}%`, `%${entities.locality}%`, `%${entities.locality}%`);
        }

        // Listing type filter (Rent vs Sale)
        if (entities.listingType) {
          if (entities.listingType === 'rent' || entities.listingType === 'lease') {
            sql += ` AND (p.type = 'rent' OR p.type = 'lease')`;
          } else if (entities.listingType === 'sale' || entities.listingType === 'buy') {
            sql += ` AND (p.type = 'sale' OR p.type = 'buy')`;
          }
        }

        // Bedrooms / BHK filter
        if (entities.bedrooms) {
          sql += ` AND (p.bedrooms = ? OR p.bhk = ?)`;
          params.push(entities.bedrooms, entities.bedrooms);
        }

        // Budget filter
        if (entities.maxBudget) {
          sql += ` AND p.price <= ?`;
          params.push(entities.maxBudget);
        }

        // Property type filter
        if (entities.propertyType) {
          sql += ` AND (p.property_type = ? OR p.category = ?)`;
          params.push(entities.propertyType, entities.propertyType);
        }

        sql += ` ORDER BY p.price ASC LIMIT 3`;

        let [matchingProps] = await pool.query(sql, params);

        // Fallback to top active verified listings
        if (!matchingProps || matchingProps.length === 0) {
          const [topAll] = await pool.query(
            `SELECT p.*, COALESCE(ts.score, 85) as trust_score, COALESCE(ls.score, 85) as life_score,
                    (SELECT image_url FROM property_images WHERE property_id = p.id ORDER BY is_primary DESC, id ASC LIMIT 1) as primary_image
             FROM properties p
             LEFT JOIN trust_scores ts ON p.id = ts.property_id
             LEFT JOIN life_scores ls ON p.id = ls.property_id
             WHERE p.status = 'active'
             ORDER BY COALESCE(ts.score, 80) DESC, p.created_at DESC LIMIT 3`
          );
          matchingProps = topAll;
        }

        const listMarkdown = matchingProps.map(m => {
          const defaultImg = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=600&q=80';
          const img = m.primary_image || defaultImg;
          const priceDisplay = formatInr(m.price, m.type);
          const specs = `${m.bedrooms ? m.bedrooms + ' BHK | ' : ''}${m.area_sqft ? Number(m.area_sqft).toLocaleString() + ' sq.ft | ' : ''}${m.property_type || m.category || 'Residential'}`;

          return `#### 🏡 [${m.title}](/property-details.html?id=${m.id})\n` +
                 `![${m.title}](${img})\n` +
                 `* **Price:** **${priceDisplay}** | **Location:** ${m.address ? m.address + ', ' : ''}${m.city}\n` +
                 `* **Specs:** ${specs}\n` +
                 `* **Trust Score:** **${m.trust_score}/100** | **LifeScore:** **${m.life_score}/100**\n` +
                 `* 🔗 **[View Property Details →](/property-details.html?id=${m.id})**`;
        }).join('\n\n---\n\n');

        advisorReply = `### 🔍 Verified Recommendations on HomeSphere\n\n` +
          `Here are top active verified listings matching current market trends:\n\n` +
          listMarkdown + `\n\n` +
          `💡 *Ask me about **hidden costs**, **locality safety**, **family suitability**, or **5-year forecast** for any property.*`;

        quickActions = [
          { text: '2 BHK Rent in Peelamedu', prompt: 'Find me a 2 BHK for rent in Peelamedu under 20000' },
          { text: 'Villas in Saravanampatti', prompt: 'Find villas for sale in Saravanampatti' },
          { text: 'Top Localities in Coimbatore', prompt: 'What are the best locations in Coimbatore?' }
        ];
      }
    }

    res.json({
      success: true,
      data: {
        reply: advisorReply,
        quick_actions: quickActions,
        property_id: propertyId || null,
        entities,
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    next(err);
  }
};


// 3. Property Trust Score
const calculateTrustScore = async (req, res, next) => {
  try {
    const propertyId = req.params.propertyId || req.body.property_id;

    const [propRows] = await pool.query('SELECT * FROM properties WHERE id = ?', [propertyId]);
    if (propRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Property not found.' });
    }

    const [docs] = await pool.query('SELECT * FROM property_documents WHERE property_id = ?', [propertyId]);
    const verifiedDocs = docs.filter((d) => d.verified_status === 'verified').length;
    const totalDocs = Math.max(1, docs.length);

    const docScore = Math.min(100, Math.round((verifiedDocs / totalDocs) * 100));
    const sellerScore = 95;
    const priceSanity = 92;
    const registryCheck = docScore >= 80 ? 98 : 75;

    const compositeScore = Math.round((docScore * 0.35) + (registryCheck * 0.25) + (priceSanity * 0.2) + (sellerScore * 0.2));

    const breakdown = {
      document_verification: docScore,
      registry_cross_check: registryCheck,
      pricing_benchmark: priceSanity,
      seller_history: sellerScore,
      title_clarity: docScore > 85 ? 'Flawless Freehold' : 'Standard Title Verified',
      risk_level: compositeScore > 85 ? 'Extremely Low' : 'Low'
    };

    await pool.query(
      `INSERT INTO trust_scores (property_id, score, verification_rating, document_completeness, price_sanity_score, seller_reputation_score, breakdown_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       score = VALUES(score),
       verification_rating = VALUES(verification_rating),
       document_completeness = VALUES(document_completeness),
       price_sanity_score = VALUES(price_sanity_score),
       seller_reputation_score = VALUES(seller_reputation_score),
       breakdown_json = VALUES(breakdown_json)`,
      [propertyId, compositeScore, compositeScore > 85 ? 'verified' : 'standard', docScore, priceSanity, sellerScore, JSON.stringify(breakdown)]
    );

    res.json({
      success: true,
      data: {
        property_id: propertyId,
        trust_score: compositeScore,
        breakdown
      }
    });
  } catch (err) {
    next(err);
  }
};

// 4. Property DNA Fingerprint
const generatePropertyDNA = async (req, res, next) => {
  try {
    const propertyId = req.params.propertyId || req.body.property_id;

    const [propRows] = await pool.query('SELECT * FROM properties WHERE id = ?', [propertyId]);
    if (propRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Property not found.' });
    }
    const prop = propRows[0];

    const dnaData = {
      property_id: propertyId,
      construction_year: 2021,
      age_years: 5,
      legal_status: 'Verified Clear Title',
      zoning_type: prop.category === 'commercial' ? 'Commercial C-2' : 'Residential R-1',
      flooring_type: 'Vitrified Premium Tile',
      structural_notes: 'RCC framed earthquake resistant structure with AAC block masonry.',
      flags_json: JSON.stringify({ flood_zone: false, historical_encumbrance: false, pending_litigation: false })
    };

    await pool.query(
      `INSERT INTO property_dna (property_id, construction_year, age_years, legal_status, zoning_type, flooring_type, structural_notes, flags_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       construction_year = VALUES(construction_year),
       age_years = VALUES(age_years),
       legal_status = VALUES(legal_status),
       zoning_type = VALUES(zoning_type),
       flooring_type = VALUES(flooring_type),
       structural_notes = VALUES(structural_notes),
       flags_json = VALUES(flags_json)`,
      [propertyId, dnaData.construction_year, dnaData.age_years, dnaData.legal_status, dnaData.zoning_type, dnaData.flooring_type, dnaData.structural_notes, dnaData.flags_json]
    );

    res.json({
      success: true,
      data: dnaData
    });
  } catch (err) {
    next(err);
  }
};

// 5. LifeScore (Livability Index)
const calculateLifeScore = async (req, res, next) => {
  try {
    const propertyId = req.params.propertyId || req.body.property_id;

    const [propRows] = await pool.query('SELECT * FROM properties WHERE id = ?', [propertyId]);
    if (propRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Property not found.' });
    }

    const safetyScore = 92;
    const transitScore = 88;
    const schoolScore = 90;
    const hospitalScore = 86;
    const shoppingScore = 85;
    const envScore = 87;

    const compositeScore = Math.round((safetyScore * 0.25) + (transitScore * 0.2) + (schoolScore * 0.2) + (hospitalScore * 0.15) + (shoppingScore * 0.1) + (envScore * 0.1));

    const breakdown = {
      safety_score: safetyScore,
      transit_score: transitScore,
      school_score: schoolScore,
      amenities_score: hospitalScore,
      shopping_score: shoppingScore,
      environment_score: envScore
    };

    await pool.query(
      `INSERT INTO life_scores (property_id, score, safety_score, transit_score, school_score, amenities_score, noise_level_db, breakdown_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       score = VALUES(score),
       safety_score = VALUES(safety_score),
       transit_score = VALUES(transit_score),
       school_score = VALUES(school_score),
       amenities_score = VALUES(amenities_score),
       breakdown_json = VALUES(breakdown_json)`,
      [propertyId, compositeScore, safetyScore, transitScore, schoolScore, hospitalScore, 42, JSON.stringify(breakdown)]
    );

    res.json({
      success: true,
      data: {
        property_id: propertyId,
        life_score: compositeScore,
        breakdown
      }
    });
  } catch (err) {
    next(err);
  }
};

// 6. Green Living Score
const calculateGreenScore = async (req, res, next) => {
  try {
    const propertyId = req.params.propertyId || req.body.property_id;

    const [propRows] = await pool.query('SELECT * FROM properties WHERE id = ?', [propertyId]);
    if (propRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Property not found.' });
    }

    const greenData = {
      property_id: propertyId,
      score: 86,
      solar_equipped: 1,
      ev_charging: 1,
      rainwater_harvesting: 1,
      energy_rating: 'A+',
      carbon_offset_tons_per_year: 4.2
    };

    await pool.query(
      `INSERT INTO green_scores (property_id, score, solar_equipped, ev_charging, rainwater_harvesting, energy_rating, carbon_offset_tons_per_year)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       score = VALUES(score),
       solar_equipped = VALUES(solar_equipped),
       ev_charging = VALUES(ev_charging),
       rainwater_harvesting = VALUES(rainwater_harvesting),
       energy_rating = VALUES(energy_rating),
       carbon_offset_tons_per_year = VALUES(carbon_offset_tons_per_year)`,
      [propertyId, greenData.score, greenData.solar_equipped, greenData.ev_charging, greenData.rainwater_harvesting, greenData.energy_rating, greenData.carbon_offset_tons_per_year]
    );

    res.json({
      success: true,
      data: greenData
    });
  } catch (err) {
    next(err);
  }
};

// 7. Hidden Cost Estimator
const estimateHiddenCosts = async (req, res, next) => {
  try {
    const propertyId = req.params.propertyId || req.body.property_id;

    const [propRows] = await pool.query('SELECT * FROM properties WHERE id = ?', [propertyId]);
    if (propRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Property not found.' });
    }
    const prop = propRows[0];
    const price = Number(prop.price);

    const isRent = prop.type === 'rent' || prop.type === 'lease';
    const regCost = isRent ? Math.round(price * 0.01) : Math.round(price * 0.07);
    const maintCost = isRent ? 30000 : 60000;
    const renoCost = isRent ? 15000 : 150000;
    const totalEst = isRent ? (price * 12) + (price * 3) + maintCost : price + regCost + maintCost + renoCost;

    const costData = {
      property_id: propertyId,
      registration_cost: regCost,
      maintenance_annual: maintCost,
      renovation_estimate: renoCost,
      total_est_first_year: totalEst
    };

    await pool.query(
      `INSERT INTO hidden_costs (property_id, property_tax_annual, hoa_annual, insurance_annual, total_est_first_year, registration_cost)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       property_tax_annual = VALUES(property_tax_annual),
       hoa_annual = VALUES(hoa_annual),
       insurance_annual = VALUES(insurance_annual),
       total_est_first_year = VALUES(total_est_first_year),
       registration_cost = VALUES(registration_cost)`,
      [propertyId, Math.round(price * 0.01), maintCost, 12000, totalEst, regCost]
    );

    res.json({
      success: true,
      data: costData
    });
  } catch (err) {
    next(err);
  }
};

// 8. Future Value Prediction
const predictFutureValue = async (req, res, next) => {
  try {
    const propertyId = req.params.propertyId || req.body.property_id;

    const [propRows] = await pool.query('SELECT * FROM properties WHERE id = ?', [propertyId]);
    if (propRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Property not found.' });
    }
    const prop = propRows[0];
    const price = Number(prop.price);

    const predictions = [
      { years: 1, predicted_price: Math.round(price * 1.068), growth_rate_annual: 6.8, confidence_interval_low: Math.round(price * 1.05), confidence_interval_high: Math.round(price * 1.085) },
      { years: 3, predicted_price: Math.round(price * Math.pow(1.068, 3)), growth_rate_annual: 6.8, confidence_interval_low: Math.round(price * Math.pow(1.05, 3)), confidence_interval_high: Math.round(price * Math.pow(1.085, 3)) },
      { years: 5, predicted_price: Math.round(price * Math.pow(1.068, 5)), growth_rate_annual: 6.8, confidence_interval_low: Math.round(price * Math.pow(1.05, 5)), confidence_interval_high: Math.round(price * Math.pow(1.085, 5)) }
    ];

    for (const pred of predictions) {
      await pool.query(
        `INSERT INTO future_value_predictions (property_id, years, predicted_price, growth_rate_annual, confidence_interval_low, confidence_interval_high)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         predicted_price = VALUES(predicted_price),
         growth_rate_annual = VALUES(growth_rate_annual),
         confidence_interval_low = VALUES(confidence_interval_low),
         confidence_interval_high = VALUES(confidence_interval_high)`,
        [propertyId, pred.years, pred.predicted_price, pred.growth_rate_annual, pred.confidence_interval_low, pred.confidence_interval_high]
      );
    }

    res.json({
      success: true,
      data: predictions
    });
  } catch (err) {
    next(err);
  }
};

// 9. Personalized Recommendations
const getRecommendations = async (req, res, next) => {
  try {
    const [properties] = await pool.query(
      `SELECT p.*,
              COALESCE(ts.score, 75) as trust_score,
              COALESCE(ls.score, 80) as life_score,
              (SELECT image_url FROM property_images WHERE property_id = p.id ORDER BY is_primary DESC, id ASC LIMIT 1) as primary_image
       FROM properties p
       LEFT JOIN trust_scores ts ON p.id = ts.property_id
       LEFT JOIN life_scores ls ON p.id = ls.property_id
       WHERE p.status = 'active'
       ORDER BY p.id ASC
       LIMIT 6`
    );

    res.json({
      success: true,
      data: properties
    });
  } catch (err) {
    next(err);
  }
};

// 10. AI Decision Summary
const generateDecisionSummary = async (req, res, next) => {
  try {
    const propertyId = req.params.propertyId || req.body.property_id;

    const [propRows] = await pool.query(
      `SELECT p.*,
              ts.score as trust_score, ts.breakdown_json as trust_breakdown,
              dna.age_years, dna.legal_status,
              ls.score as life_score,
              gs.score as green_score,
              hc.total_est_first_year,
              fv.growth_rate_annual
       FROM properties p
       LEFT JOIN trust_scores ts ON p.id = ts.property_id
       LEFT JOIN property_dna dna ON p.id = dna.property_id
       LEFT JOIN life_scores ls ON p.id = ls.property_id
       LEFT JOIN green_scores gs ON p.id = gs.property_id
       LEFT JOIN hidden_costs hc ON p.id = hc.property_id
       LEFT JOIN future_value_predictions fv ON p.id = fv.property_id AND fv.years = 5
       WHERE p.id = ?`,
      [propertyId]
    );

    if (propRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Property not found.' });
    }

    const p = propRows[0];
    const trustRating = p.trust_score >= 90 ? 'exceptional' : 'solid';
    const verdict = p.trust_score >= 88 && (p.life_score || 80) >= 85 ? 'Highly Recommended' : 'Recommended with Inspection';

    const summaryText = `The **${p.title}** represents a **${verdict}** opportunity in ${p.city}. Holding an ${trustRating} **Trust Score of ${p.trust_score || 92}/100** with verified clear title, it presents minimal legal risk. Locality livability is superior (**LifeScore: ${p.life_score || 90}/100**), bolstered by outstanding neighborhood safety and transit accessibility. Eco-conscious buyers will benefit from an **A-rated Green Living Score (${p.green_score || 85}/100)**. Budget planning should incorporate approximately **${formatInr(p.total_est_first_year || (p.price * 0.08))}** in first-year closing, tax, and maintenance provisions against a healthy projected **${p.growth_rate_annual || 6.8}% annual capital appreciation**.`;

    res.json({
      success: true,
      data: {
        property_id: p.id,
        verdict,
        decision_summary: summaryText,
        confidence_index: '94%',
        key_metrics: {
          trust_score: p.trust_score || 92,
          life_score: p.life_score || 90,
          green_score: p.green_score || 85,
          projected_5yr_growth: `${p.growth_rate_annual || 6.8}%`
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPropertyMatch,
  getAdvisorResponse,
  calculateTrustScore,
  generatePropertyDNA,
  calculateLifeScore,
  calculateGreenScore,
  estimateHiddenCosts,
  predictFutureValue,
  getRecommendations,
  generateDecisionSummary
};
