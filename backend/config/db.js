const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

// Database configuration
const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = parseInt(process.env.DB_PORT || '3306', 10);
const dbUser = process.env.DB_USER || 'root';
const dbPass = process.env.DB_PASS !== undefined ? process.env.DB_PASS : '';
const dbName = process.env.DB_NAME || 'homesphere';

// Create MySQL Connection Pool
const pool = mysql.createPool({
  host: dbHost,
  port: dbPort,
  user: dbUser,
  password: dbPass,
  database: dbName,

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  decimalNumbers: true
});

// Diagnostic check when backend starts
(async () => {
  try {
    const connection = await pool.getConnection();

    console.log('====================================================');
    console.log(
      `✅ [Database] Connected successfully to MySQL database "${dbName}"`
    );
    console.log(`🌐 MySQL Host: ${dbHost}`);
    console.log(`🔌 MySQL Port: ${dbPort}`);
    console.log(`👤 MySQL User: ${dbUser}`);
    console.log('====================================================');

    connection.release();

  } catch (err) {

    console.error('====================================================');
    console.error(
      `❌ [Database Error] Failed to connect to MySQL database "${dbName}"`
    );
    console.error(`🌐 Host: ${dbHost}`);
    console.error(`🔌 Port: ${dbPort}`);
    console.error(`👤 User: ${dbUser}`);
    console.error(`❌ Error Code: ${err.code || 'UNKNOWN'}`);
    console.error(`❌ Error Message: ${err.message}`);

    // Connection refused
    if (err.code === 'ECONNREFUSED') {

      console.error('\n💡 DIAGNOSIS:');
      console.error(
        `   MySQL server is not reachable on ${dbHost}:${dbPort}.`
      );

      console.error('\n▶ CHECK:');
      console.error('   1. Open XAMPP Control Panel.');
      console.error('   2. Make sure MySQL is running.');
      console.error(`   3. Confirm MySQL is using port ${dbPort}.`);
      console.error(
        `   4. You can verify using: netstat -ano | findstr :${dbPort}`
      );

    }

    // Wrong username/password
    else if (err.code === 'ER_ACCESS_DENIED_ERROR') {

      console.error('\n💡 DIAGNOSIS:');
      console.error(`   Authentication failed for user "${dbUser}".`);

      console.error('\n▶ CHECK:');
      console.error('   1. Open backend/.env');
      console.error('   2. Check DB_USER');
      console.error('   3. Check DB_PASS');
      console.error('   4. Default XAMPP root password is usually empty.');

    }

    // Database doesn't exist
    else if (err.code === 'ER_BAD_DB_ERROR') {

      console.error('\n💡 DIAGNOSIS:');
      console.error(`   Database "${dbName}" does not exist.`);

      console.error('\n▶ SOLUTION:');
      console.error('   1. Open phpMyAdmin.');
      console.error('   2. Create/import the "homesphere" database.');
      console.error('   3. Import your homesphere.sql file if available.');

    }

    console.error('====================================================\n');
  }
})();

module.exports = pool;