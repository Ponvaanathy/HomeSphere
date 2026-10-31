const mysql = require('mysql2/promise');

(async () => {
  const c = await mysql.createConnection({
    host: 'localhost',
    port: 3307,
    user: 'root',
    database: 'homesphere'
  });

  const [rows] = await c.query(
    'SELECT sequence_name, next_id FROM id_sequences ORDER BY sequence_name'
  );
  console.table(rows);
  await c.end();
})().catch(e => console.log('Local DB check failed:', e.code || e.message));
