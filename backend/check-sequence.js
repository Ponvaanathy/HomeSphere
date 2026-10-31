require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  const host = process.env.DB_HOST;
  const c = await mysql.createConnection({
    host,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    ssl: host !== 'localhost' && host !== '127.0.0.1'
      ? { rejectUnauthorized: false } : undefined
  });

  for (const table of ['users', 'user_preferences']) {
    const [rows] = await c.query(`SELECT MAX(id) AS max_id, COUNT(*) AS total FROM \`${table}\``);
    console.log(table, rows[0]);
  }
  await c.end();
})().catch(e => console.log('DB check failed:', e.code || e.message));
