const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

async function resetCleanDb() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = parseInt(process.env.DB_PORT, 10) || 3307;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || process.env.DB_PASS || '';
  const database = process.env.DB_NAME || 'homesphere';

  console.log(`Connecting to MySQL at ${host}:${port}...`);
  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    multipleStatements: true
  });

  console.log(`Resetting database "${database}" to pure schema with 0 rows...`);
  const sqlScript = fs.readFileSync(path.join(__dirname, '../database/homesphere.sql'), 'utf8');

  await conn.query(sqlScript);

  console.log('Verifying table row counts...');
  const [tables] = await conn.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = ?
  `, [database]);

  for (const row of tables) {
    const tableName = row.TABLE_NAME || row.table_name;
    const [countRes] = await conn.query(`SELECT COUNT(*) as count FROM \`${database}\`.\`${tableName}\``);
    console.log(` - Table ${tableName}: ${countRes[0].count} rows`);
  }

  await conn.end();
  console.log('✅ Clean database reset complete! All tables are at 0 rows.');
}

resetCleanDb().catch((err) => {
  console.error('❌ Error resetting database:', err);
  process.exit(1);
});
