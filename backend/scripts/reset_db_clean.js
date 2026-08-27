const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

async function resetCleanDb() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = parseInt(process.env.DB_PORT, 10) || 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASS !== undefined ? process.env.DB_PASS : '';
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
  const sqlPath = path.join(__dirname, '../../database/homesphere.sql');
  const sqlScript = fs.readFileSync(sqlPath, 'utf8');

  await conn.query(sqlScript);

  console.log('Verifying table row counts:');
  const [tables] = await conn.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = ?
    ORDER BY table_name ASC
  `, [database]);

  let totalRows = 0;
  for (const row of tables) {
    const tableName = row.TABLE_NAME || row.table_name;
    const [countRes] = await conn.query(`SELECT COUNT(*) as count FROM \`${database}\`.\`${tableName}\``);
    const count = countRes[0].count;
    totalRows += count;
    console.log(` ✔ Table ${tableName.padEnd(28)}: ${count} rows`);
  }

  await conn.end();
  console.log(`\n====================================================`);
  console.log(`✅ Clean database reset complete! Total rows across all ${tables.length} tables: ${totalRows}`);
  console.log(`====================================================\n`);
}

resetCleanDb().catch((err) => {
  console.error('❌ Error resetting database:', err);
  process.exit(1);
});
