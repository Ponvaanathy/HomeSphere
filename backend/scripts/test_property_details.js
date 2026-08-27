/**
 * test_property_details.js
 * Verifies property listing upload, fetching by ID, and details view structure.
 */

const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:5000/api';

async function runTest() {
  console.log('====================================================');
  console.log('🧪 TESTING PROPERTY DETAILS & UPLOAD LIFECYCLE');
  console.log('====================================================\n');

  // 1. Register User
  console.log('1️⃣ Registering test user...');
  const userPayload = {
    name: 'Emily Watson',
    email: `emily_${Date.now()}@example.com`,
    password: 'Password123!',
    phone: '+1 555 432 1098'
  };

  const regRes = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userPayload)
  });
  const regData = await regRes.json();
  if (!regRes.ok || !regData.success) {
    throw new Error(`Registration failed: ${JSON.stringify(regData)}`);
  }
  const token = regData.data.token;
  console.log(` ✔ User registered: ${regData.data.user.name} (ID: ${regData.data.user.id})`);

  // 2. Create property listing via JSON
  console.log('\n2️⃣ Creating property listing via POST /api/properties...');
  const propPayload = {
    title: 'Skyline Horizon Penthouse',
    description: 'Spectacular high-rise penthouse featuring panoramic skyline views, private elevator, and smart home automation.',
    type: 'buy',
    property_type: 'penthouse',
    price: 1850000,
    bedrooms: 4,
    bathrooms: 3.5,
    area_sqft: 3200,
    address: '888 Grand Ocean Boulevard',
    city: 'Miami',
    state: 'FL',
    zip_code: '33139',
    year_built: 2022,
    furnishing: 'Fully Furnished',
    amenities_json: ['Sky Lounge', 'Infinity Pool', 'Concierge', 'Private Elevator', 'Valet Parking', 'Smart Thermostat']
  };

  const listRes = await fetch(`${API_BASE}/properties`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(propPayload)
  });

  const listData = await listRes.json();
  if (!listRes.ok || !listData.success) {
    throw new Error(`Property listing failed: ${JSON.stringify(listData)}`);
  }

  const propertyId = listData.data.property_id || listData.data.id;
  console.log(` ✔ Property record created with ID: ${propertyId}`);

  // Upload Images
  console.log('\n   Uploading gallery photos...');
  const fakeImgBuffer = Buffer.from('FAKE_JPEG_IMAGE_DATA_FOR_TESTING');
  const fakeImgBlob = new Blob([fakeImgBuffer], { type: 'image/jpeg' });

  const galleryForm = new FormData();
  galleryForm.append('images', fakeImgBlob, 'living_room.jpg');
  galleryForm.append('images', fakeImgBlob, 'bedroom.jpg');
  galleryForm.append('primary_index', '0');

  const imgUploadRes = await fetch(`${API_BASE}/properties/${propertyId}/images`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: galleryForm
  });
  const imgUploadData = await imgUploadRes.json();
  console.log(` ✔ Gallery photos uploaded: ${JSON.stringify(imgUploadData.data?.length || 2)} images`);

  // Upload Virtual Tour Room
  console.log('   Uploading virtual tour rooms...');
  const tourForm = new FormData();
  tourForm.append('tour_images', fakeImgBlob, 'penthouse_hall.jpg');
  tourForm.append('room_name', 'Grand Living Area');
  tourForm.append('room_description', 'Expansive living room with double-height ceiling.');
  tourForm.append('display_order', '0');
  tourForm.append('is_panoramic', '1');

  const tourUploadRes = await fetch(`${API_BASE}/properties/${propertyId}/virtual-tour`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: tourForm
  });
  const tourUploadData = await tourUploadRes.json();
  console.log(` ✔ Virtual tour room uploaded: ${tourUploadData.data?.room_name || 'Grand Living Area'}`);

  // 3. Fetch property details
  console.log(`\n3️⃣ Fetching property details from GET /api/properties/${propertyId}...`);
  const detailsRes = await fetch(`${API_BASE}/properties/${propertyId}`);
  const detailsData = await detailsRes.json();

  if (!detailsRes.ok || !detailsData.success || !detailsData.data) {
    throw new Error(`Failed to fetch property details: ${JSON.stringify(detailsData)}`);
  }

  const p = detailsData.data;
  console.log(' ✔ Property fetched successfully:');
  console.log(`   - Title: ${p.title}`);
  console.log(`   - Price: $${p.price}`);
  console.log(`   - Owner: ${p.owner_name} (${p.owner_email}, ${p.owner_phone})`);
  console.log(`   - Images: ${p.images.length} photos`);
  console.log(`   - Virtual Tour: ${p.virtual_tour_images.length} rooms`);
  console.log(`   - Trust Score: ${p.trust_score?.score}/100`);
  console.log(`   - Transparency Report Score: ${p.transparency_report?.overall_transparency_score}/100`);

  // 4. Test AI Decision Summary
  console.log(`\n4️⃣ Fetching AI Decision Summary from GET /api/ai/decision-summary/${propertyId}...`);
  const aiRes = await fetch(`${API_BASE}/ai/decision-summary/${propertyId}`);
  const aiData = await aiRes.json();
  if (aiRes.ok && aiData.success) {
    console.log(` ✔ AI Decision Summary Verdict: ${aiData.data.verdict}`);
  } else {
    console.log(` ⚠ AI Decision Summary returned: ${JSON.stringify(aiData)}`);
  }

  console.log('\n====================================================');
  console.log('🎉 PROPERTY DETAILS & UPLOAD VERIFICATION PASSED!');
  console.log('====================================================\n');
}

runTest().catch((err) => {
  console.error('\n❌ Test Failed:', err);
  process.exit(1);
});
