const pool = require('../config/db');

async function migratePropertiesTable() {
  console.log('🔄 Checking and applying schema enhancements to `properties` table...');

  const [existingCols] = await pool.query('DESCRIBE properties');
  const existingColNames = new Set(existingCols.map(c => c.Field.toLowerCase()));

  const columnsToAdd = [
    { name: 'locality', sql: 'ALTER TABLE properties ADD COLUMN locality VARCHAR(150) NULL AFTER address' },
    { name: 'project_name', sql: 'ALTER TABLE properties ADD COLUMN project_name VARCHAR(255) NULL AFTER subcategory' },
    { name: 'community_name', sql: 'ALTER TABLE properties ADD COLUMN community_name VARCHAR(255) NULL AFTER project_name' },
    { name: 'community_type', sql: 'ALTER TABLE properties ADD COLUMN community_type VARCHAR(100) NULL AFTER community_name' },
    { name: 'unit_number', sql: 'ALTER TABLE properties ADD COLUMN unit_number VARCHAR(50) NULL AFTER community_type' },
    { name: 'plot_area_sqft', sql: 'ALTER TABLE properties ADD COLUMN plot_area_sqft INT NULL AFTER area_sqft' },
    { name: 'floor_number', sql: 'ALTER TABLE properties ADD COLUMN floor_number INT NULL AFTER parking_spaces' },
    { name: 'total_floors', sql: 'ALTER TABLE properties ADD COLUMN total_floors INT NULL AFTER floor_number' },
    { name: 'terrace_area_sqft', sql: 'ALTER TABLE properties ADD COLUMN terrace_area_sqft INT NULL AFTER plot_area_sqft' },
    { name: 'facing_direction', sql: 'ALTER TABLE properties ADD COLUMN facing_direction VARCHAR(50) NULL AFTER total_floors' }
  ];

  for (const col of columnsToAdd) {
    if (!existingColNames.has(col.name.toLowerCase())) {
      try {
        await pool.query(col.sql);
        console.log(` ✅ Added column: ${col.name}`);
      } catch (err) {
        console.error(` ❌ Error adding column ${col.name}:`, err.message);
      }
    } else {
      console.log(` ℹ️ Column already exists: ${col.name}`);
    }
  }

  console.log('🎉 Schema enhancements completed successfully.');
  process.exit(0);
}

migratePropertiesTable().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
