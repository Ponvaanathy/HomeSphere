const mysql = require('mysql2/promise');
const fs = require('fs');

async function importDatabase() {
  const connection = await mysql.createConnection({
    host: 'altaria.proxy.rlwy.net',
    port: 38130,
    user: 'root',
    password: process.env.RAILWAY_DB_PASSWORD,
    database: 'railway',
    ssl: {
      rejectUnauthorized: false
    },
    multipleStatements: true
  });

  console.log('Connected to Railway MySQL ✅');

  const sql = fs.readFileSync(
    'C:/Users/vaana/Downloads/homesphere.sql',
    'utf8'
  );

  console.log('SQL file loaded ✅');
  console.log('Importing database...');

  await connection.query(sql);

  console.log('Database imported successfully ✅');

  const [tables] = await connection.query('SHOW TABLES');
  console.log('Tables:', tables);

  await connection.end();
}

importDatabase().catch(error => {
  console.error('IMPORT FAILED ❌');
  console.error(error);
});