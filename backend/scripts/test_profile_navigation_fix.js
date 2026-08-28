const pool = require('../config/db');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function runProfileNavigationTests() {
  console.log('========================================================================');
  console.log('👤 TESTING DASHBOARD TITLE & PROFILE NAVIGATION FIX');
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
  // 1. DASHBOARD TITLE VERIFICATION
  // ------------------------------------------------------------------------
  console.log('1️⃣ TESTING DASHBOARD TITLE:');
  const dashHtml = fs.readFileSync(path.join(__dirname, '../../dashboard.html'), 'utf8');
  test('dashboard.html contains "HomeSphere Insights" heading',
    dashHtml.includes('HomeSphere Insights'),
    'Found "HomeSphere Insights" in dashboard.html'
  );

  test('dashboard.html does NOT contain "Property Dashboard" in main heading',
    !dashHtml.includes('<h1 style="font-size: 2rem; color: var(--text-primary); margin-top: 0.25rem;">\n            Property Dashboard') &&
    !dashHtml.includes('<h1>Property Dashboard</h1>'),
    'Cleanly updated to HomeSphere Insights'
  );

  // ------------------------------------------------------------------------
  // 2. TOP PROFILE NAVIGATION IN DASHBOARD & HEADER
  // ------------------------------------------------------------------------
  console.log('\n2️⃣ TESTING TOP PROFILE/AVATAR NAVIGATION:');
  test('dashboard.html top avatar is wrapped in a link to /profile.html',
    dashHtml.includes('href="/profile.html"') && dashHtml.includes('id="dashTopProfileLink"'),
    'Found clickable dashTopProfileLink with href="/profile.html"'
  );

  // ------------------------------------------------------------------------
  // 3. ROUTE ACCESSIBILITY (/profile & /profile.html)
  // ------------------------------------------------------------------------
  console.log('\n3️⃣ TESTING PROFILE ROUTE ACCESSIBILITY:');
  const resProfileSlash = await fetch('http://localhost:5000/profile');
  test('GET /profile serves profile page (HTTP 200)',
    resProfileSlash.status === 200,
    `Status: ${resProfileSlash.status}`
  );

  const resProfileHtml = await fetch('http://localhost:5000/profile.html');
  test('GET /profile.html serves profile page (HTTP 200)',
    resProfileHtml.status === 200,
    `Status: ${resProfileHtml.status}`
  );

  // ------------------------------------------------------------------------
  // 4. AUTHENTICATION PROTECTION
  // ------------------------------------------------------------------------
  console.log('\n4️⃣ TESTING AUTHENTICATION PROTECTION & SECURITY:');
  const unauthRes = await fetch('http://localhost:5000/api/users/profile');
  test('GET /api/users/profile without token returns HTTP 401 Unauthorized',
    unauthRes.status === 401,
    `Status: ${unauthRes.status}`
  );

  const profileJs = fs.readFileSync(path.join(__dirname, '../../js/profile.js'), 'utf8');
  test('js/profile.js enforces login redirect when token is missing',
    profileJs.includes("if (!token)") && profileJs.includes("window.location.href = '/login.html'"),
    'Proper client-side redirect in place'
  );

  // ------------------------------------------------------------------------
  // 5. REAL USER DATA LOADING VIA AUTHENTICATION
  // ------------------------------------------------------------------------
  console.log('\n5️⃣ TESTING REAL USER DATA RETRIEVAL (GET /api/users/profile):');
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'seller@homesphere.com', password: 'password123' })
  }).then(r => r.json());

  test('Login succeeds with seller credentials', loginRes.success && !!loginRes.data?.token);
  const token = loginRes.data?.token;

  const profRes = await fetch('http://localhost:5000/api/users/profile', {
    headers: { 'Authorization': `Bearer ${token}` }
  }).then(r => r.json());

  test('GET /api/users/profile returns real user data',
    profRes.success && profRes.data?.email === 'seller@homesphere.com',
    `Name: "${profRes.data?.name}", Email: "${profRes.data?.email}", Role: "${profRes.data?.role}"`
  );

  test('Profile response does NOT expose password or password_hash',
    profRes.data?.password === undefined && profRes.data?.password_hash === undefined,
    'Security sanitized: 0 password leaks'
  );

  test('Profile includes database listings_count and saved_count',
    typeof profRes.data?.listings_count === 'number' && typeof profRes.data?.saved_count === 'number',
    `Listings Count: ${profRes.data?.listings_count}, Saved Count: ${profRes.data?.saved_count}`
  );

  test('Profile includes location / preferred city',
    typeof profRes.data?.location === 'string' && profRes.data.location.length > 0,
    `Location: "${profRes.data?.location}"`
  );

  // ------------------------------------------------------------------------
  // 6. EDIT PROFILE PERSISTENCE (PUT /api/users/profile)
  // ------------------------------------------------------------------------
  console.log('\n6️⃣ TESTING EDIT PROFILE & MYSQL PERSISTENCE (PUT /api/users/profile):');
  const originalName = profRes.data?.name || 'Sarah Jenkins';
  const originalPhone = profRes.data?.phone || '9876543210';
  const originalLoc = profRes.data?.location || 'Coimbatore, Tamil Nadu';

  const testName = `Sarah Jenkins Test ${Date.now()}`;
  const testPhone = '+91 94433 22110';
  const testLoc = 'Peelamedu North, Coimbatore';

  const updateRes = await fetch('http://localhost:5000/api/users/profile', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: testName,
      phone: testPhone,
      location: testLoc
    })
  }).then(r => r.json());

  test('PUT /api/users/profile returns HTTP 200 success',
    updateRes.success && updateRes.data?.name === testName,
    `Updated name returned: "${updateRes.data?.name}"`
  );

  // Verify in MySQL database directly
  const [dbUser] = await pool.query('SELECT name, phone FROM users WHERE email = ?', ['seller@homesphere.com']);
  test('MySQL users table updated with new name and phone',
    dbUser[0]?.name === testName && dbUser[0]?.phone === testPhone,
    `DB Name: "${dbUser[0]?.name}", DB Phone: "${dbUser[0]?.phone}"`
  );

  // Verify read-back
  const readBack = await fetch('http://localhost:5000/api/users/profile', {
    headers: { 'Authorization': `Bearer ${token}` }
  }).then(r => r.json());
  test('Read-back GET /api/users/profile reflects updated data',
    readBack.data?.name === testName && readBack.data?.phone === testPhone && readBack.data?.location === testLoc,
    `Persisted: Name="${readBack.data?.name}", Phone="${readBack.data?.phone}", Location="${readBack.data?.location}"`
  );

  // Revert back to original
  await fetch('http://localhost:5000/api/users/profile', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Sarah Jenkins',
      phone: '9876543210',
      location: 'Coimbatore, Tamil Nadu'
    })
  });

  // ------------------------------------------------------------------------
  // 7. CHANGE PASSWORD API VERIFICATION
  // ------------------------------------------------------------------------
  console.log('\n7️⃣ TESTING CHANGE PASSWORD API:');
  const badPassRes = await fetch('http://localhost:5000/api/auth/change-password', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      currentPassword: 'wrongPassword999',
      newPassword: 'newPassword123'
    })
  }).then(r => r.json());

  test('Change password rejects incorrect current password',
    !badPassRes.success && badPassRes.message?.includes('Current password is incorrect'),
    `Message: "${badPassRes.message}"`
  );

  const shortPassRes = await fetch('http://localhost:5000/api/auth/change-password', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      currentPassword: 'password123',
      newPassword: '123'
    })
  }).then(r => r.json());

  test('Change password rejects passwords shorter than 6 characters',
    !shortPassRes.success && shortPassRes.message?.includes('6 characters'),
    `Message: "${shortPassRes.message}"`
  );

  // ------------------------------------------------------------------------
  // 8. TOP NAVIGATION ACROSS ALL PAGES
  // ------------------------------------------------------------------------
  console.log('\n8️⃣ TESTING TOP NAVIGATION ACROSS ALL PLATFORM PAGES:');
  const pagesToCheck = [
    { file: 'properties.html', js: 'js/properties.js' },
    { file: 'property-details.html', js: 'js/property-details.js' },
    { file: 'saved.html', js: 'js/saved.js' },
    { file: 'map-search.html', js: 'js/map-search.js' },
    { file: 'advisor.html', js: 'js/advisor.js' },
    { file: 'compare.html', js: 'js/compare.js' },
    { file: 'my-listings.html', js: 'js/my-listings.js' },
    { file: 'list-property.html', js: 'js/list-property.js' },
    { file: 'notifications.html', js: 'notifications.html' },
    { file: 'index.html', js: 'index.html' }
  ];

  pagesToCheck.forEach(p => {
    const content = fs.readFileSync(path.join(__dirname, '../../', p.js), 'utf8');
    test(`Page ${p.file} navbar contains profile link to /profile.html`,
      content.includes('/profile.html'),
      `Verified in ${p.js}`
    );
  });

  // ------------------------------------------------------------------------
  // 9. FRONTEND JS SYNTAX CHECKS
  // ------------------------------------------------------------------------
  console.log('\n9️⃣ TESTING JAVASCRIPT SYNTAX INTEGRITY:');
  let jsSyntaxPass = true;
  ['js/profile.js', 'js/dashboard.js', 'js/properties.js', 'js/saved.js', 'js/map-search.js', 'js/advisor.js', 'js/compare.js', 'js/my-listings.js', 'js/list-property.js'].forEach(f => {
    try {
      execSync(`node -c ${f}`, { stdio: 'pipe' });
    } catch (e) {
      jsSyntaxPass = false;
      console.error(`Syntax error in ${f}`);
    }
  });
  test('All frontend JS controllers pass node -c syntax check with 0 errors', jsSyntaxPass);

  // ------------------------------------------------------------------------
  // SUMMARY
  // ------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`🏁 PROFILE NAVIGATION TEST SUITE: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  await pool.end();
}

runProfileNavigationTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
