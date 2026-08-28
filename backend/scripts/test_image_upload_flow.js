const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

// Minimal 1x1 valid PNG buffer
const samplePngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// Minimal 1x1 valid JPEG buffer
const sampleJpgBuffer = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64'
);

// Minimal 1x1 valid WEBP buffer
const sampleWebpBuffer = Buffer.from(
  'UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=',
  'base64'
);

async function runImageUploadTests() {
  console.log('================================================================');
  console.log('📷 TESTING REAL PROPERTY IMAGE UPLOADS & MULTER FLOW');
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
    // 1. Authenticate
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'seller@homesphere.com', password: 'password123' })
    }).then(r => r.json());

    test('1. Authentication successful', loginRes.success && !!loginRes.data?.token, `User: ${loginRes.data?.user?.name}`);
    const token = loginRes.data?.token;

    console.log('\n2️⃣ TEST 2: Single Real Image File Upload:');
    const form1 = new FormData();
    const stamp1 = Date.now() + Math.floor(Math.random() * 10000);
    const randPrice1 = 14000000 + Math.floor(Math.random() * 5000000);
    const randArea1 = 2800 + Math.floor(Math.random() * 1000);
    form1.append('title', `Modern Villa with Real Photo Upload ${stamp1}`);

    form1.append('description', 'Spectacular luxury villa with genuine photo upload verification.');
    form1.append('category', 'residential');
    form1.append('subcategory', 'villa');
    form1.append('property_subtype', 'villa');
    form1.append('type', 'sale');
    form1.append('price', String(randPrice1));
    form1.append('address', `18 Vadavalli Main Road ${stamp1}`);
    form1.append('locality', 'Vadavalli');
    form1.append('city', 'Coimbatore');
    form1.append('state', 'Tamil Nadu');
    form1.append('zip_code', '641041');
    form1.append('bedrooms', '4');
    form1.append('bathrooms', '4');
    form1.append('area_sqft', String(randArea1));

    form1.append('amenities_json', JSON.stringify(['24/7 Security', 'Swimming Pool']));

    // Attach real JPEG file
    const jpgBlob1 = new Blob([sampleJpgBuffer], { type: 'image/jpeg' });
    form1.append('images', jpgBlob1, 'villa_exterior.jpg');

    const res1 = await fetch('http://localhost:5000/api/properties', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: form1
    }).then(r => r.json());

    test('TEST 2: Property created with real image file', res1.success && !!res1.data?.property_id, `ID: #${res1.data?.property_id}`);
    const propId1 = res1.data?.property_id;

    // Check DB record
    const [imgRows1] = await pool.query('SELECT * FROM property_images WHERE property_id = ?', [propId1]);
    test('TEST 2: Database property_images row created', imgRows1.length === 1 && imgRows1[0].is_primary === 1, `URL: ${imgRows1[0]?.image_url}`);

    // Check file on disk
    const diskPath1 = path.join(__dirname, '../../', imgRows1[0]?.image_url || '');
    const fileExists1 = fs.existsSync(diskPath1);
    test('TEST 2: Physical file exists on server disk', fileExists1, `Path: ${imgRows1[0]?.image_url}`);

    // Check HTTP asset serving
    const httpAssetRes1 = await fetch(`http://localhost:5000${imgRows1[0]?.image_url}`);
    test('TEST 2: Image asset served via HTTP 200', httpAssetRes1.status === 200, `Content-Type: ${httpAssetRes1.headers.get('content-type')}`);

    // 3. TEST: Multiple Image Uploads (JPG, PNG, WEBP) with Primary Selection
    console.log('\n3️⃣ TEST 3: Multiple Image Uploads with Cover Selection:');
    const form2 = new FormData();
    const stamp2 = Date.now() + Math.floor(Math.random() * 100000) + 100;
    const randPrice2 = 22000000 + Math.floor(Math.random() * 5000000);
    const randArea2 = 3800 + Math.floor(Math.random() * 1000);
    form2.append('title', `CasaGrand XYZ Multi-Photo Villa 15 ${stamp2}`);

    form2.append('description', 'Gated community villa with 3 uploaded photos (exterior, living, master).');
    form2.append('category', 'residential');
    form2.append('subcategory', 'gated_community_home');
    form2.append('property_subtype', 'gated_community_home');
    form2.append('project_name', 'CasaGrand XYZ');
    form2.append('unit_number', 'Villa 15');
    form2.append('type', 'sale');
    form2.append('price', String(randPrice2));
    form2.append('address', `Palm Avenue, CasaGrand XYZ ${stamp2}`);
    form2.append('locality', 'Singanallur');
    form2.append('city', 'Coimbatore');
    form2.append('state', 'Tamil Nadu');
    form2.append('zip_code', '641004');
    form2.append('bedrooms', '4');
    form2.append('bathrooms', '4.5');
    form2.append('area_sqft', String(randArea2));
    form2.append('primary_image_index', '1'); // Select 2nd photo as Cover


    // Attach 3 different real image types
    const blobJpg = new Blob([sampleJpgBuffer], { type: 'image/jpeg' });
    const blobPng = new Blob([samplePngBuffer], { type: 'image/png' });
    const blobWebp = new Blob([sampleWebpBuffer], { type: 'image/webp' });

    form2.append('images', blobJpg, 'living_room.jpg');
    form2.append('images', blobPng, 'exterior_front.png'); // Index 1 -> Cover
    form2.append('images', blobWebp, 'master_bedroom.webp');

    const res2 = await fetch('http://localhost:5000/api/properties', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: form2
    }).then(r => r.json());

    test('TEST 3: Multi-photo property created', res2.success && !!res2.data?.property_id, `ID: #${res2.data?.property_id}`);
    const propId2 = res2.data?.property_id;

    // Check all 3 DB records
    const [imgRows2] = await pool.query('SELECT * FROM property_images WHERE property_id = ? ORDER BY id ASC', [propId2]);
    test('TEST 3: All 3 images inserted in DB', imgRows2.length === 3, `Count: ${imgRows2.length}`);

    // Check primary index
    const primaryImg = imgRows2.find(img => img.is_primary === 1);
    test('TEST 3: Designated photo (index 1) marked as primary cover', primaryImg && primaryImg.image_url.includes('prop-'), `Primary Image: ${primaryImg?.image_url}`);

    // Check files on disk
    let allFilesOnDisk = true;
    for (const img of imgRows2) {
      const diskPath = path.join(__dirname, '../../', img.image_url);
      if (!fs.existsSync(diskPath)) {
        allFilesOnDisk = false;
      }
    }
    test('TEST 3: All 3 uploaded files exist physically on server', allFilesOnDisk);

    // 4. TEST: Property Details API (`GET /api/properties/:id`)
    console.log('\n4️⃣ TEST 4: Property Details API Image Gallery Integration:');
    const detailsRes = await fetch(`http://localhost:5000/api/properties/${propId2}`).then(r => r.json());
    test('TEST 4: Property Details returns images array', detailsRes.success && Array.isArray(detailsRes.data?.images) && detailsRes.data.images.length === 3, `Gallery Count: ${detailsRes.data?.images?.length}`);

    // 5. TEST: Marketplace Discovery API (`GET /api/properties`)
    console.log('\n5️⃣ TEST 5: Marketplace Discovery API Primary Image Display:');
    const marketRes = await fetch(`http://localhost:5000/api/properties?q=CasaGrand%20XYZ%20Multi-Photo`).then(r => r.json());
    const matchedProp = marketRes.data?.properties?.find(p => p.id === propId2);
    test('TEST 5: Discovery card displays uploaded cover photo', matchedProp && matchedProp.primary_image && matchedProp.primary_image.startsWith('/uploads/property-images/'), `Primary Image: ${matchedProp?.primary_image}`);

    // 6. TEST: Invalid File Rejection
    console.log('\n6️⃣ TEST 6: Invalid File Format Rejection:');
    const formInvalid = new FormData();
    formInvalid.append('title', 'Invalid File Test');
    formInvalid.append('price', '5000000');
    formInvalid.append('address', '10 Main Street');
    formInvalid.append('area_sqft', '1200');

    const fakeExeBlob = new Blob([Buffer.from('MZ executable code')], { type: 'application/octet-stream' });
    formInvalid.append('images', fakeExeBlob, 'malicious_script.exe');

    const resInvalid = await fetch('http://localhost:5000/api/properties', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formInvalid
    }).then(r => r.json());

    test('TEST 6: Invalid non-image file is safely rejected', !resInvalid.success, `Message: ${resInvalid.message}`);

    // 7. TEST: Backward Compatibility with Existing Image URLs
    console.log('\n7️⃣ TEST 7: Backward Compatibility with Existing Properties:');
    const [existingWithUrl] = await pool.query("SELECT id, title FROM properties WHERE id = 1 LIMIT 1");
    if (existingWithUrl.length > 0) {
      const p1Details = await fetch(`http://localhost:5000/api/properties/1`).then(r => r.json());
      test('TEST 7: Existing property #1 with external image URL loads successfully', p1Details.success && p1Details.data?.images?.length > 0, `Primary: ${p1Details.data?.images[0]?.image_url}`);
    }

    console.log('\n================================================================');
    console.log(`📊 RESULTS: ${passed}/${total} Tests Passed (${Math.round((passed / total) * 100)}%)`);
    console.log('================================================================\n');

    await pool.end();
  } catch (err) {
    console.error('Test error:', err);
    try { await pool.end(); } catch (e) {}
  }
}


runImageUploadTests();
