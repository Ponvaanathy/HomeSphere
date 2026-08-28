const pool = require('../config/db');

async function runEndToEndListPropertyTest() {
  console.log('====================================================');
  console.log('🧪 TESTING HOMESPHERE "LIST PROPERTY" END-TO-END FLOW');
  console.log('====================================================\n');

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
    // 1. Authenticate Seller
    console.log('1️⃣ Authenticating Seller Account:');
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'seller@homesphere.com', password: 'password123' })
    }).then(r => r.json());

    test('Seller login successful', loginRes.success && !!loginRes.data?.token, `User: ${loginRes.data?.user?.name} (ID: ${loginRes.data?.user?.id})`);
    const token = loginRes.data?.token;
    const sellerId = loginRes.data?.user?.id;

    // 2. Submit Sale Property Listing
    console.log('\n2️⃣ Submitting New Sale Property Listing (Peelamedu):');
    const salePayload = {
      title: 'Emerald Sky 3BHK Penthouse Peelamedu',
      description: 'Exclusive 3BHK penthouse with panoramic terrace view and automated climate control.',
      category: 'residential',
      subcategory: 'penthouse',
      property_type: 'penthouse',
      type: 'sale',
      price: 13500000, // 1.35 Cr
      deposit: 0,
      currency: 'INR',
      address: '22 Avinashi Road, Near PSG Tech',
      locality: 'Peelamedu',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      zip_code: '641004',
      lat: 11.026700,
      lng: 77.002800,
      bedrooms: 3,
      bathrooms: 3,
      bhk: 3,
      area_sqft: 2450,
      year_built: 2024,
      furnishing: 'fully-furnished',
      parking_spaces: 2,
      legal_status: '100% Clear Freehold Title Verified',
      structural_notes: 'Seismic Grade 4 post-tension concrete',
      amenities_json: ['24/7 Security', 'EV Charging Station', 'Swimming Pool', 'Solar Panels', 'Power Backup'],
      primary_image_url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80'
    };

    const createSaleRes = await fetch('http://localhost:5000/api/properties', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(salePayload)
    }).then(r => r.json());

    test('POST /api/properties returned HTTP 201 with success', createSaleRes.success && !!createSaleRes.data?.property_id, `Created Property ID: #${createSaleRes.data?.property_id}`);
    const salePropId = createSaleRes.data?.property_id;

    // 3. Verify MySQL properties Table Record
    console.log('\n3️⃣ Verifying MySQL properties Record:');
    const [propRows] = await pool.query('SELECT * FROM properties WHERE id = ?', [salePropId]);
    test('MySQL properties table has newly inserted record', propRows.length === 1, `Title: "${propRows[0]?.title}"`);
    test('Owner ID correctly linked to logged-in user', propRows[0]?.owner_id === sellerId, `Owner ID: ${propRows[0]?.owner_id}`);
    test('Price and Area recorded accurately', Number(propRows[0]?.price) === 13500000 && propRows[0]?.area_sqft === 2450, `Price: ₹${propRows[0]?.price}, Area: ${propRows[0]?.area_sqft} sqft`);
    test('GPS Coordinates stored correctly for Map integration', Math.abs(Number(propRows[0]?.lat) - 11.0267) < 0.001 && Math.abs(Number(propRows[0]?.lng) - 77.0028) < 0.001, `Lat: ${propRows[0]?.lat}, Lng: ${propRows[0]?.lng}`);
    test('Listing status is "active"', propRows[0]?.status === 'active', `Status: ${propRows[0]?.status}`);

    // 4. Verify Associated Decision Tables Records
    console.log('\n4️⃣ Verifying Decision Intelligence Tables:');
    const [imgRows] = await pool.query('SELECT * FROM property_images WHERE property_id = ?', [salePropId]);
    test('Primary Image inserted in property_images table', imgRows.length > 0 && imgRows[0].is_primary === 1, `URL: ${imgRows[0]?.image_url}`);

    const [trustRows] = await pool.query('SELECT * FROM trust_scores WHERE property_id = ?', [salePropId]);
    test('Initial Trust Score record generated in trust_scores', trustRows.length > 0 && trustRows[0].score >= 80, `Trust Score: ${trustRows[0]?.score}/100`);

    const [lifeRows] = await pool.query('SELECT * FROM life_scores WHERE property_id = ?', [salePropId]);
    test('Locality LifeScore record generated in life_scores', lifeRows.length > 0 && lifeRows[0].score >= 80, `LifeScore: ${lifeRows[0]?.score}/100`);

    const [costRows] = await pool.query('SELECT * FROM hidden_costs WHERE property_id = ?', [salePropId]);
    test('Hidden Costs record generated in hidden_costs', costRows.length > 0 && Number(costRows[0].total_est_first_year) > 0, `Total Outlay: ₹${costRows[0]?.total_est_first_year}`);

    const [dnaRows] = await pool.query('SELECT * FROM property_dna WHERE property_id = ?', [salePropId]);
    test('Property DNA record generated in property_dna', dnaRows.length > 0 && dnaRows[0].legal_status.includes('Verified'), `Status: ${dnaRows[0]?.legal_status}`);

    // 5. Verify Property Visibility in Marketplace Discovery
    console.log('\n5️⃣ Verifying Marketplace Discovery Endpoints:');
    const detailsRes = await fetch(`http://localhost:5000/api/properties/${salePropId}`).then(r => r.json());
    test('GET /api/properties/:id returns full property specs', detailsRes.success && detailsRes.data?.id === salePropId, `Title: ${detailsRes.data?.title}`);

    const analyticsRes = await fetch(`http://localhost:5000/api/properties/${salePropId}/analytics`).then(r => r.json());
    test('GET /api/properties/:id/analytics returns decision engine metrics', analyticsRes.success && !!analyticsRes.data?.hiddenCosts && !!analyticsRes.data?.lifeScore && !!analyticsRes.data?.capitalForecast, `Stamp Duty: ₹${analyticsRes.data?.hiddenCosts?.stampDuty}`);

    const nearbyRes = await fetch('http://localhost:5000/api/properties/nearby?lat=11.0267&lng=77.0028&radius=5').then(r => r.json());
    test('Property appears in Live Map / GPS Nearby query', nearbyRes.success && nearbyRes.data?.properties?.some(p => p.id === salePropId), `Found in Peelamedu 5km radius`);

    const myListingsRes = await fetch('http://localhost:5000/api/properties/seller/my-listings', {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(r => r.json());
    test('Property appears in Seller\'s My Listings', myListingsRes.success && myListingsRes.data?.some(p => p.id === salePropId), `Seller total listings: ${myListingsRes.data?.length}`);

    // 6. Submit Rental Property Listing
    console.log('\n6️⃣ Submitting Rental Property Listing (RS Puram):');
    const rentPayload = {
      title: 'Cozy 2BHK Garden Apartment RS Puram',
      description: 'Well-ventilated 2BHK apartment in serene residential avenue of RS Puram.',
      category: 'residential',
      subcategory: 'apartment',
      property_type: 'apartment',
      type: 'rent',
      price: 28000,
      deposit: 150000,
      currency: 'INR',
      address: '45 West Club Road',
      locality: 'RS Puram',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      zip_code: '641002',
      lat: 11.009800,
      lng: 76.949200,
      bedrooms: 2,
      bathrooms: 2,
      bhk: 2,
      area_sqft: 1250,
      year_built: 2022,
      furnishing: 'semi-furnished',
      parking_spaces: 1,
      amenities_json: ['24/7 Security', 'Power Backup', 'Covered Parking']
    };

    const createRentRes = await fetch('http://localhost:5000/api/properties', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(rentPayload)
    }).then(r => r.json());

    test('POST /api/properties for Rental returns HTTP 201', createRentRes.success && !!createRentRes.data?.property_id, `Rental Property ID: #${createRentRes.data?.property_id}`);
    const rentPropId = createRentRes.data?.property_id;

    const rentNearbyRes = await fetch('http://localhost:5000/api/properties/nearby?lat=11.0098&lng=76.9492&radius=5&type=rent').then(r => r.json());
    test('Rental listing appears in Rent filter on Live Map', rentNearbyRes.success && rentNearbyRes.data?.properties?.some(p => p.id === rentPropId), `Found in RS Puram rent listings`);

    // 7. Validation Tests
    console.log('\n7️⃣ Field Validation & Error Prevention:');
    const invalidRes1 = await fetch('http://localhost:5000/api/properties', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ title: 'Missing price and address' })
    }).then(r => r.json());

    test('Validation: Rejects missing price and address with HTTP 400', invalidRes1.success === false, `Message: "${invalidRes1.message}"`);

    const invalidRes2 = await fetch('http://localhost:5000/api/properties', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        title: 'Negative price test',
        price: -50000,
        area_sqft: 1200,
        address: '10 Test Street',
        city: 'Coimbatore'
      })
    }).then(r => r.json());

    test('Validation: Rejects negative price with HTTP 400', invalidRes2.success === false, `Message: "${invalidRes2.message}"`);

    console.log('\n====================================================');
    console.log(`📊 RESULTS: ${passed}/${total} Tests Passed (${Math.round((passed / total) * 100)}%)`);
    console.log('====================================================\n');

    process.exit(passed === total ? 0 : 1);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runEndToEndListPropertyTest();
