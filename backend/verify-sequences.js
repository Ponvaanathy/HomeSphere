const pool = require('./config/db');

(async () => {
  const [users] = await pool.query(
    'SELECT MAX(id) AS max_id, COUNT(*) AS total FROM users'
  );

  const [sequences] = await pool.query(
    'SELECT sequence_name, next_id FROM id_sequences ORDER BY sequence_name'
  );

  console.log('Users:', users[0]);
  console.table(sequences);

  await pool.end();
})().catch(err => {
  console.log('Check failed:', err.code || err.message);
  process.exitCode = 1;
});
