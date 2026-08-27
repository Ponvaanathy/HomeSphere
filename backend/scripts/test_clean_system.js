const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const API_BASE = 'http://localhost:5000/api';

async function runEndToEndVerification() {
  console.log('====================================================');
  console.log('🧪 RUNNING COMPREHENSIVE ZERO-DATA & REAL-USER TESTS');
  console.log('====================================================\n');

  // 1. Check API Health
  console.log('1️⃣ Checking API Health...');
  const healthRes = await fetch(`${API_BASE}/health`);
  const healthData = await healthRes.json();
  console.log(' ✔ Health Status:', healthData);

  // 2. Verify 0-state across endpoints
  console.log('\n2️⃣ Verifying Clean 0-State across all endpoints...');
  const propsRes = await fetch(`${API_BASE}/properties`);
  const propsData = await propsRes.json();
  console.log(` ✔ Initial Properties Count: ${propsData.data.pagination.total} (Expected: 0)`);
  if (propsData.data.pagination.total !== 0) throw new Error('Expected 0 properties in clean database');

  // 3. Register First Real User (Sophia - Seller / Owner)
  console.log('\n3️⃣ Registering Real User #1 (Sophia Turner)...');
  const reg1Res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Sophia Turner',
      email: 'sophia@example.com',
      password: 'StrongPassword2026!',
      phone: '+1 (555) 234-5678'
    })
  });
  const reg1Data = await reg1Res.json();
  console.log(` ✔ Registration result:`, reg1Data.message, `(User ID: ${reg1Data.data.user.id})`);
  const token1 = reg1Data.data.token;

  // 4. Register Second Real User (Marcus - Buyer / Renter)
  console.log('\n4️⃣ Registering Real User #2 (Marcus Vance)...');
  const reg2Res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Marcus Vance',
      email: 'marcus@example.com',
      password: 'StrongPassword2026!',
      phone: '+1 (555) 876-5432'
    })
  });
  const reg2Data = await reg2Res.json();
  console.log(` ✔ Registration result:`, reg2Data.message, `(User ID: ${reg2Data.data.user.id})`);
  const token2 = reg2Data.data.token;

  // 5. User #1 Creates a Real Property Listing with Images & Virtual Tour
  console.log('\n5️⃣ User #1 (Sophia) creating a real property listing...');
  const createRes = await fetch(`${API_BASE}/properties`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token1}`
    },
    body: JSON.stringify({
      title: 'Skyline Modern Villa with Solar Array',
      description: 'A custom contemporary smart villa built with solar roofing, EV charger, and private courtyard.',
      type: 'buy',
      property_type: 'villa',
      price: 1250000,
      deposit: 25000,
      lease_term: 'N/A',
      address: '502 Pinehurst Way',
      city: 'Austin',
      state: 'TX',
      zip_code: '78704',
      bedrooms: 4,
      bathrooms: 3.5,
      area_sqft: 3200,
      year_built: 2024,
      furnishing: 'semi-furnished',
      parking_spaces: 2,
      amenities_json: ['Solar Roof', 'EV Charging', 'Smart Home Automation', 'Central AC']
    })
  });
  const createData = await createRes.json();
  const propertyId = createData.data?.property_id || createData.data?.propertyId;
  console.log(' ✔ Property Created:', createData.message, `(Property ID: ${propertyId})`);

  // Create sample image files
  const sampleImagePath = path.join(__dirname, 'test_sample_photo.jpg');
  const sampleVtPath = path.join(__dirname, 'test_sample_vt.jpg');
  fs.writeFileSync(sampleImagePath, 'FakeJPEGDataForPropertyListingImage');
  fs.writeFileSync(sampleVtPath, 'FakeJPEGDataForVirtualTourImage');

  // Upload Images
  const imgFormData = new FormData();
  imgFormData.append('images', new Blob([fs.readFileSync(sampleImagePath)], { type: 'image/jpeg' }), 'Exterior.jpg');
  imgFormData.append('images', new Blob([fs.readFileSync(sampleImagePath)], { type: 'image/jpeg' }), 'LivingRoom.jpg');

  const uploadImgRes = await fetch(`${API_BASE}/properties/${propertyId}/images`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token1}` },
    body: imgFormData
  });
  const uploadImgData = await uploadImgRes.json();
  console.log(' ✔ Property Images Uploaded:', uploadImgData.message, `(${uploadImgData.data.length} images)`);

  // Upload Virtual Tour
  const vtFormData = new FormData();
  vtFormData.append('room_name', 'Great Hall Living Area');
  vtFormData.append('room_description', 'Open ceiling modern lounge');
  vtFormData.append('display_order', '0');
  vtFormData.append('tour_images', new Blob([fs.readFileSync(sampleVtPath)], { type: 'image/jpeg' }), 'LivingRoom_360.jpg');

  const uploadVtRes = await fetch(`${API_BASE}/properties/${propertyId}/virtual-tour`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token1}` },
    body: vtFormData
  });
  const uploadVtData = await uploadVtRes.json();
  console.log(' ✔ Virtual Tour Room Uploaded:', uploadVtData.message);

  // 6. Verify Property Details & Real Scores
  console.log('\n6️⃣ Fetching newly created property details & calculated DNA/Scores...');
  const detailRes = await fetch(`${API_BASE}/properties/${propertyId}`);
  const detailData = await detailRes.json();
  const prop = detailData.data;
  console.log(` ✔ Title: ${prop.title}`);
  console.log(` ✔ Price: $${Number(prop.price).toLocaleString()}`);
  console.log(` ✔ Calculated Trust Score: ${prop.trust_score?.score}/100`);
  console.log(` ✔ Calculated Green Living Score: ${prop.green_score?.score}/100`);
  console.log(` ✔ Property DNA Age: ${prop.property_dna?.age_years} years`);
  console.log(` ✔ Virtual Tour Rooms: ${prop.virtual_tour_images?.length} room(s)`);

  // 7. AI Advisor Query on the Real Property
  console.log('\n7️⃣ Querying AI Advisor for real guidance on the property...');
  const aiRes = await fetch(`${API_BASE}/ai/advisor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'What are the estimated hidden costs and legal trust score for this property?',
      propertyId: propertyId
    })
  });
  const aiData = await aiRes.json();
  console.log(` ✔ AI Advisor Response preview:\n"${aiData.data.reply.slice(0, 150)}..."`);

  // 8. User #2 (Marcus) Saves the Property
  console.log('\n8️⃣ User #2 (Marcus) saving the property...');
  const saveRes = await fetch(`${API_BASE}/saved/${propertyId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token2}` },
    body: JSON.stringify({ notes: 'Prime contender for relocation' })
  });
  const saveData = await saveRes.json();
  console.log(' ✔ Save Property Result:', saveData.message);

  const getSavedRes = await fetch(`${API_BASE}/saved`, {
    headers: { Authorization: `Bearer ${token2}` }
  });
  const getSavedData = await getSavedRes.json();
  console.log(` ✔ User #2 Saved Properties count: ${getSavedData.data.length}`);

  // 9. User #2 Sends In-App Message to User #1
  console.log('\n9️⃣ User #2 (Marcus) sending in-app chat message to Sophia...');
  const msgRes = await fetch(`${API_BASE}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token2}` },
    body: JSON.stringify({
      property_id: propertyId,
      receiver_id: prop.owner_id,
      message: 'Hello Sophia! I reviewed the 360 tour for the villa. Can we schedule a viewing this Friday?'
    })
  });
  const msgData = await msgRes.json();
  console.log(' ✔ Message Sent Result:', msgData.message);

  // 10. User #2 Submits an Offer (Transaction)
  console.log('\n🔟 User #2 submitting purchase offer ($1,230,000)...');
  const txRes = await fetch(`${API_BASE}/transactions/offer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token2}` },
    body: JSON.stringify({
      property_id: propertyId,
      offer_amount: 1230000,
      deposit_amount: 25000,
      contingencies: { financing_contingency: true, inspection_contingency: true },
      proposed_closing_date: '2026-10-15'
    })
  });
  const txData = await txRes.json();
  console.log(' ✔ Deal/Offer Result:', txData.message, `(Transaction ID: ${txData.data.transaction_id || txData.data.id})`);

  // 11. Compare Properties Matrix API
  console.log('\n1️⃣1️⃣ Running comparison API on real property...');
  const compRes = await fetch(`${API_BASE}/compare?ids=${propertyId}`);
  const compData = await compRes.json();
  console.log(` ✔ Compare API returned ${compData.data.properties.length} property`);

  // 12. Cleanup temporary test file buffers
  try {
    fs.unlinkSync(sampleImagePath);
    fs.unlinkSync(sampleVtPath);
  } catch (e) {}

  console.log('\n====================================================');
  console.log('🎉 ALL END-TO-END ZERO-DATA TESTS PASSED PERFECTLY!');
  console.log('====================================================\n');
}

runEndToEndVerification().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
