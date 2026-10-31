const pool = require('./config/db');

async function check() {
    try {
        const [rows] = await pool.query(`
            SELECT TABLE_NAME, ENGINE
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = 'homesphere'
        `);

        for (const row of rows) {
            const [columns] = await pool.query(
                `SHOW CREATE TABLE ??`,
                [row.TABLE_NAME]
            );

            console.log('\nTABLE:', row.TABLE_NAME);
            console.log(columns[0]['Create Table']);
        }
    } catch (err) {
        console.log(err.message);
    } finally {
        await pool.end();
    }
}

check();