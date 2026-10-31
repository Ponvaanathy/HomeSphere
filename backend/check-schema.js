const pool = require('./config/db');

async function checkSchema() {
    try {
        const [rows] = await pool.query(`
            SELECT
                TABLE_NAME,
                COLUMN_NAME,
                COLUMN_KEY,
                IS_NULLABLE,
                COLUMN_DEFAULT,
                EXTRA
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = 'homesphere'
            AND COLUMN_NAME = 'id'
            ORDER BY TABLE_NAME
        `);

        console.table(rows);
    } catch (error) {
        console.log(error.message);
    } finally {
        await pool.end();
    }
}

checkSchema();