const pool = require('../config/db');

async function runClassificationTests() {
  console.log('================================================================');
  console.log('🧪 TESTING HOMESPHERE MARKETPLACE CLASSIFICATION & GEOCODING');
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
    // 0. Authenticate
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'seller@homesphere.com', password: 'password123' })
    }).then(r => r.json());

    test('Authentication successful', loginRes.success && !!loginRes.data?.token, `User: ${loginRes.data?.user?.name}`);
    const token = loginRes.data?.token;
    const sellerId = loginRes.data?.user?.id;

    // TEST 1: Residential -> Individual Home (Typed Location Only)
    console.log('\n1️⃣ TEST 1: Residential -> Individual Home (Typed Location Only):');
    const indHomePayload = {
      title: '3 BHK Individual Home in Peelamedu',
      description: 'Spacious standalone independent home with private compound and car porch.',
      category: 'residential',
      property_subtype: 'individual_home',
      type: 'sale',
      price: 8500000,
      currency: 'INR',
      address: '42 Bharathi Colony',
      locality: 'Peelamedu',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      zip_code: '641004',
      bedrooms: 3,
      bathrooms: 3,
      bhk: 3,
      area_sqft: 1850,
      plot_area_sqft: 2200,
      total_floors: 2,
      furnishing: 'semi-furnished',
      parking_spaces: 1,
      amenities_json: ['24/7 Security', 'Power Backup']
    };

    const res1 = await fetch('http://localhost:5000/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(indHomePayload)
    }).then(r => r.json());

    test('TEST 1: Property created without user coordinates', res1.success && !!res1.data?.property_id, `ID: #${res1.data?.property_id}`);
    const propId1 = res1.data?.property_id;

    const [db1] = await pool.query('SELECT * FROM properties WHERE id = ?', [propId1]);
    test('TEST 1: MySQL category = residential, subcategory = individual_home', db1[0]?.category === 'residential' && db1[0]?.subcategory === 'individual_home', `Category: ${db1[0]?.category}, Subcategory: ${db1[0]?.subcategory}`);
    test('TEST 1: Automatic backend geocoding populated coordinates', Number(db1[0]?.lat) > 0 && Number(db1[0]?.lng) > 0, `Lat: ${db1[0]?.lat}, Lng: ${db1[0]?.lng}`);
    test('TEST 1: Plot area and stories recorded', db1[0]?.plot_area_sqft === 2200 && db1[0]?.total_floors === 2, `Plot Area: ${db1[0]?.plot_area_sqft} sqft, Floors: ${db1[0]?.total_floors}`);

    // TEST 2: Residential -> Gated Community Home (CasaGrand XYZ, Villa 12)
    console.log('\n2️⃣ TEST 2: Residential -> Gated Community Home (CasaGrand XYZ - Villa 12):');
    const gatedHome1Payload = {
      title: 'CasaGrand XYZ Luxury Villa 12',
      description: 'Exclusive 4BHK villa in premium gated development with clubhouse and central park.',
      category: 'residential',
      property_subtype: 'gated_community_home',
      project_name: 'CasaGrand XYZ',
      community_name: 'CasaGrand XYZ',
      community_type: 'Villa Community',
      unit_number: 'Villa 12',
      type: 'sale',
      price: 14500000,
      currency: 'INR',
      address: 'Clubhouse Avenue, CasaGrand XYZ',
      locality: 'Peelamedu',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      zip_code: '641004',
      bedrooms: 4,
      bathrooms: 4,
      bhk: 4,
      area_sqft: 2800,
      plot_area_sqft: 3000,
      furnishing: 'fully-furnished',
      parking_spaces: 2,
      amenities_json: ['24/7 Security', 'Clubhouse & Community Hall', 'Swimming Pool', 'EV Charging Station']
    };

    const res2 = await fetch('http://localhost:5000/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(gatedHome1Payload)
    }).then(r => r.json());

    test('TEST 2: Gated Community Villa 12 created', res2.success && !!res2.data?.property_id, `ID: #${res2.data?.property_id}`);
    const propId2 = res2.data?.property_id;

    const [db2] = await pool.query('SELECT * FROM properties WHERE id = ?', [propId2]);
    test('TEST 2: Project name and unit number saved in MySQL', db2[0]?.project_name === 'CasaGrand XYZ' && db2[0]?.unit_number === 'Villa 12', `Project: ${db2[0]?.project_name}, Unit: ${db2[0]?.unit_number}`);

    // TEST 3: Residential -> Gated Community Home (CasaGrand XYZ, Villa 13)
    console.log('\n3️⃣ TEST 3: Gated Community Home (CasaGrand XYZ - Villa 13 in same project):');
    const gatedHome2Payload = {
      title: 'CasaGrand XYZ Corner Villa 13',
      description: 'Corner 4BHK villa inside CasaGrand XYZ development.',
      category: 'residential',
      property_subtype: 'gated_community_home',
      project_name: 'CasaGrand XYZ',
      community_name: 'CasaGrand XYZ',
      community_type: 'Villa Community',
      unit_number: 'Villa 13',
      type: 'sale',
      price: 15500000,
      currency: 'INR',
      address: 'North Boulevard, CasaGrand XYZ',
      locality: 'Peelamedu',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      zip_code: '641004',
      bedrooms: 4,
      bathrooms: 4,
      bhk: 4,
      area_sqft: 3100,
      plot_area_sqft: 3400,
      furnishing: 'fully-furnished',
      parking_spaces: 2
    };

    const res3 = await fetch('http://localhost:5000/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(gatedHome2Payload)
    }).then(r => r.json());

    test('TEST 3: Gated Community Villa 13 created', res3.success && !!res3.data?.property_id, `ID: #${res3.data?.property_id}`);
    const propId3 = res3.data?.property_id;

    // Verify multiple properties in same project
    const [projectProps] = await pool.query('SELECT id, title, project_name, unit_number FROM properties WHERE project_name = ?', ['CasaGrand XYZ']);
    test('TEST 3: Multiple distinct properties exist under same project CasaGrand XYZ', projectProps.length >= 2, `Found ${projectProps.length} units in project (IDs: ${projectProps.map(p => '#' + p.id + ' ' + p.unit_number).join(', ')})`);

    // TEST 4: Residential -> Apartment
    console.log('\n4️⃣ TEST 4: Residential -> Apartment with Tower & Floor specs:');
    const aptPayload = {
      title: 'Prestige Greenwoods 3BHK Apartment',
      description: 'Spacious 3BHK apartment on 4th floor of Prestige Greenwoods.',
      category: 'residential',
      property_subtype: 'apartment',
      project_name: 'Prestige Greenwoods',
      unit_number: 'Flat 402',
      floor_number: 4,
      total_floors: 14,
      type: 'sale',
      price: 9200000,
      currency: 'INR',
      address: '15 Race Course Road',
      locality: 'Race Course',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      zip_code: '641018',
      bedrooms: 3,
      bathrooms: 3,
      bhk: 3,
      area_sqft: 1650,
      furnishing: 'semi-furnished',
      parking_spaces: 1
    };

    const res4 = await fetch('http://localhost:5000/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(aptPayload)
    }).then(r => r.json());

    test('TEST 4: Apartment created', res4.success && !!res4.data?.property_id, `ID: #${res4.data?.property_id}`);
    const propId4 = res4.data?.property_id;
    const [db4] = await pool.query('SELECT * FROM properties WHERE id = ?', [propId4]);
    test('TEST 4: Apartment floor and total floors recorded', db4[0]?.floor_number === 4 && db4[0]?.total_floors === 14, `Floor: ${db4[0]?.floor_number} of ${db4[0]?.total_floors}`);

    // TEST 5: Land / Plot -> Residential Plot
    console.log('\n5️⃣ TEST 5: Land / Plot -> Residential Plot:');
    const plotPayload = {
      title: 'DTCP Approved Residential Plot Saravanampatti',
      description: 'North-East corner residential plot with 30ft black top road.',
      category: 'land_plots',
      property_subtype: 'residential_plot',
      project_name: 'Green Meadows Layout',
      unit_number: 'Plot No 45',
      facing_direction: 'North-East',
      type: 'sale',
      price: 4800000,
      currency: 'INR',
      address: 'Near KGISL IT Park',
      locality: 'Saravanampatti',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      zip_code: '641035',
      area_sqft: 2400,
      plot_area_sqft: 2400
    };

    const res5 = await fetch('http://localhost:5000/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(plotPayload)
    }).then(r => r.json());

    test('TEST 5: Land / Plot created', res5.success && !!res5.data?.property_id, `ID: #${res5.data?.property_id}`);
    const propId5 = res5.data?.property_id;
    const [db5] = await pool.query('SELECT * FROM properties WHERE id = ?', [propId5]);
    test('TEST 5: Facing direction and category saved', db5[0]?.category === 'land_plots' && db5[0]?.facing_direction === 'North-East', `Category: ${db5[0]?.category}, Facing: ${db5[0]?.facing_direction}`);

    // TEST 6: Commercial -> Office Space
    console.log('\n6️⃣ TEST 6: Commercial -> Office Space:');
    const commPayload = {
      title: 'TIDEL Park Tech Zone Plug & Play Office',
      description: 'Fully furnished commercial office space in prime tech corridor.',
      category: 'commercial',
      property_subtype: 'office_space',
      project_name: 'TIDEL Park Tech Zone',
      unit_number: 'Suite 305',
      floor_number: 3,
      total_floors: 8,
      type: 'lease',
      price: 150000, // ₹1.5L/mo
      deposit: 900000,
      currency: 'INR',
      address: 'Avinashi Road, TIDEL Park',
      locality: 'TIDEL Park',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      zip_code: '641014',
      area_sqft: 3200,
      bathrooms: 2,
      parking_spaces: 4
    };

    const res6 = await fetch('http://localhost:5000/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(commPayload)
    }).then(r => r.json());

    test('TEST 6: Commercial property created', res6.success && !!res6.data?.property_id, `ID: #${res6.data?.property_id}`);

    // TEST 7: Map & GPS Discovery of Auto-Geocoded Properties
    console.log('\n7️⃣ TEST 7: Map & GPS Discovery of Auto-Geocoded Properties:');
    const mapNearPeelamedu = await fetch('http://localhost:5000/api/properties/nearby?lat=11.0267&lng=77.0028&radius=5').then(r => r.json());
    test('TEST 7: CasaGrand XYZ villas appear in Peelamedu map query', mapNearPeelamedu.success && mapNearPeelamedu.data?.properties?.some(p => p.id === propId2), `Found Villa 12 in Peelamedu map radius`);
    test('TEST 7: Standalone Individual Home appears in Peelamedu map query', mapNearPeelamedu.data?.properties?.some(p => p.id === propId1), `Found Individual Home in Peelamedu map radius`);

    // TEST 8: Subtype & Search Filters
    console.log('\n8️⃣ TEST 8: Subtype & NLP Search Filters:');
    const gatedFilterRes = await fetch('http://localhost:5000/api/properties?subcategory=gated_community_home').then(r => r.json());
    test('TEST 8: Filter by subcategory=gated_community_home returns gated community homes', gatedFilterRes.success && gatedFilterRes.data?.properties?.length >= 2, `Found ${gatedFilterRes.data?.properties?.length} gated community listings`);

    const searchProjectRes = await fetch('http://localhost:5000/api/properties?q=CasaGrand%20XYZ').then(r => r.json());
    test('TEST 8: Search by project name "CasaGrand XYZ" finds project units', searchProjectRes.success && searchProjectRes.data?.properties?.length >= 2, `Found ${searchProjectRes.data?.properties?.length} units under CasaGrand XYZ`);

    console.log('\n================================================================');
    console.log(`📊 RESULTS: ${passed}/${total} Tests Passed (${Math.round((passed / total) * 100)}%)`);
    console.log('================================================================\n');

    await pool.end();
  } catch (err) {
    console.error('Test execution error:', err);
    try { await pool.end(); } catch (e) {}
  }
}


runClassificationTests();
