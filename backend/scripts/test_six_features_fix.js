const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const JWT_SECRET = 'homesphere_jwt_secret_key_ultra_secure_2026_antigravity';

async function runTests() {
  console.log('========================================================================');
  console.log('🧪 RUNNING VERIFICATION TEST SUITE FOR THE 6 TARGET FIXES');
  console.log('========================================================================\n');

  const [allUsers] = await pool.query('SELECT * FROM users ORDER BY id ASC');
  const user1 = allUsers[0] || { id: 1, email: 'admin@homesphere.com', role: 'admin' };
  const user2 = allUsers[1] || { id: 2, email: 'seller@homesphere.com', role: 'user' };
  const user3 = allUsers[2] || { id: 3, email: 'buyer@homesphere.com', role: 'user' };

  const adminToken = jwt.sign({ id: user1.id, email: user1.email, role: user1.role }, JWT_SECRET);
  const sellerToken = jwt.sign({ id: user2.id, email: user2.email, role: user2.role }, JWT_SECRET);
  const buyerToken = jwt.sign({ id: user3.id, email: user3.email, role: user3.role }, JWT_SECRET);

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      if (details) console.log(`   ${details}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      if (details) console.error(`   ${details}`);
      failed++;
    }
  }

  // ------------------------------------------------------------------------
  // 1. FEATURE 1: DUPLICATE LISTING AUTO REMOVAL
  // ------------------------------------------------------------------------
  console.log('\n--- 1. DUPLICATE LISTING AUTO REMOVAL ---');
  
  const uniqueId = Date.now() + Math.floor(Math.random() * 100000);
  const testAddress = `108 Unique Test Avenue ${uniqueId}`;
  const randPriceA = 93000 + Math.floor(Math.random() * 50000);
  const randAreaA = 1150 + Math.floor(Math.random() * 500);
  const propAPayload = {
    title: `Duplicate Test 2 BHK Residence ${uniqueId}`,
    description: 'Beautiful 2 BHK in Peelamedu',
    category: 'residential',
    property_subtype: 'apartment',
    type: 'rent',
    price: randPriceA,
    area_sqft: randAreaA,
    bedrooms: 2,
    bathrooms: 2,
    address: testAddress,
    locality: `Peelamedu UniqueZone ${uniqueId}`,
    city: 'Coimbatore',
    state: 'Tamil Nadu'
  };



  // Submit Property A
  const resA = await fetch('http://localhost:5000/api/properties', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${sellerToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(propAPayload)
  }).then(r => r.json());

  assert(resA.success === true && resA.data?.id, 'Property A created successfully', `ID: ${resA.data?.id}`);
  const propAId = resA.data?.id;

  // Submit Property B (Duplicate of Property A with identical address and specs)
  const resB = await fetch('http://localhost:5000/api/properties', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${sellerToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(propAPayload)
  }).then(r => r.json());

  assert(resB.success === false && resB.is_duplicate === true, 'Property B (duplicate) was rejected by backend', `Message: "${resB.message}"`);
  assert(resB.existing_property_id === propAId, 'Duplicate rejection references existing Property A ID', `Matched ID: ${resB.existing_property_id}`);

  // Submit Property C (Genuinely different property in Gandhipuram)
  const propCPayload = {
    title: 'Distinct 3 BHK Villa in Gandhipuram',
    description: 'Distinct luxury villa with 3 bedrooms',
    category: 'residential',
    property_subtype: 'individual_home',
    type: 'sale',
    price: 4000000,
    area_sqft: 1800,
    bedrooms: 3,
    bathrooms: 3,
    address: `550 Cross Cut Road ${Date.now()}`,
    locality: 'Gandhipuram',
    city: 'Coimbatore',
    state: 'Tamil Nadu'
  };

  const resC = await fetch('http://localhost:5000/api/properties', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${sellerToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(propCPayload)
  }).then(r => r.json());

  assert(resC.success === true && resC.data?.id, 'Distinct Property C in Gandhipuram was accepted', `ID: ${resC.data?.id}`);
  const propCId = resC.data?.id;

  // ------------------------------------------------------------------------
  // 2. FEATURE 2: OUTDATED / SOLD PROPERTY AUTO REMOVAL
  // ------------------------------------------------------------------------
  console.log('\n--- 2. OUTDATED / SOLD PROPERTY AUTO REMOVAL ---');

  // Verify Property C is visible in public discovery while active
  const searchBefore = await fetch('http://localhost:5000/api/properties?location=Gandhipuram').then(r => r.json());
  const isCInSearchBefore = searchBefore.data?.properties?.some(p => p.id === propCId);
  assert(isCInSearchBefore === true, 'Property C is visible in public search while active');

  // Mark Property C as SOLD in MySQL
  await pool.query('UPDATE properties SET status = "sold" WHERE id = ?', [propCId]);

  // Verify Property C disappears from public search
  const searchAfter = await fetch('http://localhost:5000/api/properties?location=Gandhipuram').then(r => r.json());
  const isCInSearchAfter = searchAfter.data?.properties?.some(p => p.id === propCId);
  assert(isCInSearchAfter === false, 'Property C immediately disappears from public discovery when marked sold');

  // Verify database row is preserved
  const [dbRow] = await pool.query('SELECT id, status FROM properties WHERE id = ?', [propCId]);
  assert(dbRow.length > 0 && dbRow[0].status === 'sold', 'Property C database row remains in MySQL for transaction/audit records');

  // ------------------------------------------------------------------------
  // 3. FEATURE 3: FAKE LISTING DETECTION
  // ------------------------------------------------------------------------
  console.log('\n--- 3. FAKE LISTING DETECTION (DYNAMIC IMAGE & FRAUD SIGNALS) ---');

  const prop1Details = await fetch('http://localhost:5000/api/properties/1').then(r => r.json());
  const transReport = prop1Details.data?.transparency_report;

  assert(transReport && transReport.fraud_risk_score !== undefined, 'Transparency report contains dynamic fraud_risk_score', `Score: ${transReport?.fraud_risk_score}`);
  assert(transReport?.fraud_risk_verdict !== undefined, 'Transparency report contains fraud risk verdict', `Verdict: ${transReport?.fraud_risk_verdict}`);
  assert(transReport?.image_authenticity?.signals?.length > 0, 'Image authenticity includes verified dynamic signals', `Signals Count: ${transReport?.image_authenticity?.signals?.length}`);

  // Test dynamic fraud calculation with underpriced anomaly
  const { calculateFraudRisk } = require('../services/fakeDetectionService');
  const normalEval = calculateFraudRisk({ price: 5000000, area_sqft: 1000 }, { neighborhoodMedianPerSqft: 5000, isOwnerVerified: true });
  const fakePriceEval = calculateFraudRisk({ price: 300000, area_sqft: 1000 }, { neighborhoodMedianPerSqft: 5000, isOwnerVerified: false });
  const reusedImgEval = calculateFraudRisk({ price: 5000000, area_sqft: 1000 }, { neighborhoodMedianPerSqft: 5000, hasReusedImages: true, reusedImageCount: 3 });

  assert(normalEval.fraud_risk_score < fakePriceEval.fraud_risk_score, 'Severe underpricing dramatically increases fraud risk score', `Normal: ${normalEval.fraud_risk_score} vs Fake Price: ${fakePriceEval.fraud_risk_score}`);
  assert(reusedImgEval.fraud_risk_score > normalEval.fraud_risk_score, 'Reused image detection increases fraud risk score', `Normal: ${normalEval.fraud_risk_score} vs Reused: ${reusedImgEval.fraud_risk_score}`);

  // ------------------------------------------------------------------------
  // 4. FEATURE 4: BROKER SPAM CALL PREVENTION
  // ------------------------------------------------------------------------
  console.log('\n--- 4. BROKER SPAM CALL PREVENTION (NO PHONE/EMAIL LEAKS) ---');

  const propRes = await fetch('http://localhost:5000/api/properties/1').then(r => r.json());
  const pData = propRes.data;

  assert(pData && pData.owner_phone === undefined, 'GET /api/properties/1 does NOT leak owner_phone');
  assert(pData && pData.phone === undefined, 'GET /api/properties/1 does NOT leak phone');
  assert(pData && pData.owner_email === undefined, 'GET /api/properties/1 does NOT leak owner_email');
  assert(pData && pData.email === undefined, 'GET /api/properties/1 does NOT leak email');
  assert(pData && pData.owner_name !== undefined, 'GET /api/properties/1 provides public owner name', `Owner: ${pData?.owner_name}`);

  // ------------------------------------------------------------------------
  // 5. FEATURE 5: COMMUNICATION BARRIER (MULTILINGUAL TRANSLATION)
  // ------------------------------------------------------------------------
  console.log('\n--- 5. COMMUNICATION BARRIER (MULTILINGUAL TRANSLATION) ---');

  const tamilText = 'இந்த வீடு இன்னும் available-ஆ இருக்கா?';
  const transRes = await fetch('http://localhost:5000/api/messages/translate', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${buyerToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: tamilText, target_lang: 'en' })
  }).then(r => r.json());

  assert(transRes.success === true, 'Translation API responded successfully');
  assert(transRes.data?.translated_message !== undefined && transRes.data?.translated_message !== '', 'Tamil text translated to English', `Original: "${tamilText}" -> Translated: "${transRes.data?.translated_message}"`);
  assert(transRes.data?.source_language === 'ta', 'Tamil source script correctly detected as "ta"');

  // Test English to Tamil translation
  const englishText = 'Is the price negotiable?';
  const transEnRes = await fetch('http://localhost:5000/api/messages/translate', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${buyerToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: englishText, target_lang: 'ta' })
  }).then(r => r.json());

  assert(transEnRes.success === true, 'English to Tamil translation responded successfully', `Original: "${englishText}" -> Translated: "${transEnRes.data?.translated_message}"`);

  // ------------------------------------------------------------------------
  // 6. FEATURE 6: PROPERTY TRANSACTION / PURCHASE REPORT
  // ------------------------------------------------------------------------
  console.log('\n--- 6. PROPERTY TRANSACTION / PURCHASE REPORT ---');

  // Verify js/transactions.js syntax
  const { execSync } = require('child_process');
  let jsSyntaxClean = false;
  try {
    execSync('node -c js/transactions.js', { stdio: 'pipe' });
    jsSyntaxClean = true;
  } catch (e) {}
  assert(jsSyntaxClean === true, 'js/transactions.js passes syntax check with 0 errors');

  // Get first transaction and test report endpoint
  const [firstTx] = await pool.query('SELECT * FROM transactions LIMIT 1');
  const tx = firstTx[0];
  const txSellerToken = jwt.sign({ id: tx.seller_id, email: 'owner@homesphere.com', role: 'user' }, JWT_SECRET);

  const reportRes = await fetch(`http://localhost:5000/api/transactions/${tx.id}/report`, {
    headers: { 'Authorization': `Bearer ${txSellerToken}` }
  }).then(r => r.json());

  assert(reportRes.success === true, 'GET /api/transactions/:id/report returns HTTP 200');
  const report = reportRes.data;
  assert(report?.report_title === 'HOMESPHERE PROPERTY TRANSACTION SUMMARY', 'Report has correct title "HOMESPHERE PROPERTY TRANSACTION SUMMARY"');
  assert(report?.transaction_id?.startsWith('HS-TX-'), 'Report contains official Transaction ID', `ID: ${report?.transaction_id}`);
  assert(report?.buyer?.name && report?.seller?.name, 'Report contains Buyer & Seller names', `Buyer: ${report?.buyer?.name}, Seller: ${report?.seller?.name}`);
  assert(report?.financial_summary?.total_transaction_amount > 0, 'Report contains accurate financial outlay', `Total: ₹${Number(report?.financial_summary?.total_transaction_amount).toLocaleString()}`);
  assert(report?.legal_disclaimer?.includes('not a government registration certificate'), 'Report includes mandatory non-government legal disclaimer');

  // ------------------------------------------------------------------------
  // SUMMARY
  // ------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`🏁 FINAL TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  await pool.end();
}

runTests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
