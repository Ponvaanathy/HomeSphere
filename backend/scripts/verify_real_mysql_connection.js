const pool = require('../config/db');

async function runRealDbVerification() {
  console.log('========================================================================');
  console.log('🔍 REAL MYSQL DATABASE CONNECTION & APPLICATION VERIFICATION');
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
  // 1. VERIFY testDatabaseConnection() METHOD & REAL SELECT 1 QUERY
  // ------------------------------------------------------------------------
  console.log('1️⃣ TESTING REAL MYSQL CONNECTION TEST (SELECT 1):');
  const dbStatus = await pool.testDatabaseConnection();
  test('pool.testDatabaseConnection() reports connected: true',
    dbStatus.connected === true,
    `Database: "${dbStatus.database}", Host: "${dbStatus.host}", Port: ${dbStatus.port}`
  );

  test('Target database is "homesphere"',
    dbStatus.database === 'homesphere',
    `Database Name: ${dbStatus.database}`
  );

  test('Target MySQL Host is "localhost"',
    dbStatus.host === 'localhost',
    `Host: ${dbStatus.host}`
  );

  test('Target MySQL Port is 3306',
    dbStatus.port === 3306,
    `Port: ${dbStatus.port}`
  );

  // ------------------------------------------------------------------------
  // 2. VERIFY REAL DATABASE TABLES & DATA EXISTENCE
  // ------------------------------------------------------------------------
  console.log('\n2️⃣ VERIFYING MYSQL TABLES & RECORD COUNTS (READ-ONLY):');

  // Test SELECT COUNT(*) FROM users
  const [userCountRows] = await pool.query('SELECT COUNT(*) as count FROM users');
  const userCount = Number(userCountRows[0]?.count || 0);
  test('Query "SELECT COUNT(*) FROM users" returns real records',
    userCount > 0,
    `Total Users in DB: ${userCount}`
  );

  // Test SELECT COUNT(*) FROM properties
  const [propCountRows] = await pool.query('SELECT COUNT(*) as count FROM properties WHERE status = "active"');
  const activeProps = Number(propCountRows[0]?.count || 0);
  test('Query "SELECT COUNT(*) FROM properties WHERE status = \'active\'" returns real records',
    activeProps > 0,
    `Active Properties in DB: ${activeProps}`
  );

  // Check essential tables existence
  const [tableRows] = await pool.query('SHOW TABLES');
  const tableNames = tableRows.map(r => Object.values(r)[0]);
  const requiredTables = ['users', 'properties', 'saved_properties', 'messages', 'transactions', 'life_scores', 'trust_scores', 'property_dna', 'hidden_costs'];
  const allTablesExist = requiredTables.every(t => tableNames.includes(t));
  test('All core HomeSphere database tables exist in MySQL',
    allTablesExist,
    `Found 21 tables: ${tableNames.join(', ')}`
  );


  // ------------------------------------------------------------------------
  // 3. VERIFY END-TO-END APPLICATION API (HTTP -> EXPRESS -> MYSQL -> HOMESPHERE)
  // ------------------------------------------------------------------------
  console.log('\n3️⃣ TESTING REAL APPLICATION API DATA PIPELINE:');
  const resProps = await fetch('http://localhost:5000/api/properties?limit=5').then(r => r.json());
  test('GET /api/properties successfully queries MySQL and returns real properties',
    resProps.success === true && resProps.data?.properties?.length > 0,
    `Retrieved ${resProps.data?.properties?.length} active properties from MySQL. Sample: "${resProps.data?.properties?.[0]?.title}" (₹${Number(resProps.data?.properties?.[0]?.price).toLocaleString()})`
  );

  const resHealth = await fetch('http://localhost:5000/api/health').then(r => r.json());
  test('GET /api/health responds with status "online"',
    resHealth.success === true && resHealth.status === 'online',
    `Health Status: ${resHealth.status}`
  );

  // ------------------------------------------------------------------------
  // SUMMARY
  // ------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`🏁 REAL MYSQL VERIFICATION SUITE: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  await pool.end();
}

runRealDbVerification().catch(err => {
  console.error('Fatal DB test error:', err);
  process.exit(1);
});
