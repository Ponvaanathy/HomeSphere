const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables reliably
const envPaths = [
  path.join(__dirname, '../.env'),
  path.join(__dirname, '../../.env'),
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), 'backend/.env')
];
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

// Database configuration
const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = parseInt(process.env.DB_PORT || '3306', 10);
const dbUser = process.env.DB_USER || 'root';
const dbPass = process.env.DB_PASS !== undefined ? process.env.DB_PASS : '';
const dbName = process.env.DB_NAME || 'homesphere';

// SSL Configuration for Cloud MySQL (TiDB, Aiven, Railway, Supabase, AWS RDS)
const isCloudDb = dbHost !== 'localhost' && dbHost !== '127.0.0.1';
const dbSsl = process.env.DB_SSL === 'true' || (process.env.NODE_ENV === 'production' && isCloudDb)
  ? { rejectUnauthorized: false }
  : undefined;

// Create MySQL Connection Pool
const poolConfig = {
  host: dbHost,
  port: dbPort,
  user: dbUser,
  password: dbPass,
  database: dbName,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true
};

if (dbSsl) {
  poolConfig.ssl = dbSsl;
}

const pool = mysql.createPool(poolConfig);

// Real MySQL Connection Test Query
const testDatabaseConnection = async () => {
  try {
    const connection = await pool.getConnection();
    // Execute a real MySQL verification query
    await connection.query('SELECT 1');
    connection.release();
    return {
      connected: true,
      database: dbName,
      host: dbHost,
      port: dbPort,
      user: dbUser
    };
  } catch (err) {
    return {
      connected: false,
      database: dbName,
      host: dbHost,
      port: dbPort,
      user: dbUser,
      error: err.message || err.code || String(err)
    };
  }
};

pool.testDatabaseConnection = testDatabaseConnection;
pool.dbConfig = { host: dbHost, port: dbPort, user: dbUser, database: dbName };

module.exports = pool;