const pool = require('../config/db');

async function runMapLocationTests() {
  console.log('========================================================================');
  console.log('🗺️ TESTING LIVE MAP LOCATION & NEARBY PROPERTY RECOMMENDATIONS ENGINE');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name, condition, details = '') {
    if (condition) {
      console.log(`✅ PASS: ${name}`);
      if (details) console.log(`   ${details}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${name}`);
      if (details) console.error(`   ${details}`);
      failed++;
    }
  }

  // ------------------------------------------------------------------------
  // 1. GEOCODING ENDPOINT TEST (SEARCH LOCATION)
  // ------------------------------------------------------------------------
  console.log('1️⃣ TESTING BACKEND FORWARD GEOCODING API (/api/search/geocode):');

  // Test Peelamedu
  const geoPeelamedu = await fetch('http://localhost:5000/api/search/geocode?q=Peelamedu,%20Coimbatore').then(r => r.json());
  test('Geocode "Peelamedu, Coimbatore" returns valid coordinates', 
    geoPeelamedu.success && Math.abs(geoPeelamedu.lat - 11.0267) < 0.05 && Math.abs(geoPeelamedu.lng - 77.0028) < 0.05,
    `Lat: ${geoPeelamedu.lat}, Lng: ${geoPeelamedu.lng}, Name: "${geoPeelamedu.display_name}"`
  );

  // Test RS Puram
  const geoRsPuram = await fetch('http://localhost:5000/api/search/geocode?q=RS%20Puram,%20Coimbatore').then(r => r.json());
  test('Geocode "RS Puram, Coimbatore" returns distinct coordinates',
    geoRsPuram.success && Math.abs(geoRsPuram.lat - 11.0098) < 0.05 && Math.abs(geoRsPuram.lng - 76.9492) < 0.05,
    `Lat: ${geoRsPuram.lat}, Lng: ${geoRsPuram.lng}, Name: "${geoRsPuram.display_name}"`
  );

  // Test Gandhipuram
  const geoGandhipuram = await fetch('http://localhost:5000/api/search/geocode?q=Gandhipuram,%20Coimbatore').then(r => r.json());
  test('Geocode "Gandhipuram, Coimbatore" returns distinct coordinates',
    geoGandhipuram.success && Math.abs(geoGandhipuram.lat - 11.0185) < 0.05 && Math.abs(geoGandhipuram.lng - 76.9678) < 0.05,
    `Lat: ${geoGandhipuram.lat}, Lng: ${geoGandhipuram.lng}, Name: "${geoGandhipuram.display_name}"`
  );

  // Test Singanallur
  const geoSinganallur = await fetch('http://localhost:5000/api/search/geocode?q=Singanallur,%20Coimbatore').then(r => r.json());
  test('Geocode "Singanallur, Coimbatore" returns distinct coordinates',
    geoSinganallur.success && Math.abs(geoSinganallur.lat - 11.0024) < 0.05 && Math.abs(geoSinganallur.lng - 77.0195) < 0.05,
    `Lat: ${geoSinganallur.lat}, Lng: ${geoSinganallur.lng}, Name: "${geoSinganallur.display_name}"`
  );

  // ------------------------------------------------------------------------
  // 2. REVERSE GEOCODING TEST (MAP CLICK / CURRENT LOCATION)
  // ------------------------------------------------------------------------
  console.log('\n2️⃣ TESTING BACKEND REVERSE GEOCODING API (/api/search/reverse-geocode):');

  const revPeelamedu = await fetch('http://localhost:5000/api/search/reverse-geocode?lat=11.0267&lng=77.0028').then(r => r.json());
  test('Reverse geocode (11.0267, 77.0028) resolves readable location',
    revPeelamedu.success && !!revPeelamedu.display_name,
    `Resolved: "${revPeelamedu.display_name}"`
  );

  const revRsPuram = await fetch('http://localhost:5000/api/search/reverse-geocode?lat=11.0098&lng=76.9492').then(r => r.json());
  test('Reverse geocode (11.0098, 76.9492) resolves readable RS Puram location',
    revRsPuram.success && !!revRsPuram.display_name,
    `Resolved: "${revRsPuram.display_name}"`
  );

  // ------------------------------------------------------------------------
  // 3. GEOGRAPHIC NEARBY PROPERTIES SEARCH & HAVERSINE DISTANCE
  // ------------------------------------------------------------------------
  console.log('\n3️⃣ TESTING GEOGRAPHIC NEARBY PROPERTIES SEARCH & DISTANCE:');

  // Query Peelamedu 5 km
  const peelamedu5km = await fetch('http://localhost:5000/api/properties/nearby?lat=11.0267&lng=77.0028&radius=5').then(r => r.json());
  test('Peelamedu 5 km returns active database properties',
    peelamedu5km.success && peelamedu5km.data?.properties?.length > 0,
    `Count: ${peelamedu5km.data?.properties?.length} properties within 5 km`
  );

  const propsP5 = peelamedu5km.data?.properties || [];
  const allWithin5km = propsP5.every(p => p.distance_km <= 5.0 && p.distance_km >= 0);
  test('Every returned property is strictly within 5.0 km geographic distance',
    allWithin5km,
    `Sample distances: ${propsP5.slice(0, 4).map(p => `${p.distance_km} km`).join(', ')}`
  );

  const isSortedAsc = propsP5.every((p, i) => i === 0 || p.distance_km >= propsP5[i - 1].distance_km);
  test('Nearby properties are accurately sorted by distance ascending', isSortedAsc);

  // ------------------------------------------------------------------------
  // 4. MULTI-LOCATION DYNAMIC CHANGEOVER TEST
  // ------------------------------------------------------------------------
  console.log('\n4️⃣ TESTING MULTI-LOCATION CHANGE: PEELAMEDU vs RS PURAM:');

  // Query RS Puram 3 km
  const rsPuram3km = await fetch('http://localhost:5000/api/properties/nearby?lat=11.0098&lng=76.9492&radius=3').then(r => r.json());
  test('RS Puram 3 km returns properties around RS Puram',
    rsPuram3km.success && rsPuram3km.data?.properties?.length > 0,
    `Count: ${rsPuram3km.data?.properties?.length} properties within 3 km`
  );

  const propsRS = rsPuram3km.data?.properties || [];
  const rsIds = new Set(propsRS.map(p => p.id));
  const peelameduTopId = propsP5[0]?.id;
  const isDifferent = !propsRS.some(p => p.id === peelameduTopId && p.distance_km < 1.0);

  test('Location change from Peelamedu to RS Puram produces geographically distinct results',
    isDifferent,
    `RS Puram closest: #${propsRS[0]?.id} (${propsRS[0]?.title}) at ${propsRS[0]?.distance_km} km`
  );

  // ------------------------------------------------------------------------
  // 5. RADIUS EXPANSION FILTER (1km -> 3km -> 5km -> 10km)
  // ------------------------------------------------------------------------
  console.log('\n5️⃣ TESTING RADIUS EXPANSION (1km, 3km, 5km, 10km):');

  const p1km = await fetch('http://localhost:5000/api/properties/nearby?lat=11.0267&lng=77.0028&radius=1').then(r => r.json());
  const p3km = await fetch('http://localhost:5000/api/properties/nearby?lat=11.0267&lng=77.0028&radius=3').then(r => r.json());
  const p5km = await fetch('http://localhost:5000/api/properties/nearby?lat=11.0267&lng=77.0028&radius=5').then(r => r.json());
  const p10km = await fetch('http://localhost:5000/api/properties/nearby?lat=11.0267&lng=77.0028&radius=10').then(r => r.json());

  const c1 = p1km.data?.properties?.length || 0;
  const c3 = p3km.data?.properties?.length || 0;
  const c5 = p5km.data?.properties?.length || 0;
  const c10 = p10km.data?.properties?.length || 0;

  test('Geographic radius expansion monotonically expands result set (1km <= 3km <= 5km <= 10km)',
    c1 <= c3 && c3 <= c5 && c5 <= c10,
    `1km: ${c1} props -> 3km: ${c3} props -> 5km: ${c5} props -> 10km: ${c10} props`
  );

  // ------------------------------------------------------------------------
  // 6. LISTING TYPE & PROPERTY CATEGORY FILTERS
  // ------------------------------------------------------------------------
  console.log('\n6️⃣ TESTING LISTING TYPE & CATEGORY FILTERS ON NEARBY RESULTS:');

  const rentOnly = await fetch('http://localhost:5000/api/properties/nearby?lat=11.0267&lng=77.0028&radius=5&type=rent').then(r => r.json());
  const allRent = rentOnly.data?.properties?.every(p => p.type === 'rent');
  test('Listing type filter: "rent" returns rent listings exclusively',
    allRent && rentOnly.data?.properties?.length > 0,
    `Returned ${rentOnly.data?.properties?.length} rent properties`
  );

  const buyOnly = await fetch('http://localhost:5000/api/properties/nearby?lat=11.0267&lng=77.0028&radius=5&type=buy').then(r => r.json());
  const allBuy = buyOnly.data?.properties?.every(p => p.type === 'buy' || p.type === 'sale');
  test('Listing type filter: "buy" returns sale/buy listings exclusively',
    allBuy && buyOnly.data?.properties?.length > 0,
    `Returned ${buyOnly.data?.properties?.length} sale/buy properties`
  );

  const commOnly = await fetch('http://localhost:5000/api/properties/nearby?lat=11.0267&lng=77.0028&radius=5&category=commercial').then(r => r.json());
  test('Category filter: "commercial" returns commercial properties within radius',
    commOnly.success && commOnly.data?.properties?.length > 0,
    `Returned ${commOnly.data?.properties?.length} commercial properties`
  );

  // ------------------------------------------------------------------------
  // 7. RECOMMENDATION SCORING ENGINE
  // ------------------------------------------------------------------------
  console.log('\n7️⃣ TESTING NEARBY RECOMMENDATION SCORING & RANKING:');

  const recs = peelamedu5km.data?.recommended_properties || [];
  test('API returns top recommended properties array',
    recs.length > 0 && recs.length <= 5,
    `Top recommendations count: ${recs.length}`
  );

  test('Recommended properties have dynamic recommendation_score computed',
    recs.every(p => p.recommendation_score >= 50 && p.recommendation_score <= 100),
    `Scores: ${recs.map(p => `#${p.id} (Score: ${p.recommendation_score}, Dist: ${p.distance_km}km, Trust: ${p.trust_score})`).join(' | ')}`
  );

  // ------------------------------------------------------------------------
  // 8. DATABASE PROPERTY COORDINATES INTEGRITY
  // ------------------------------------------------------------------------
  console.log('\n8️⃣ TESTING DATABASE COORDINATES INTEGRITY:');

  const [allDbProps] = await pool.query('SELECT id, title, lat, lng, status FROM properties WHERE status = "active"');
  const invalidCoords = allDbProps.filter(p => !p.lat || !p.lng || p.lat === 0 || p.lng === 0 || isNaN(Number(p.lat)) || isNaN(Number(p.lng)));
  test('Zero active properties in MySQL have null or zero coordinates',
    invalidCoords.length === 0,
    `Total active properties checked: ${allDbProps.length}`
  );

  // ------------------------------------------------------------------------
  // 9. FRONTEND JS SYNTAX & LINK INTEGRITY
  // ------------------------------------------------------------------------
  console.log('\n9️⃣ TESTING FRONTEND JAVASCRIPT SYNTAX:');

  const { execSync } = require('child_process');
  let jsSyntaxPass = false;
  try {
    execSync('node -c js/map-search.js', { stdio: 'pipe' });
    jsSyntaxPass = true;
  } catch (e) {}
  test('js/map-search.js compiles with 0 syntax errors', jsSyntaxPass);

  // ------------------------------------------------------------------------
  // SUMMARY
  // ------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`🏁 MAP TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  await pool.end();
}

runMapLocationTests().catch(err => {
  console.error('Test fatal error:', err);
  process.exit(1);
});
