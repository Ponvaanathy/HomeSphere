const pool = require('./config/db');

(async () => {
  const [rows] = await pool.query(
    'SELECT id, name, email FROM users WHERE email = ?',
    ['homesphere.test.20261031@example.com']
  );

  console.table(rows);
  await pool.end();
})().catch(err => {
  console.log('Check failed:', err.code || err.message);
  process.exitCode = 1;
});
