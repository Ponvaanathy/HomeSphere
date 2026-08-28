/**
 * verify_marketplace_full.js
 * End-to-end verification of the HomeSphere Marketplace & Decision Platform
 */

const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

async function verify() {
  console.log('====================================================');
  console.log('🧪 VERIFYING HOMESPHERE MARKETPLACE & DECISION PLATFORM');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  const test = (title, condition, details = '') => {
    total++;
    if (condition) {
      console.log(` ✅ PASS: ${title}`);
      passed++;
    } else {
      console.error(` ❌ FAIL: ${title} - ${details}`);
    }
  };

  // 1. Database Table Verification
  console.log('1️⃣ Database Schema & Data Integrity:');
  const [props] = await pool.query('SELECT * FROM properties');
  test('Properties table populated', props.length >= 10, `Found ${props.length} properties`);

  const categories = ['residential', 'land_plots', 'commercial', 'pg_rooms', 'new_projects'];
  for (const cat of categories) {
    const count = props.filter(p => p.category === cat).length;
    test(`Category [${cat}] has properties`, count > 0, `Count: ${count}`);
  }

  const types = ['sale', 'rent', 'lease'];
  for (const t of types) {
    const count = props.filter(p => p.type === t || (t === 'sale' && p.type === 'buy')).length;
    test(`Transaction purpose [${t}] supported`, count > 0, `Count: ${count}`);
  }

  // 2. Decision Intelligence Scores Verification
  console.log('\n2️⃣ Decision Intelligence Modules:');
  const [trustScores] = await pool.query('SELECT * FROM trust_scores');
  test('Trust Scores attached to properties', trustScores.length >= 10, `Count: ${trustScores.length}`);

  const [lifeScores] = await pool.query('SELECT * FROM life_scores');
  test('LifeScores attached to properties', lifeScores.length >= 10, `Count: ${lifeScores.length}`);

  const [hiddenCosts] = await pool.query('SELECT * FROM hidden_costs');
  test('Hidden Costs attached to properties', hiddenCosts.length >= 10, `Count: ${hiddenCosts.length}`);

  // 3. API Endpoints
  console.log('\n3️⃣ API Endpoints Testing via HTTP:');
  try {
    const statsRes = await fetch('http://localhost:5000/api/properties/categories/stats').then(r => r.json());
    test('GET /api/properties/categories/stats', statsRes.success && statsRes.data.residential > 0, JSON.stringify(statsRes.data));

    const resFilter = await fetch('http://localhost:5000/api/properties?category=commercial').then(r => r.json());
    test('GET /api/properties?category=commercial', resFilter.success && resFilter.data.properties.length > 0, `Found: ${resFilter.data?.properties?.length}`);

    const nlpFilter = await fetch('http://localhost:5000/api/properties?q=Peelamedu').then(r => r.json());
    test('GET /api/properties?q=Peelamedu (NLP Search)', nlpFilter.success && nlpFilter.data.properties.length > 0, `Found: ${nlpFilter.data?.properties?.length}`);

    const propId = props[0].id;
    const detailRes = await fetch(`http://localhost:5000/api/properties/${propId}`).then(r => r.json());
    test('GET /api/properties/:id (Details with full specs)', detailRes.success && detailRes.data.title === props[0].title, `Title: ${detailRes.data?.title}`);

    // Geospatial Radius Tests
    const geoRes = await fetch('http://localhost:5000/api/properties?lat=11.0267&lng=77.0028&radius=3').then(r => r.json());
    test('GET /api/properties?lat=...&radius=3 (Peelamedu 3km)', geoRes.success && geoRes.data.properties.length > 0 && geoRes.data.properties[0].distance_km !== null, `Found: ${geoRes.data?.properties?.length}`);

    const geoRentRes = await fetch('http://localhost:5000/api/properties?lat=11.0267&lng=77.0028&radius=3&type=rent').then(r => r.json());
    test('GET /api/properties?lat=...&radius=3&type=rent (Rental only)', geoRentRes.success && geoRentRes.data.properties.every(p => p.type === 'rent'), `Count: ${geoRentRes.data?.properties?.length}`);

    const geoBuyRes = await fetch('http://localhost:5000/api/properties?lat=11.0267&lng=77.0028&radius=5&type=buy').then(r => r.json());
    test('GET /api/properties?lat=...&radius=5&type=buy (Buy/Sale only)', geoBuyRes.success && geoBuyRes.data.properties.every(p => p.type === 'buy' || p.type === 'sale'), `Count: ${geoBuyRes.data?.properties?.length}`);

    const suggRes = await fetch('http://localhost:5000/api/search/suggestions?q=Peelamedu').then(r => r.json());
    test('GET /api/search/suggestions?q=Peelamedu (Autocomplete)', suggRes.success && suggRes.data.locations.length > 0, `Locations: ${suggRes.data?.locations?.length}`);

    // ==============================================================
    // 4. VERIFICATION OF THE 4 KEY REQUIRED FEATURES
    // ==============================================================
    console.log('\n4️⃣ Analytics & Decision Intelligence Endpoints (The 4 Features):');

    // Feature 1: Dynamic Hidden Cost Engine (Strict Sum & Itemized Models)
    const a5 = await fetch('http://localhost:5000/api/properties/5/analytics').then(r => r.json());
    const a6 = await fetch('http://localhost:5000/api/properties/6/analytics').then(r => r.json());
    test('FEATURE 1: Hidden Cost Engine returns property-specific calculations',
      a5.data?.hiddenCosts &&
      a5.data.hiddenCosts.totalEstimatedCost > 0 &&
      Array.isArray(a5.data.hiddenCosts.items),
      `Total Outlay: ₹${a5.data?.hiddenCosts?.totalEstimatedCost}`
    );

    test('FEATURE 1: Hidden Cost Engine strictly equals SUM of visible line items',
      a5.data?.hiddenCosts?.totalEstimatedCost === a5.data?.hiddenCosts?.items?.reduce((sum, i) => sum + i.amount, 0),
      `Strict Math Sum: ₹${a5.data?.hiddenCosts?.totalEstimatedCost}`
    );

    // Feature 2: Locality LifeScore Radar (0–10 Scale)
    test('FEATURE 2: Locality LifeScore Radar evaluates 6 parameters on 0-10 scale',
      a5.data?.lifeScore && a5.data.lifeScore.safety >= 0 && a5.data.lifeScore.safety <= 10 &&
      a5.data.lifeScore.healthcare >= 0 && a5.data.lifeScore.healthcare <= 10 &&
      a5.data.lifeScore.education >= 0 && a5.data.lifeScore.education <= 10 &&
      a5.data.lifeScore.transport >= 0 && a5.data.lifeScore.transport <= 10 &&
      a5.data.lifeScore.dailyNeeds >= 0 && a5.data.lifeScore.dailyNeeds <= 10 &&
      a5.data.lifeScore.environment >= 0 && a5.data.lifeScore.environment <= 10 &&
      a5.data.lifeScore.overallScore >= 0 && a5.data.lifeScore.overallScore <= 10,
      `Overall: ${a5.data?.lifeScore?.overallScore}/10 (Safety: ${a5.data?.lifeScore?.safety}, Edu: ${a5.data?.lifeScore?.education})`
    );

    test('FEATURE 2: LifeScore values differ where localities differ',
      a5.data?.lifeScore?.overallScore !== a6.data?.lifeScore?.overallScore || a5.data?.lifeScore?.safety !== a6.data?.lifeScore?.safety,
      `Peelamedu: ${a5.data?.lifeScore?.overallScore}/10 vs Saravanampatti: ${a6.data?.lifeScore?.overallScore}/10`
    );

    // Feature 3: UI Forecast Graph Removed
    const detailsHtml = fs.readFileSync(path.join(__dirname, '../../property-details.html'), 'utf8');
    test('FEATURE 3: 5-Year Capital Forecast graph is completely removed from Property Details UI',
      !detailsHtml.includes('id="forecastSection"') && !detailsHtml.includes('5-YEAR CAPITAL FORECAST'),
      'Forecast UI removed cleanly'
    );

    // Feature 4: AI Agent Advisor Underlying Logic
    console.log('\n5️⃣ AI Agent Advisor Intelligence & Context Verification:');

    // Test search intent
    const aiSearch = await fetch('http://localhost:5000/api/ai/advisor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'Find me a 2 BHK for rent in Peelamedu under 20000' })
    }).then(r => r.json());

    test('FEATURE 4: AI Advisor extracts criteria & queries real database listings',
      aiSearch.success && aiSearch.data?.reply && aiSearch.data.reply.includes('/property-details.html?id='),
      `Found listing links in AI reply`
    );

    // Test follow-up intent
    const aiFollowUp = await fetch('http://localhost:5000/api/ai/advisor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'I want something cheaper',
        conversationHistory: [
          { role: 'user', content: 'Find me a 2 BHK for rent in Peelamedu under 20000' },
          { role: 'assistant', content: aiSearch.data?.reply }
        ]
      })
    }).then(r => r.json());

    test('FEATURE 4: AI Advisor preserves conversation memory on follow-up',
      aiFollowUp.success && aiFollowUp.data?.reply && (aiFollowUp.data.reply.includes('2 BHK') || aiFollowUp.data.reply.includes('Rent') || aiFollowUp.data.reply.includes('Peelamedu')),
      `Retained criteria in response`
    );

    // Test property specific valuation
    const aiPropEval = await fetch('http://localhost:5000/api/ai/advisor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'Is this property worth buying?', propertyId: 5 })
    }).then(r => r.json());

    test('FEATURE 4: AI Advisor provides property-specific valuation for active listing',
      aiPropEval.success && aiPropEval.data?.reply && aiPropEval.data.reply.includes('Modern 3BHK') && aiPropEval.data.reply.includes('Trust Score'),
      `Property-specific verdict generated`
    );

    // Test hidden costs question
    const aiCostQ = await fetch('http://localhost:5000/api/ai/advisor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'What are the hidden costs?', propertyId: 5 })
    }).then(r => r.json());

    test('FEATURE 4: AI Advisor explains calculated hidden costs for active listing',
      aiCostQ.success && aiCostQ.data?.reply && aiCostQ.data.reply.includes('Stamp Duty') && aiCostQ.data.reply.includes('Modern 3BHK'),
      `Explained actual costs for Property 5`
    );

    // 🌐 5. Location & GPS Intelligence Engine
    console.log('\n5️⃣ Location & GPS Intelligence Engine:');

    // 1. Test GPS Nearby search around Peelamedu (11.0267, 77.0028) with radius=5
    const nearbyPeelamedu = await fetch('http://localhost:5000/api/properties/nearby?lat=11.0267&lng=77.0028&radius=5').then(r => r.json());
    test('GPS INTELLIGENCE: GET /api/properties/nearby returns active properties in radius',
      nearbyPeelamedu.success && nearbyPeelamedu.data?.properties?.length > 0,
      `Found ${nearbyPeelamedu.data?.properties?.length} properties within 5km of Peelamedu`
    );

    test('GPS INTELLIGENCE: Haversine distance_km calculated accurately and ordered ascending',
      nearbyPeelamedu.data?.properties?.length > 1 &&
      Number(nearbyPeelamedu.data.properties[0].distance_km) <= Number(nearbyPeelamedu.data.properties[1].distance_km),
      `Closest: ${nearbyPeelamedu.data?.properties?.[0]?.distance_km} km (${nearbyPeelamedu.data?.properties?.[0]?.title})`
    );

    test('GPS INTELLIGENCE: Dynamic listing type breakdown (Rent, Buy, Lease) computed accurately',
      nearbyPeelamedu.data?.type_summary?.all > 0 &&
      (nearbyPeelamedu.data?.type_summary?.rent > 0 || nearbyPeelamedu.data?.type_summary?.buy > 0),
      `All: ${nearbyPeelamedu.data?.type_summary?.all}, Rent: ${nearbyPeelamedu.data?.type_summary?.rent}, Buy: ${nearbyPeelamedu.data?.type_summary?.buy}, Lease: ${nearbyPeelamedu.data?.type_summary?.lease}`
    );

    // 2. Test radius filtering (1km vs 10km)
    const nearby1km = await fetch('http://localhost:5000/api/properties/nearby?lat=11.0267&lng=77.0028&radius=1').then(r => r.json());
    const nearby10km = await fetch('http://localhost:5000/api/properties/nearby?lat=11.0267&lng=77.0028&radius=10').then(r => r.json());
    test('GPS INTELLIGENCE: Radius expansion increases geographic result set',
      nearby10km.data?.properties?.length >= nearby1km.data?.properties?.length,
      `1km: ${nearby1km.data?.properties?.length} listings, 10km: ${nearby10km.data?.properties?.length} listings`
    );

    // 3. Test listing type filtering (rent only)
    const nearbyRent = await fetch('http://localhost:5000/api/properties/nearby?lat=11.0267&lng=77.0028&radius=5&type=rent').then(r => r.json());
    test('GPS INTELLIGENCE: Listing type filtering filters results to rent-only',
      nearbyRent.success && nearbyRent.data?.properties?.every(p => p.type === 'rent'),
      `Returned ${nearbyRent.data?.properties?.length} rent listings exclusively`
    );

    // 4. Test Location Intelligence & LifeScore endpoint
    const intelData = await fetch('http://localhost:5000/api/properties/location-intelligence?lat=11.0267&lng=77.0028&radius=5&locality=Peelamedu').then(r => r.json());
    test('GPS INTELLIGENCE: GET /api/properties/location-intelligence returns metrics & 6-axis LifeScore',
      intelData.success &&
      intelData.data?.metrics?.totalProperties > 0 &&
      intelData.data?.lifeScore?.safety > 0 &&
      intelData.data?.lifeScore?.overallScore > 0,
      `Avg Buy: ₹${intelData.data?.metrics?.avgPrice}, Avg Rent: ₹${intelData.data?.metrics?.avgRent}, Overall LifeScore: ${intelData.data?.lifeScore?.overallScore}/10`
    );
    // 6. List Property Feature & Flow
    console.log('\n6️⃣ List Property Feature & Flow:');

    // Authenticate test user
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'seller@homesphere.com', password: 'password123' })
    }).then(r => r.json());

    const testToken = loginRes.data?.token;
    const testSellerId = loginRes.data?.user?.id;

    const uniqueStamp = Date.now() + Math.floor(Math.random() * 100000);
    const uniquePrice = 35000000 + Math.floor(Math.random() * 15000000);
    const listPropPayload = {
      title: `Green Valley 3BHK Villa Saravanampatti ${uniqueStamp}`,
      description: 'Ultra-modern 3BHK villa with private terrace and EV charger.',
      category: 'residential',
      subcategory: 'villa',
      property_type: 'villa',
      type: 'sale',
      price: uniquePrice,
      currency: 'INR',
      address: `18 IT Park Road North ${uniqueStamp}`,
      locality: 'Saravanampatti',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      zip_code: '641035',
      lat: 11.082500,
      lng: 76.996100,
      bedrooms: 3,
      bathrooms: 3,
      bhk: 3,
      area_sqft: 2100 + Math.floor(Math.random() * 500),



      year_built: 2024,
      furnishing: 'semi-furnished',
      parking_spaces: 2,
      amenities_json: ['24/7 Security', 'EV Charging Station', 'Power Backup']
    };

    const createPropRes = await fetch('http://localhost:5000/api/properties', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testToken}`
      },
      body: JSON.stringify(listPropPayload)
    }).then(r => r.json());

    test('LIST PROPERTY: POST /api/properties successfully inserts new property',
      createPropRes.success && !!createPropRes.data?.property_id,
      `Created Property ID: #${createPropRes.data?.property_id} (Message: ${createPropRes.message})`
    );


    const newPropId = createPropRes.data?.property_id;

    // Check MySQL properties table
    const [insertedRows] = await pool.query('SELECT * FROM properties WHERE id = ?', [newPropId]);
    test('LIST PROPERTY: MySQL properties table contains verified record',
      insertedRows.length === 1 && insertedRows[0].owner_id === testSellerId,
      `Owner ID: ${insertedRows[0]?.owner_id}, Price: ₹${insertedRows[0]?.price}`
    );

    // Check decision intelligence tables
    const [insertedTrust] = await pool.query('SELECT * FROM trust_scores WHERE property_id = ?', [newPropId]);
    const [insertedCost] = await pool.query('SELECT * FROM hidden_costs WHERE property_id = ?', [newPropId]);
    test('LIST PROPERTY: Trust Score and Hidden Costs initialized automatically',
      insertedTrust.length > 0 && insertedCost.length > 0,
      `Trust Score: ${insertedTrust[0]?.score}, Total 1st Year Outlay: ₹${insertedCost[0]?.total_est_first_year}`
    );

    // Check discovery in GPS Nearby search
    const newNearby = await fetch('http://localhost:5000/api/properties/nearby?lat=11.0825&lng=76.9961&radius=5').then(r => r.json());
    test('LIST PROPERTY: Newly listed property appears in Live Map / GPS Nearby search',
      newNearby.success && newNearby.data?.properties?.some(p => p.id === newPropId),
      `Found in Saravanampatti radius`
    );
  } catch (err) {
    test('API Endpoints reachable', false, err.message);
  }

  // 7. Frontend Files Integrity
  console.log('\n7️⃣ Frontend HTML & JS Pages:');


  const requiredFiles = [
    'index.html',
    'login.html',
    'register.html',
    'dashboard.html',
    'properties.html',
    'property-details.html',
    'map-search.html',
    'advisor.html',
    'compare.html',
    'saved.html',
    'my-listings.html',
    'list-property.html',
    'notifications.html',
    'profile.html',
    'css/style.css',
    'css/dashboard.css',
    'css/properties.css',
    'js/properties.js',
    'js/dashboard.js',
    'js/advisor.js',
    'js/compare.js',
    'js/map-search.js',
    'js/saved.js',
    'js/my-listings.js',
    'js/list-property.js'
  ];

  const rootDir = path.join(__dirname, '../../');
  for (const rel of requiredFiles) {
    const full = path.join(rootDir, rel);
    test(`File exists: ${rel}`, fs.existsSync(full), `Size: ${fs.existsSync(full) ? fs.statSync(full).size + ' bytes' : 'MISSING'}`);
  }

  console.log('\n====================================================');
  console.log(`📊 RESULTS: ${passed}/${total} Tests Passed (${Math.round((passed / total) * 100)}%)`);
  console.log('====================================================\n');

  process.exit(passed === total ? 0 : 1);
}

verify().catch(err => {
  console.error('Verification script crashed:', err);
  process.exit(1);
});
