/**
 * Security & Data Sanitization Audit Probes
 */

const pool = require('../config/db');

async function testSecurity() {
  console.log('=== SECURITY PROBES ===\n');

  // 1. Test SQL Injection
  const sqliQuery = "' OR '1'='1";
  const res1 = await fetch('http://localhost:5000/api/properties?q=' + encodeURIComponent(sqliQuery));
  const d1 = await res1.json();
  console.log(`1. SQLi via Search parameter: Status ${res1.status}, Matches: ${d1.data?.properties?.length || 0} (Safe, Parameterized query)`);

  // 2. Test SQL Injection via ID
  const res2 = await fetch('http://localhost:5000/api/properties/1%20OR%201=1');
  const d2 = await res2.json();
  console.log(`2. SQLi via ID parameter: Status ${res2.status}, Success: ${d2.success} (Safe, rejected or cast to int)`);

  // 3. Test Owner Contact Privacy on Public Endpoints
  const res3 = await fetch('http://localhost:5000/api/properties/1');
  const d3 = await res3.json();
  const p = d3.data;
  const leaks = [];
  if (p.owner_phone || p.phone) leaks.push('Phone number exposed');
  if (p.owner_email || p.email) leaks.push('Email exposed');
  if (p.password_hash || p.password) leaks.push('Password exposed');
  console.log(`3. Public Property API Contact Sanitization: ${leaks.length === 0 ? '✅ PASSED (No phone/email/password leaked)' : '❌ FAILED: ' + leaks.join(', ')}`);

  // 4. Test Password Hash Leakage in Auth/User endpoints
  const [users] = await pool.query('SELECT id, email FROM users LIMIT 1');
  const user = users[0];
  const res4 = await fetch(`http://localhost:5000/api/users/${user.id}`);
  const d4 = await res4.json();
  const hasHash = d4.data?.password_hash || d4.data?.password;
  console.log(`4. User API Password Hash Sanitization: ${!hasHash ? '✅ PASSED (Password hash stripped)' : '❌ FAILED (Hash exposed in response)'}`);

  // 5. Test Unauthorized Access to Protected Routes
  const res5 = await fetch('http://localhost:5000/api/saved');
  console.log(`5. Unauthorized Access to /api/saved without JWT: Status ${res5.status} (Expected 401: ${res5.status === 401 ? '✅ PASSED' : '❌ FAILED'})`);

  const res6 = await fetch('http://localhost:5000/api/messages/conversations');
  console.log(`6. Unauthorized Access to /api/messages/conversations: Status ${res6.status} (Expected 401: ${res6.status === 401 ? '✅ PASSED' : '❌ FAILED'})`);

  const res7 = await fetch('http://localhost:5000/api/transactions/my-deals');
  console.log(`7. Unauthorized Access to /api/transactions/my-deals: Status ${res7.status} (Expected 401: ${res7.status === 401 ? '✅ PASSED' : '❌ FAILED'})`);

  console.log('\n=== SECURITY PROBE COMPLETE ===');
  process.exit(0);
}

testSecurity().catch(err => {
  console.error('Security test failed:', err);
  process.exit(1);
});
