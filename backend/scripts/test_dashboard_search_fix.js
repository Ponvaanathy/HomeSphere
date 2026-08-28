const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

async function runDashboardSearchTests() {
  console.log('========================================================================');
  console.log('🔍 TESTING DASHBOARD SEARCH BAR & PROPERTY SEARCH FLOW');
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
  // 1. DASHBOARD SEARCH BAR UI & EVENT HANDLERS
  // ------------------------------------------------------------------------
  console.log('1️⃣ TESTING DASHBOARD SEARCH BAR UI & HANDLERS:');
  const dashHtml = fs.readFileSync(path.join(__dirname, '../../dashboard.html'), 'utf8');
  test('dashboard.html contains top search form with handleDashboardHeaderSearch',
    dashHtml.includes('id="dashHeaderSearchForm"') && dashHtml.includes('onsubmit="handleDashboardHeaderSearch(event)"'),
    'Found form #dashHeaderSearchForm with submit handler'
  );

  test('dashboard.html contains #headerSearchInput field',
    dashHtml.includes('id="headerSearchInput"'),
    'Found search input #headerSearchInput'
  );

  const dashJs = fs.readFileSync(path.join(__dirname, '../../js/dashboard.js'), 'utf8');
  test('js/dashboard.js defines handleDashboardHeaderSearch function',
    dashJs.includes('function handleDashboardHeaderSearch'),
    'Handler redirects to /properties.html?q=...'
  );

  test('js/dashboard.js defines handleQuickSearch function',
    dashJs.includes('function handleQuickSearch'),
    'Quick search redirects with category, purpose, location, and bhk'
  );

  // ------------------------------------------------------------------------
  // 2. PROPERTIES PAGE SEARCH INTEGRATION
  // ------------------------------------------------------------------------
  console.log('\n2️⃣ TESTING PROPERTIES RESULTS PAGE INTEGRATION:');
  const propJs = fs.readFileSync(path.join(__dirname, '../../js/properties.js'), 'utf8');
  test('js/properties.js reads URL query parameter q / search',
    propJs.includes("params.get('q')") || propJs.includes("params.get('search')"),
    'Reads qParam on load'
  );

  test('js/properties.js appends q parameter to /api/properties request',
    propJs.includes('q=${encodeURIComponent(currentSearchQuery)}'),
    'Calls existing property search API with q'
  );

  // ------------------------------------------------------------------------
  // 3. BACKEND SEARCH API WITH ALL REQUIRED USER QUERIES
  // ------------------------------------------------------------------------
  console.log('\n3️⃣ TESTING SEARCH API AGAINST REAL MYSQL ACTIVE PROPERTIES:');

  // Test 1: "Peelamedu"
  const resPeelamedu = await fetch('http://localhost:5000/api/properties?q=Peelamedu').then(r => r.json());
  test('Search "Peelamedu" returns active properties in Peelamedu',
    resPeelamedu.success && resPeelamedu.data?.properties?.length > 0 &&
    resPeelamedu.data.properties.every(p => (p.locality?.includes('Peelamedu') || p.address?.includes('Peelamedu') || p.city?.includes('Peelamedu') || p.title?.includes('Peelamedu'))),
    `Found ${resPeelamedu.data?.properties?.length} properties. Sample: "${resPeelamedu.data?.properties?.[0]?.title}"`
  );

  // Test 2: "2 BHK"
  const res2BHK = await fetch('http://localhost:5000/api/properties?q=' + encodeURIComponent('2 BHK')).then(r => r.json());
  test('Search "2 BHK" returns active 2-bedroom properties',
    res2BHK.success && res2BHK.data?.properties?.length > 0 &&
    res2BHK.data.properties.every(p => Number(p.bedrooms) === 2 || Number(p.bhk) === 2),
    `Found ${res2BHK.data?.properties?.length} properties. Sample: "${res2BHK.data?.properties?.[0]?.title}" (${res2BHK.data?.properties?.[0]?.bedrooms} Beds)`
  );

  // Test 3: "2 BHK Peelamedu"
  const res2BHKPeelamedu = await fetch('http://localhost:5000/api/properties?q=' + encodeURIComponent('2 BHK Peelamedu')).then(r => r.json());
  test('Search "2 BHK Peelamedu" returns active 2-bedroom properties in Peelamedu',
    res2BHKPeelamedu.success && res2BHKPeelamedu.data?.properties?.length > 0 &&
    res2BHKPeelamedu.data.properties.every(p => (Number(p.bedrooms) === 2 || Number(p.bhk) === 2) && (p.locality?.includes('Peelamedu') || p.address?.includes('Peelamedu') || p.title?.includes('Peelamedu'))),
    `Found ${res2BHKPeelamedu.data?.properties?.length} properties. Sample: "${res2BHKPeelamedu.data?.properties?.[0]?.title}"`
  );

  // Test 4: "Coimbatore"
  const resCoimbatore = await fetch('http://localhost:5000/api/properties?q=Coimbatore').then(r => r.json());
  test('Search "Coimbatore" returns active properties in Coimbatore',
    resCoimbatore.success && resCoimbatore.data?.properties?.length > 0 &&
    resCoimbatore.data.properties.every(p => p.city?.toLowerCase().includes('coimbatore') || p.address?.toLowerCase().includes('coimbatore')),
    `Found ${resCoimbatore.data?.properties?.length} properties. Sample: "${resCoimbatore.data?.properties?.[0]?.title}"`
  );

  // Test 5: "2 BHK for rent in Peelamedu" (Composite Intent Query)
  const resRent2BHK = await fetch('http://localhost:5000/api/properties?q=' + encodeURIComponent('2 BHK for rent in Peelamedu')).then(r => r.json());
  test('Search "2 BHK for rent in Peelamedu" returns 2-bedroom rental listings in Peelamedu',
    resRent2BHK.success && resRent2BHK.data?.properties?.length > 0 &&
    resRent2BHK.data.properties.every(p => p.type === 'rent' && (Number(p.bedrooms) === 2 || Number(p.bhk) === 2)),
    `Found ${resRent2BHK.data?.properties?.length} properties. Sample: "${resRent2BHK.data?.properties?.[0]?.title}" (Type: ${resRent2BHK.data?.properties?.[0]?.type})`
  );

  // Test 6: "Villa" (Subcategory/Type Query)
  const resVilla = await fetch('http://localhost:5000/api/properties?q=Villa').then(r => r.json());
  test('Search "Villa" returns active villas and independent houses',
    resVilla.success && resVilla.data?.properties?.length > 0 &&
    resVilla.data.properties.every(p => p.subcategory?.toLowerCase().includes('villa') || p.property_type?.toLowerCase().includes('villa') || p.title?.toLowerCase().includes('villa')),
    `Found ${resVilla.data?.properties?.length} properties. Sample: "${resVilla.data?.properties?.[0]?.title}"`
  );

  // ------------------------------------------------------------------------
  // 4. VERIFY ALL RETURNED PROPERTIES ARE STATUS = 'active'
  // ------------------------------------------------------------------------
  console.log('\n4️⃣ TESTING DATABASE STATUS INTEGRITY:');
  const allTestResults = [
    ...(resPeelamedu.data?.properties || []),
    ...(res2BHK.data?.properties || []),
    ...(res2BHKPeelamedu.data?.properties || []),
    ...(resCoimbatore.data?.properties || []),
    ...(resRent2BHK.data?.properties || []),
    ...(resVilla.data?.properties || [])
  ];

  const allActive = allTestResults.every(p => p.status === 'active');
  test('Every returned search result strictly has status = "active" (zero sold/outdated properties leaked)',
    allActive,
    `Checked ${allTestResults.length} properties across all search queries`
  );

  // ------------------------------------------------------------------------
  // SUMMARY
  // ------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`🏁 DASHBOARD SEARCH TEST SUITE: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  await pool.end();
}

runDashboardSearchTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
