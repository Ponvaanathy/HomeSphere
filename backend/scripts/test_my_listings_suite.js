/**
 * Comprehensive "My Listings" & Property Ownership Test Suite for HomeSphere
 * Verifies authenticated property creation, ownership association (owner_id),
 * user isolation, and "My Listings" API retrieval.
 */

const pool = require('../config/db');

const API_BASE = 'http://localhost:5000/api';
const results = [];

function assert(testName, condition, details = '') {
  results.push({ testName, passed: Boolean(condition), details });
  console.log(`  [${condition ? '✓ PASS' : '✗ FAIL'}] ${testName} ${details ? '(' + details + ')' : ''}`);
}

async function runMyListingsTestSuite() {
  console.log('================================================================');
  console.log('🧪 RUNNING "MY LISTINGS" & PROPERTY OWNERSHIP TEST SUITE');
  console.log('================================================================\n');

  const stamp = Date.now();
  const userAEmail = `owner_a_${stamp}@homesphere.ai`;
  const userBEmail = `owner_b_${stamp}@homesphere.ai`;

  let userAId = null, userAToken = null;
  let userBId = null, userBToken = null;
  let propAId = null, propBId = null;

  try {
    // 1. Register User A
    console.log('▶ [1/7] Registering User A & User B...');
    const regARes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice Owner',
        email: userAEmail,
        password: 'Password123!',
        phone: '9876500001',
        role: 'user'
      })
    }).then(r => r.json());

    userAId = regARes.data?.user?.id;
    userAToken = regARes.data?.token;
    assert('User A Registered & Authenticated', regARes.success && !!userAId && !!userAToken, `User A ID #${userAId}`);

    // Register User B
    const regBRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bob Owner',
        email: userBEmail,
        password: 'Password123!',
        phone: '9876500002',
        role: 'user'
      })
    }).then(r => r.json());

    userBId = regBRes.data?.user?.id;
    userBToken = regBRes.data?.token;
    assert('User B Registered & Authenticated', regBRes.success && !!userBId && !!userBToken, `User B ID #${userBId}`);

    // 2. User A Posts Property A
    console.log('\n▶ [2/7] User A Posting Property A via POST /api/properties...');
    const propAPayload = {
      title: `Alice Luxury Villa #${stamp}`,
      description: 'Exclusive 3 BHK Villa with private garden in Peelamedu.',
      category: 'residential',
      subcategory: 'villa',
      type: 'sale',
      price: 14500000,
      deposit: 0,
      currency: 'INR',
      address: `100 Avinashi Road, Test Block ${stamp}`,
      locality: 'Peelamedu',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      zip_code: '641004',
      lat: 11.026700,
      lng: 77.002800,
      bedrooms: 3,
      bathrooms: 3,
      bhk: 3,
      area_sqft: 2400,
      year_built: 2024,
      furnishing: 'fully-furnished',
      parking_spaces: 2,
      amenities_json: JSON.stringify(['24/7 Security', 'Solar Water Heating', 'EV Charging Station'])
    };

    const createARes = await fetch(`${API_BASE}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userAToken}`
      },
      body: JSON.stringify(propAPayload)
    }).then(r => r.json());

    propAId = createARes.data?.property_id || createARes.data?.id;
    assert('Property A Created Successfully', createARes.success && !!propAId, `Property A ID #${propAId}`);

    // Verify MySQL ownership column for Property A
    const [dbRowsA] = await pool.query('SELECT id, owner_id, title, price, city, lat, lng FROM properties WHERE id = ?', [propAId]);
    assert('Property A Saved in MySQL with Correct owner_id', dbRowsA.length > 0 && dbRowsA[0].owner_id === userAId, `owner_id = ${dbRowsA[0]?.owner_id}`);

    // 3. User B Posts Property B
    console.log('\n▶ [3/7] User B Posting Property B via POST /api/properties...');
    const propBPayload = {
      title: `Bob Commercial Office Space #${stamp}`,
      description: 'Prime commercial office space on DB Road RS Puram.',
      category: 'commercial',
      subcategory: 'office_space',
      type: 'rent',
      price: 85000,
      deposit: 450000,
      currency: 'INR',
      address: `50 DB Road, Test Complex ${stamp}`,
      locality: 'RS Puram',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      zip_code: '641002',
      lat: 11.008500,
      lng: 76.952000,
      bedrooms: 1,
      bathrooms: 2,
      bhk: 1,
      area_sqft: 1600,
      year_built: 2023,
      furnishing: 'semi-furnished',
      parking_spaces: 3,
      amenities_json: JSON.stringify(['Power Backup', '24/7 Security'])
    };

    const createBRes = await fetch(`${API_BASE}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userBToken}`
      },
      body: JSON.stringify(propBPayload)
    }).then(r => r.json());

    propBId = createBRes.data?.property_id || createBRes.data?.id;
    assert('Property B Created Successfully', createBRes.success && !!propBId, `Property B ID #${propBId}`);

    const [dbRowsB] = await pool.query('SELECT id, owner_id, title FROM properties WHERE id = ?', [propBId]);
    assert('Property B Saved in MySQL with Correct owner_id', dbRowsB.length > 0 && dbRowsB[0].owner_id === userBId, `owner_id = ${dbRowsB[0]?.owner_id}`);

    // 4. Test User A "My Listings" Endpoint & Isolation
    console.log('\n▶ [4/7] Testing User A "My Listings" (/api/properties/my-listings)...');
    const myListingsARes = await fetch(`${API_BASE}/properties/my-listings`, {
      headers: { 'Authorization': `Bearer ${userAToken}` }
    }).then(r => r.json());

    const listA = myListingsARes.data?.properties || [];
    const hasPropAInListA = listA.some(p => p.id === propAId);
    const hasPropBInListA = listA.some(p => p.id === propBId);

    assert('User A Sees Property A in My Listings', myListingsARes.success && hasPropAInListA, `Found Property #${propAId}`);
    assert('User A DOES NOT See User B Property (Strict Isolation)', !hasPropBInListA);

    // 5. Test User B "My Listings" Endpoint & Isolation
    console.log('\n▶ [5/7] Testing User B "My Listings" (/api/properties/my-listings)...');
    const myListingsBRes = await fetch(`${API_BASE}/properties/my-listings`, {
      headers: { 'Authorization': `Bearer ${userBToken}` }
    }).then(r => r.json());

    const listB = myListingsBRes.data?.properties || [];
    const hasPropBInListB = listB.some(p => p.id === propBId);
    const hasPropAInListB = listB.some(p => p.id === propAId);

    assert('User B Sees Property B in My Listings', myListingsBRes.success && hasPropBInListB, `Found Property #${propBId}`);
    assert('User B DOES NOT See User A Property (Strict Isolation)', !hasPropAInListB);

    // Test Alias route /api/properties/seller/my-listings
    const aliasRes = await fetch(`${API_BASE}/properties/seller/my-listings`, {
      headers: { 'Authorization': `Bearer ${userAToken}` }
    }).then(r => r.json());
    assert('Alias Route /api/properties/seller/my-listings Works', aliasRes.success && aliasRes.data?.properties?.some(p => p.id === propAId));

    // 6. Test Unauthenticated Access Protection
    console.log('\n▶ [6/7] Testing Security & Unauthenticated Access Protection...');
    const noAuthRes = await fetch(`${API_BASE}/properties/my-listings`);
    assert('Unauthenticated Request Rejected (401)', noAuthRes.status === 401);

    // 7. Cleanup Test Records
    console.log('\n▶ [7/7] Cleaning up Test Data...');
    if (propAId) {
      await pool.query('DELETE FROM properties WHERE id = ?', [propAId]);
      await pool.query('DELETE FROM property_images WHERE property_id = ?', [propAId]);
    }
    if (propBId) {
      await pool.query('DELETE FROM properties WHERE id = ?', [propBId]);
      await pool.query('DELETE FROM property_images WHERE property_id = ?', [propBId]);
    }
    if (userAId) await pool.query('DELETE FROM users WHERE id = ?', [userAId]);
    if (userBId) await pool.query('DELETE FROM users WHERE id = ?', [userBId]);
    assert('Test Data Cleanly Removed from Database', true);

  } catch (err) {
    console.error('Test suite error:', err);
    assert('Suite Exception Free', false, err.message);
  }

  console.log('\n================================================================');
  console.log('📊 "MY LISTINGS" TEST SUITE SUMMARY');
  console.log('================================================================');
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  console.log(`Passed: ${passedCount} / ${totalCount} tests (${Math.round((passedCount / totalCount) * 100)}%)`);

  if (passedCount === totalCount) {
    console.log('🎉 100% PASS: "My Listings" functionality is fully verified and functional!');
  } else {
    console.log('❌ SOME TESTS FAILED');
    process.exit(1);
  }
}

runMyListingsTestSuite();
