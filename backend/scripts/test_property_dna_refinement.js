const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

async function runDnaRefinementTests() {
  console.log('================================================================');
  console.log('🧬 TESTING PROPERTY DNA REFINEMENT (REMOVAL OF STRUCTURE INPUTS)');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, condition, details = '') {
    total++;
    if (condition) {
      passed++;
      console.log(` ✅ PASS: ${name} ${details ? '— ' + details : ''}`);
    } else {
      console.error(` ❌ FAIL: ${name} ${details ? '— ' + details : ''}`);
    }
  }

  try {
    // 1. Check list-property.html does NOT contain Structure or Construction Quality inputs
    console.log('1️⃣ HTML Inspection:');
    const htmlPath = path.join(__dirname, '../../list-property.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    test('list-property.html does NOT contain propStructuralNotes input', !htmlContent.includes('id="propStructuralNotes"'));
    test('list-property.html does NOT contain "Structural & Construction Quality" label', !htmlContent.includes('Structural & Construction Quality'));
    test('list-property.html preserves propLegalStatus (Legal Title Verification)', htmlContent.includes('id="propLegalStatus"'));
    test('list-property.html preserves Real File Upload Dropzone', htmlContent.includes('id="imageUploadDropzone"'));

    // 2. Authenticate
    console.log('\n2️⃣ Authentication:');
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'seller@homesphere.com', password: 'password123' })
    }).then(r => r.json());

    test('Authentication successful', loginRes.success && !!loginRes.data?.token);
    const token = loginRes.data?.token;

    // 3. Create property without sending structural_notes or construction_quality
    console.log('\n3️⃣ Property Creation (Without Structure/Construction Quality Inputs):');
    const form = new FormData();
    const uniqueStamp = Date.now();
    form.append('title', `Refined DNA Penthouse in Race Course ${uniqueStamp}`);

    form.append('description', 'Luxury penthouse with automated property DNA synthesis.');
    form.append('category', 'residential');
    form.append('subcategory', 'penthouse');
    form.append('property_subtype', 'penthouse');
    form.append('type', 'sale');
    form.append('price', String(28000000 + Math.floor(Math.random() * 5000000)));
    form.append('address', `88 Race Course Promenade ${uniqueStamp}`);

    form.append('locality', 'Race Course South');
    form.append('city', 'Coimbatore');
    form.append('state', 'Tamil Nadu');
    form.append('zip_code', '641018');
    form.append('bedrooms', '4');
    form.append('bathrooms', '4');
    form.append('area_sqft', '3900');

    form.append('legal_status', '100% Clear Freehold Title Verified');
    // Notice: NO structural_notes or construction_quality appended!

    const res = await fetch('http://localhost:5000/api/properties', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: form
    }).then(r => r.json());

    test('Property created successfully without structure inputs', res.success && !!res.data?.property_id, `ID: #${res.data?.property_id}`);
    const propId = res.data?.property_id;

    // 4. Verify MySQL property_dna record
    console.log('\n4️⃣ Database Verification:');
    const [dnaRows] = await pool.query('SELECT * FROM property_dna WHERE property_id = ?', [propId]);
    test('property_dna record exists in MySQL', dnaRows.length === 1);
    test('property_dna has valid legal_status', dnaRows[0]?.legal_status === '100% Clear Freehold Title Verified', `Status: ${dnaRows[0]?.legal_status}`);
    test('property_dna has intelligent automated structural_notes', !!dnaRows[0]?.structural_notes, `DNA Structural Notes: "${dnaRows[0]?.structural_notes}"`);

    // 5. Verify Property Details API includes full Property DNA
    console.log('\n5️⃣ Property Details API Verification:');
    const detailsRes = await fetch(`http://localhost:5000/api/properties/${propId}`).then(r => r.json());
    test('GET /api/properties/:id returns property_dna object', detailsRes.success && !!detailsRes.data?.property_dna);
    test('Property DNA legal_status present', detailsRes.data?.property_dna?.legal_status === '100% Clear Freehold Title Verified');

    // 6. Verify Comparison API works
    console.log('\n6️⃣ Comparison & Advisor Verification:');
    const compareRes = await fetch(`http://localhost:5000/api/compare?ids=${propId},1`).then(r => r.json());
    test('GET /api/compare handles new property with Property DNA', compareRes.success && compareRes.data?.properties?.length >= 1);

    console.log('\n================================================================');
    console.log(`📊 RESULTS: ${passed}/${total} Tests Passed (${Math.round((passed / total) * 100)}%)`);
    console.log('================================================================\n');

    await pool.end();
  } catch (err) {
    console.error('Test error:', err);
    try { await pool.end(); } catch (e) {}
  }
}



runDnaRefinementTests();
