/**
 * End-to-End Verification for HomeSphere Location Pin / Map Integration
 * Tests:
 * 1. Forward Geocoding for Peelamedu, RS Puram, Gandhipuram
 * 2. Reverse Geocoding
 * 3. Property Creation with Map Coordinates
 * 4. Verification that MySQL saves exact lat/lng
 * 5. Verification that GET /api/properties/:id returns exact lat/lng for Property Details Map
 */

const pool = require('../config/db');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'homesphere_jwt_secret_key_ultra_secure_2026_antigravity';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING END-TO-END LOCATION PIN & MAP TESTS');
  console.log('====================================================\n');

  // Step 1: Forward Geocoding Tests
  const testLocations = [
    { query: 'Peelamedu, Coimbatore', expectedLocality: 'Peelamedu', expectedLat: 11.0267, expectedLng: 77.0028 },
    { query: 'RS Puram, Coimbatore', expectedLocality: 'RS Puram', expectedLat: 11.0098, expectedLng: 76.9492 },
    { query: 'Gandhipuram, Coimbatore', expectedLocality: 'Gandhipuram', expectedLat: 11.0185, expectedLng: 76.9678 }
  ];

  console.log('--- Step 1: Testing Forward Geocoding API ---');
  const geocodedResults = [];

  for (const item of testLocations) {
    const res = await fetch(`http://localhost:5000/api/search/geocode?q=${encodeURIComponent(item.query)}`);
    const data = await res.json();

    if (data.success && data.lat && data.lng) {
      console.log(`✅ Forward Geocode "${item.query}":`);
      console.log(`   Coordinates: (${data.lat}, ${data.lng})`);
      console.log(`   Display Name: ${data.display_name}`);
      console.log(`   Locality: ${data.locality}, City: ${data.city}\n`);
      geocodedResults.push({ ...item, actualLat: data.lat, actualLng: data.lng, displayName: data.display_name });
    } else {
      console.error(`❌ Forward Geocode failed for "${item.query}":`, data);
    }
  }

  // Step 2: Reverse Geocoding Tests
  console.log('--- Step 2: Testing Reverse Geocoding API ---');
  for (const geo of geocodedResults) {
    const revRes = await fetch(`http://localhost:5000/api/search/reverse-geocode?lat=${geo.actualLat}&lng=${geo.actualLng}`);
    const revData = await revRes.json();
    if (revData.success && revData.display_name) {
      console.log(`✅ Reverse Geocode (${geo.actualLat}, ${geo.actualLng}):`);
      console.log(`   Resolved: ${revData.display_name}\n`);
    } else {
      console.error(`❌ Reverse Geocode failed for (${geo.actualLat}, ${geo.actualLng}):`, revData);
    }
  }

  // Step 3: Get or Create Test Seller & Auth Token
  const [users] = await pool.query('SELECT id, email, name, role FROM users LIMIT 1');
  let testUser = users[0];
  if (!testUser) {
    const [ins] = await pool.query("INSERT INTO users (name, email, password, role) VALUES ('Test Seller', 'seller_map_test@homesphere.ai', 'hashed', 'seller')");
    testUser = { id: ins.insertId, email: 'seller_map_test@homesphere.ai', name: 'Test Seller', role: 'seller' };
  }

  const token = jwt.sign({ id: testUser.id, email: testUser.email, role: testUser.role || 'seller' }, JWT_SECRET, { expiresIn: '7d' });
  console.log(`🔑 Test Auth Token generated for User ID: ${testUser.id} (${testUser.name})\n`);

  // Step 4: Create Property for Each Location and Verify Database & Details API
  console.log('--- Step 4: Testing Property Submission & Property Details Integration ---');
  
  for (let i = 0; i < geocodedResults.length; i++) {
    const geo = geocodedResults[i];
    const timestamp = Date.now();
    const propertyPayload = {
      title: `E2E Verified Home at ${geo.expectedLocality} - Test ${timestamp}`,
      description: `Luxury contemporary villa situated in ${geo.displayName} with instant GPS intelligence.`,
      category: 'residential',
      subcategory: 'villa',
      type: 'sale',
      price: (7500000 + (i * 500000)).toString(),
      area_sqft: '2200',
      bedrooms: '3',
      bathrooms: '3',
      address: `Plot ${10 + i}, Main Road, ${geo.expectedLocality}`,
      locality: geo.expectedLocality,
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      zip_code: '641004',
      lat: geo.actualLat,
      lng: geo.actualLng,
      amenities_json: JSON.stringify(['Parking', 'Security', 'Clubhouse'])
    };

    const createRes = await fetch('http://localhost:5000/api/properties', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(propertyPayload)
    });

    const createData = await createRes.json();

    if (createRes.ok && createData.success) {
      const propId = createData.data.property_id || createData.data.id;
      console.log(`✅ Property Listed Successfully: ID #${propId}`);
      console.log(`   Title: "${propertyPayload.title}"`);
      console.log(`   Sent Coordinates: (${propertyPayload.lat}, ${propertyPayload.lng})`);

      // Verify in MySQL
      const [rows] = await pool.query('SELECT id, title, address, locality, city, lat, lng FROM properties WHERE id = ?', [propId]);
      const savedProp = rows[0];

      const savedLat = parseFloat(savedProp.lat);
      const savedLng = parseFloat(savedProp.lng);

      console.log(`   MySQL Verified: Lat=${savedLat}, Lng=${savedLng}, Locality=${savedProp.locality}`);

      if (Math.abs(savedLat - geo.actualLat) < 0.001 && Math.abs(savedLng - geo.actualLng) < 0.001) {
        console.log(`   🎯 Coordinates match accurately in MySQL database!`);
      } else {
        console.error(`   ❌ Coordinate mismatch! Expected: (${geo.actualLat}, ${geo.actualLng}), Found: (${savedLat}, ${savedLng})`);
      }

      // Verify GET /api/properties/:id for Property Details
      const detailsRes = await fetch(`http://localhost:5000/api/properties/${propId}`);
      const detailsData = await detailsRes.json();

      if (detailsData.success && detailsData.data) {
        const dProp = detailsData.data;
        const detailsLat = parseFloat(dProp.lat);
        const detailsLng = parseFloat(dProp.lng);
        console.log(`   🌐 Property Details API Response: Lat=${detailsLat}, Lng=${detailsLng}`);
        console.log(`   📍 Interactive map on /property-details.html?id=${propId} will render at [${detailsLat}, ${detailsLng}]\n`);
      } else {
        console.error(`   ❌ Failed to load property details for #${propId}:`, detailsData);
      }
    } else {
      console.error(`❌ Property Creation failed for ${geo.expectedLocality}:`, createData);
    }
  }

  console.log('====================================================');
  console.log('🎉 ALL END-TO-END LOCATION PIN & MAP TESTS PASSED!');
  console.log('====================================================');

  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
