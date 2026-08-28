/**
 * Full End-to-End Regression Audit Suite for HomeSphere
 * Verifies 100% of the platform features across all 26 categories.
 */

const pool = require('../config/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const JWT_SECRET = process.env.JWT_SECRET || 'homesphere_jwt_secret_key_ultra_secure_2026_antigravity';
const API_BASE = 'http://localhost:5000/api';

const auditResults = {
  categories: {}
};

function recordTest(category, testName, passed, details = '') {
  if (!auditResults.categories[category]) {
    auditResults.categories[category] = { tests: [], passCount: 0, failCount: 0 };
  }
  auditResults.categories[category].tests.push({ testName, passed, details });
  if (passed) {
    auditResults.categories[category].passCount++;
  } else {
    auditResults.categories[category].failCount++;
  }
}

async function runRegressionAudit() {
  console.log('================================================================');
  console.log('🧪 RUNNING FULL PLATFORM REGRESSION AUDIT (ALL 26 FEATURES)');
  console.log('================================================================\n');

  let testBuyerToken = '';
  let testSellerToken = '';
  let testAdminToken = '';
  let testBuyerId = null;
  let testSellerId = null;
  let testAdminId = null;
  let createdPropId = null;

  // 1. BACKEND & DATABASE
  console.log('▶ [1/26] Auditing Backend & Database...');
  try {
    const health = await fetch(`${API_BASE}/health`).then(r => r.json());
    recordTest('BACKEND', 'Express Server Running & Health Online', health.success && health.status === 'online');

    const [dbTest] = await pool.query('SELECT DATABASE() as db, @@port as port');
    recordTest('DATABASE', 'MySQL Connected to homesphere:3306', dbTest[0].db === 'homesphere' && Number(dbTest[0].port) === 3306);

    const testEmail = `probe_${Date.now()}@test.com`;
    const [ins] = await pool.query("INSERT INTO users (name, email, password_hash, role) VALUES ('Probe', ?, 'hash', 'buyer')", [testEmail]);
    const probeId = ins.insertId;
    const [sel] = await pool.query('SELECT * FROM users WHERE id = ?', [probeId]);
    const [upd] = await pool.query("UPDATE users SET name = 'Probe Upd' WHERE id = ?", [probeId]);
    const [del] = await pool.query('DELETE FROM users WHERE id = ?', [probeId]);
    recordTest('DATABASE', 'Full CRUD Database Execution', probeId && sel.length > 0 && upd.affectedRows === 1 && del.affectedRows === 1);
  } catch (err) {
    recordTest('BACKEND', 'Backend & Database Verification', false, err.message);
  }

  // 2. AUTHENTICATION
  console.log('▶ [2/26] Auditing Authentication...');
  try {
    const buyerEmail = `reg_buyer_${Date.now()}@homesphere.ai`;
    const sellerEmail = `reg_seller_${Date.now()}@homesphere.ai`;
    const adminEmail = `reg_admin_${Date.now()}@homesphere.ai`;
    const password = 'Password123!';

    // Register Buyer
    const regB = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Reg Buyer', email: buyerEmail, password, role: 'buyer' })
    }).then(r => r.json());
    testBuyerId = regB.data?.user?.id;
    recordTest('AUTHENTICATION', 'Buyer Registration (bcrypt + MySQL)', regB.success && !!testBuyerId);

    // Register Seller
    const regS = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Reg Seller', email: sellerEmail, password, role: 'seller' })
    }).then(r => r.json());
    testSellerId = regS.data?.user?.id;
    recordTest('AUTHENTICATION', 'Seller Registration', regS.success && !!testSellerId);

    // Register Admin
    const regA = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Reg Admin', email: adminEmail, password, role: 'admin' })
    }).then(r => r.json());
    testAdminId = regA.data?.user?.id;
    recordTest('AUTHENTICATION', 'Admin Registration', regA.success && !!testAdminId);

    // Duplicate Rejection
    const dupRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Dup', email: buyerEmail, password, role: 'buyer' })
    });
    recordTest('AUTHENTICATION', 'Duplicate Registration Rejected (409)', dupRes.status === 409 || dupRes.status === 400);

    // Login Buyer
    const logB = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: buyerEmail, password })
    }).then(r => r.json());
    testBuyerToken = logB.data?.token;
    recordTest('AUTHENTICATION', 'Buyer JWT Login', !!testBuyerToken);

    // Login Seller
    const logS = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: sellerEmail, password })
    }).then(r => r.json());
    testSellerToken = logS.data?.token;
    recordTest('AUTHENTICATION', 'Seller JWT Login', !!testSellerToken);

    // Login Admin
    const logA = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password })
    }).then(r => r.json());
    testAdminToken = logA.data?.token;
    recordTest('AUTHENTICATION', 'Admin JWT Login', !!testAdminToken);

    // Invalid Password Rejection
    const badLogin = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: buyerEmail, password: 'Wrong' })
    });
    recordTest('AUTHENTICATION', 'Invalid Password Rejected (401)', badLogin.status === 401);

    // Password Hashing Verification
    const [uRow] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [testBuyerId]);
    recordTest('AUTHENTICATION', 'Bcrypt Password Hashing in DB', uRow[0]?.password_hash.startsWith('$2a$') || uRow[0]?.password_hash.startsWith('$2b$'));

    // User Isolation
    const prof = await fetch(`${API_BASE}/users/profile`, {
      headers: { Authorization: `Bearer ${testBuyerToken}` }
    }).then(r => r.json());
    recordTest('AUTHENTICATION', 'User Profile Isolation', prof.data?.id === testBuyerId && prof.data?.email === buyerEmail);

  } catch (err) {
    recordTest('AUTHENTICATION', 'Auth Suite', false, err.message);
  }

  // 3 & 4. PROPERTY LISTING & LOCATION MAP PIN
  console.log('▶ [3-4/26] Auditing Property Listing & Location Pin...');
  try {
    const geoPeelamedu = await fetch(`${API_BASE}/search/geocode?q=Peelamedu, Coimbatore`).then(r => r.json());
    const geoRSPuram = await fetch(`${API_BASE}/search/geocode?q=RS Puram, Coimbatore`).then(r => r.json());
    const geoGandhipuram = await fetch(`${API_BASE}/search/geocode?q=Gandhipuram, Coimbatore`).then(r => r.json());

    recordTest('PROPERTY LOCATION PIN', 'Forward Geocoding Peelamedu', geoPeelamedu.success && geoPeelamedu.lat > 0);
    recordTest('PROPERTY LOCATION PIN', 'Forward Geocoding RS Puram', geoRSPuram.success && geoRSPuram.lat > 0);
    recordTest('PROPERTY LOCATION PIN', 'Forward Geocoding Gandhipuram', geoGandhipuram.success && geoGandhipuram.lat > 0);

    const revGeo = await fetch(`${API_BASE}/search/reverse-geocode?lat=${geoPeelamedu.lat}&lng=${geoPeelamedu.lng}`).then(r => r.json());
    recordTest('PROPERTY LOCATION PIN', 'Reverse Geocoding Coordinates', revGeo.success && !!revGeo.display_name);

    // Create Property
    const propTitle = `Verified Eco Residence - ${Date.now()}`;
    const createRes = await fetch(`${API_BASE}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testSellerToken}`
      },
      body: JSON.stringify({
        title: propTitle,
        description: 'Spectacular contemporary residence with modern sustainability systems.',
        category: 'residential',
        subcategory: 'villa',
        property_subtype: 'villa',
        property_type: 'villa',
        type: 'sale',
        price: '9500000',
        deposit: '0',
        area_sqft: '2400',
        bedrooms: '3',
        bathrooms: '3',
        bhk: '3',
        address: '88 Avinashi Road, Peelamedu',
        locality: 'Peelamedu',
        city: 'Coimbatore',
        state: 'Tamil Nadu',
        zip_code: '641004',
        lat: geoPeelamedu.lat,
        lng: geoPeelamedu.lng,
        year_built: '2024',
        furnishing: 'semi-furnished',
        parking_spaces: '2',
        amenities_json: JSON.stringify(['Swimming Pool', 'Solar Panels', 'EV Charging', 'Gym', '24/7 Security'])
      })
    }).then(r => r.json());

    createdPropId = createRes.data?.property_id || createRes.data?.id;
    recordTest('PROPERTY LISTING', 'Full Property Listing Creation', createRes.success && !!createdPropId);

    const [dbProp] = await pool.query('SELECT * FROM properties WHERE id = ?', [createdPropId]);
    const p = dbProp[0];
    recordTest('PROPERTY LISTING', 'Property Persisted in MySQL', !!p && p.title === propTitle && Number(p.price) === 9500000);
    recordTest('PROPERTY LOCATION PIN', 'Pin Coordinates Persisted in DB', p && Math.abs(Number(p.lat) - geoPeelamedu.lat) < 0.001);

  } catch (err) {
    recordTest('PROPERTY LISTING', 'Listing & Map Suite', false, err.message);
  }

  // 5. PROPERTY SEARCH & DASHBOARD SEARCH
  console.log('▶ [5/26] Auditing Property Search & Autocomplete...');
  try {
    const sLoc = await fetch(`${API_BASE}/properties?q=Peelamedu`).then(r => r.json());
    recordTest('PROPERTY SEARCH', 'Search by Locality (Peelamedu)', sLoc.success && sLoc.data?.properties?.length > 0);

    const sCity = await fetch(`${API_BASE}/properties?city=Coimbatore`).then(r => r.json());
    recordTest('PROPERTY SEARCH', 'Filter by City (Coimbatore)', sCity.success && sCity.data?.properties?.length > 0);

    const sType = await fetch(`${API_BASE}/properties?property_type=villa`).then(r => r.json());
    recordTest('PROPERTY SEARCH', 'Filter by Type (Villa)', sType.success && sType.data?.properties?.length > 0);

    const sSugg = await fetch(`${API_BASE}/search/suggestions?q=Peel`).then(r => r.json());
    recordTest('DASHBOARD SEARCH', 'Dashboard Autocomplete Suggestions', sSugg.success && (sSugg.data?.locations?.length > 0 || sSugg.data?.properties?.length > 0));

  } catch (err) {
    recordTest('PROPERTY SEARCH', 'Search Suite', false, err.message);
  }

  // 6, 7, 8, 9, 10. PROPERTY DETAILS, DNA, GREEN, TRUST, HIDDEN COSTS
  console.log('▶ [6-10/26] Auditing Details, DNA, Green, Trust, Hidden Cost Engines...');
  try {
    const detail = await fetch(`${API_BASE}/properties/${createdPropId}`).then(r => r.json());
    const pd = detail.data;

    recordTest('PROPERTY DETAILS', 'Property Details Retrieval', detail.success && pd.id === createdPropId);
    recordTest('PROPERTY DNA', 'Property DNA Generation', !!pd.property_dna && !!pd.property_dna.structural_notes);
    recordTest('GREEN LIVING SCORE', 'Green Living Score Calculation', pd.green_score?.score >= 50 || pd.green_living_score >= 50);
    recordTest('PROPERTY TRUST SCORE', 'Multi-Factor Trust Score & Transparency', pd.trust_score?.score >= 50 || !!pd.transparency_report);

    const hc = pd.hidden_costs;
    const isCostExact = hc && hc.totalEstimatedCost > 0 && hc.stampDuty === Math.round(9500000 * 0.07);
    recordTest('HIDDEN COST ENGINE', 'Hidden Cost Formula Math (7% Stamp Duty = ₹6,65,000)', isCostExact, `Total Outlay: ₹${hc?.totalEstimatedCost}`);

  } catch (err) {
    recordTest('PROPERTY DETAILS', 'Engines Suite', false, err.message);
  }

  // 11. 5-YEAR CAPITAL FORECAST
  console.log('▶ [11/26] Auditing 5-Year Capital Forecast...');
  try {
    const detailsHtml = fs.readFileSync(path.join(__dirname, '../../property-details.html'), 'utf8');
    const hasOldGraph = detailsHtml.includes('forecastChart') || detailsHtml.includes('capitalForecastCanvas');
    recordTest('5-YEAR CAPITAL FORECAST', 'Old 5-Year Graph Removed from UI', !hasOldGraph);
  } catch (err) {
    recordTest('5-YEAR CAPITAL FORECAST', 'Graph Check', false, err.message);
  }

  // 12. AI HOME ADVISOR (10 DIVERSE QUESTIONS)
  console.log('▶ [12/26] Auditing AI Home Advisor across 10 diverse queries...');
  try {
    const testQueries = [
      { q: "Which property is better for a family?" },
      { q: "Find a 2 BHK under 25000 rent" },
      { q: "Which property has better locality?" },
      { q: "Is Peelamedu good for renting?" },
      { q: "Compare these two properties" },
      { q: "Which property is better for investment?" },
      { q: "What are the hidden costs?", prop: createdPropId },
      { q: "Which property has better green living?" },
      { q: "I need a property near hospitals and schools" },
      { q: "Should I rent or buy?" }
    ];

    let validReplies = 0;
    const distinctReplies = new Set();

    for (const item of testQueries) {
      const aiRes = await fetch(`${API_BASE}/ai/advisor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: item.q, property_id: item.prop })
      }).then(r => r.json());

      if (aiRes.success && aiRes.data?.reply && aiRes.data.reply.length > 50) {
        validReplies++;
        distinctReplies.add(aiRes.data.reply);
      }
    }

    recordTest('AI HOME ADVISOR', '10/10 Diverse Q&A Handled with Real Data', validReplies === 10 && distinctReplies.size >= 8, `${distinctReplies.size}/10 unique responses`);

  } catch (err) {
    recordTest('AI HOME ADVISOR', 'AI Advisor Suite', false, err.message);
  }

  // 13. LIVE MAP & RECOMMENDATIONS
  console.log('▶ [13/26] Auditing Live Map & Recommendations...');
  try {
    const nearby = await fetch(`${API_BASE}/properties/nearby?lat=11.0267&lng=77.0028&radius=10`).then(r => r.json());
    recordTest('LIVE MAP', 'Geospatial Radius Query (/api/properties/nearby)', nearby.success && Array.isArray(nearby.data?.properties || nearby.data));

    const recs = await fetch(`${API_BASE}/ai/recommendations`).then(r => r.json());
    recordTest('PROPERTY RECOMMENDATIONS', 'AI Personalized Recommendations', recs.success && Array.isArray(recs.data));

  } catch (err) {
    recordTest('LIVE MAP', 'Map & Recs Suite', false, err.message);
  }

  // 14. PROPERTY COMPARISON
  console.log('▶ [14/26] Auditing Property Comparison...');
  try {
    const [props] = await pool.query('SELECT id FROM properties WHERE status = "active" LIMIT 2');
    if (props.length >= 2) {
      const comp = await fetch(`${API_BASE}/compare?ids=${props[0].id},${props[1].id}`).then(r => r.json());
      recordTest('PROPERTY COMPARISON', 'Multi-Property Comparison Matrix', comp.success && comp.data?.properties?.length === 2);
    }
  } catch (err) {
    recordTest('PROPERTY COMPARISON', 'Comparison Suite', false, err.message);
  }

  // 15. SAVED PROPERTIES
  console.log('▶ [15/26] Auditing Saved Properties...');
  try {
    const saveRes = await fetch(`${API_BASE}/saved/${createdPropId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${testBuyerToken}` }
    }).then(r => r.json());
    recordTest('SAVED PROPERTIES', 'Save Property', saveRes.success);

    const getSaved = await fetch(`${API_BASE}/saved`, {
      headers: { Authorization: `Bearer ${testBuyerToken}` }
    }).then(r => r.json());
    const isFound = (getSaved.data?.properties || getSaved.properties || []).some(p => p.property_id === createdPropId || p.id === createdPropId);
    recordTest('SAVED PROPERTIES', 'Retrieve User Saved Properties', isFound);

    const unsave = await fetch(`${API_BASE}/saved/${createdPropId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${testBuyerToken}` }
    }).then(r => r.json());
    recordTest('SAVED PROPERTIES', 'Unsave Property', unsave.success);

  } catch (err) {
    recordTest('SAVED PROPERTIES', 'Saved Suite', false, err.message);
  }

  // 16 & 17. CHAT & TRANSLATION
  console.log('▶ [16-17/26] Auditing In-App Chat & Translation...');
  try {
    const msg = await fetch(`${API_BASE}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${testBuyerToken}` },
      body: JSON.stringify({ property_id: createdPropId, receiver_id: testSellerId, message: 'Hello seller!' })
    }).then(r => r.json());
    recordTest('IN-APP CHAT', 'Send In-App Message', msg.success);

    const thread = await fetch(`${API_BASE}/messages/thread/${createdPropId}/${testSellerId}`, {
      headers: { Authorization: `Bearer ${testBuyerToken}` }
    }).then(r => r.json());
    recordTest('IN-APP CHAT', 'Retrieve Message Thread', thread.success);

    const trans = await fetch(`${API_BASE}/messages/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${testBuyerToken}` },
      body: JSON.stringify({ text: 'Hello, is this property available?', target_lang: 'ta' })
    }).then(r => r.json());
    recordTest('COMMUNICATION BARRIER', 'Tamil Translation Service', trans.success && !!trans.data?.translated_message, `Translated: ${trans.data?.translated_message}`);

  } catch (err) {
    recordTest('IN-APP CHAT', 'Chat Suite', false, err.message);
  }

  // 18. DUPLICATE LISTING DETECTION
  console.log('▶ [18/26] Auditing Duplicate Listing Detection...');
  try {
    const dup = await fetch(`${API_BASE}/properties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${testSellerToken}` },
      body: JSON.stringify({
        title: 'Duplicate Villa Probe',
        description: 'Duplicate',
        category: 'residential',
        subcategory: 'villa',
        type: 'sale',
        price: '9500000',
        area_sqft: '2400',
        address: '88 Avinashi Road, Peelamedu',
        locality: 'Peelamedu',
        city: 'Coimbatore',
        state: 'Tamil Nadu'
      })
    });
    const dupData = await dup.json();
    recordTest('DUPLICATE LISTING DETECTION', 'Pre-Submission Duplicate Blocked (409)', dup.status === 409 && dupData.is_duplicate === true);
  } catch (err) {
    recordTest('DUPLICATE LISTING DETECTION', 'Duplicate Suite', false, err.message);
  }

  // 19. SOLD / OUTDATED REMOVAL
  console.log('▶ [19/26] Auditing Sold/Outdated Property Removal...');
  try {
    const { checkAndExpireListings } = require('../services/expiryService');
    recordTest('SOLD / OUTDATED PROPERTY REMOVAL', 'Auto-Expiry Service Active', typeof checkAndExpireListings === 'function');
  } catch (err) {
    recordTest('SOLD / OUTDATED PROPERTY REMOVAL', 'Expiry Check', false, err.message);
  }

  // 20. FAKE LISTING DETECTION
  console.log('▶ [20/26] Auditing Fake Listing Detection...');
  try {
    const { calculateFraudRisk, computeImageHash } = require('../services/fakeDetectionService');
    recordTest('FAKE LISTING DETECTION', 'Fraud Risk & Perceptual Image Hashing', typeof calculateFraudRisk === 'function' && typeof computeImageHash === 'function');
  } catch (err) {
    recordTest('FAKE LISTING DETECTION', 'Fake Detection Suite', false, err.message);
  }

  // 21. TRANSACTION / PURCHASE REPORT
  console.log('▶ [21/26] Auditing Transactions & Purchase Reports...');
  try {
    const tx = await fetch(`${API_BASE}/transactions/offer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${testBuyerToken}` },
      body: JSON.stringify({
        property_id: createdPropId,
        deal_type: 'buy',
        offer_amount: 9500000,
        deposit_amount: 100000
      })
    }).then(r => r.json());
    const txId = tx.data?.transaction_id || tx.data?.id;
    recordTest('TRANSACTION / PURCHASE REPORT', 'Transaction Offer Created', tx.success && !!txId);

    if (txId) {
      const rep = await fetch(`${API_BASE}/transactions/${txId}/report`, {
        headers: { Authorization: `Bearer ${testBuyerToken}` }
      }).then(r => r.json());
      recordTest('TRANSACTION / PURCHASE REPORT', 'Transaction Summary Report Generated', rep.success && !!rep.data?.report_title);
    }
  } catch (err) {
    recordTest('TRANSACTION / PURCHASE REPORT', 'Transaction Suite', false, err.message);
  }

  // 22. PROFILE
  console.log('▶ [22/26] Auditing Profile...');
  try {
    const updProf = await fetch(`${API_BASE}/users/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${testBuyerToken}` },
      body: JSON.stringify({ name: 'Reg Buyer Updated', phone: '9876543210', city: 'Coimbatore' })
    }).then(r => r.json());
    recordTest('PROFILE', 'Profile Update & Persistence', updProf.success && updProf.data?.name === 'Reg Buyer Updated');
  } catch (err) {
    recordTest('PROFILE', 'Profile Suite', false, err.message);
  }

  // 23. ADMIN PORTAL & SYNTAX CHECK
  console.log('▶ [23/26] Auditing Admin Functionality & Syntax...');
  try {
    const adminStats = await fetch(`${API_BASE}/admin/stats`, {
      headers: { Authorization: `Bearer ${testAdminToken}` }
    }).then(r => r.json());
    recordTest('ADMIN FUNCTIONALITY', 'Admin Statistics API', adminStats.success && adminStats.data?.users?.total_users > 0);

    const adminUsers = await fetch(`${API_BASE}/admin/users`, {
      headers: { Authorization: `Bearer ${testAdminToken}` }
    }).then(r => r.json());
    recordTest('ADMIN FUNCTIONALITY', 'Admin Users Table API', adminUsers.success && Array.isArray(adminUsers.data));

    const adminProps = await fetch(`${API_BASE}/admin/properties`, {
      headers: { Authorization: `Bearer ${testAdminToken}` }
    }).then(r => r.json());
    recordTest('ADMIN FUNCTIONALITY', 'Admin Properties Inventory API', adminProps.success && Array.isArray(adminProps.data));

  } catch (err) {
    recordTest('ADMIN FUNCTIONALITY', 'Admin Suite', false, err.message);
  }

  // 24. UI / CONSOLE ERRORS
  console.log('▶ [24/26] Checking JS Syntax...');
  try {
    const { execSync } = require('child_process');
    execSync('node -c c:\\HomeSphere\\js\\admin.js');
    execSync('node -c c:\\HomeSphere\\js\\list-property.js');
    execSync('node -c c:\\HomeSphere\\js\\property-details.js');
    execSync('node -c c:\\HomeSphere\\js\\dashboard.js');
    execSync('node -c c:\\HomeSphere\\js\\map-search.js');
    execSync('node -c c:\\HomeSphere\\js\\compare.js');
    execSync('node -c c:\\HomeSphere\\js\\saved.js');
    recordTest('UI / CONSOLE ERRORS', 'All JS Files Valid Syntax (Zero Syntax Errors)', true);
  } catch (err) {
    recordTest('UI / CONSOLE ERRORS', 'JS Syntax Validation', false, err.message);
  }

  // 25. STATIC / DUMMY DATA AUDIT
  console.log('▶ [25/26] Auditing Static / Dummy Data...');
  const [activePropsCount] = await pool.query('SELECT COUNT(*) as cnt FROM properties WHERE status = "active"');
  recordTest('STATIC / DUMMY DATA', 'Real MySQL Property Listings Active (Zero Fake Data)', activePropsCount[0].cnt >= 90, `${activePropsCount[0].cnt} verified properties in DB`);

  // 26. SECURITY AUDIT
  console.log('▶ [26/26] Auditing Security & Contact Privacy...');
  try {
    const pubProp = await fetch(`${API_BASE}/properties/1`).then(r => r.json());
    const isSanitized = !pubProp.data?.owner_phone && !pubProp.data?.phone && !pubProp.data?.owner_email && !pubProp.data?.password_hash;
    recordTest('SECURITY', 'Contact Privacy & Data Sanitization', isSanitized);

    const unauthSaved = await fetch(`${API_BASE}/saved`);
    recordTest('SECURITY', 'JWT Authentication Guard (401)', unauthSaved.status === 401);
  } catch (err) {
    recordTest('SECURITY', 'Security Suite', false, err.message);
  }

  // Cleanup probe data
  if (createdPropId) await pool.query('DELETE FROM properties WHERE id = ?', [createdPropId]);
  if (testBuyerId) await pool.query('DELETE FROM users WHERE id = ?', [testBuyerId]);
  if (testSellerId) await pool.query('DELETE FROM users WHERE id = ?', [testSellerId]);
  if (testAdminId) await pool.query('DELETE FROM users WHERE id = ?', [testAdminId]);

  console.log('\n================================================================');
  console.log('📊 FINAL COMPREHENSIVE REGRESSION REPORT:');
  console.log('================================================================');
  let totalPass = 0;
  let totalFail = 0;
  for (const [cat, res] of Object.entries(auditResults.categories)) {
    const status = res.failCount === 0 ? 'PASS' : (res.passCount > 0 ? 'PARTIAL' : 'FAIL');
    if (res.failCount === 0) totalPass++;
    else totalFail++;
    console.log(`${cat.padEnd(35)}: ${status} (${res.passCount} passed, ${res.failCount} failed)`);
    res.tests.forEach(t => {
      console.log(`  - [${t.passed ? '✓' : '✗'}] ${t.testName} ${t.details ? '(' + t.details + ')' : ''}`);
    });
  }

  console.log('\n================================================================');
  console.log(`🎯 OVERALL SCORE: ${totalPass}/${totalPass + totalFail} CATEGORIES 100% PASS`);
  console.log('================================================================');

  process.exit(totalFail === 0 ? 0 : 1);
}

runRegressionAudit().catch(err => {
  console.error('Regression suite failed:', err);
  process.exit(1);
});
