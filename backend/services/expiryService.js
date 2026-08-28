const pool = require('../config/db');

/**
 * Lightweight background auto-expiry routine.
 * Marks properties whose expires_at timestamp has passed as 'expired'.
 */
async function checkAndExpireListings() {
  try {
    const [result] = await pool.query(`
      UPDATE properties
      SET status = 'expired', updated_at = NOW()
      WHERE expires_at IS NOT NULL
        AND expires_at < NOW()
        AND status = 'active'
    `);

    if (result.affectedRows > 0) {
      console.log(`⏱️ [Auto-Expiry] Marked ${result.affectedRows} outdated listing(s) as expired.`);
    }
    return result.affectedRows;
  } catch (err) {
    console.error('Error during auto-expiry check:', err.message);
    return 0;
  }
}

/**
 * Initializes auto-expiry job on server startup.
 * Runs check immediately, then schedules check every hour.
 */
function startExpiryJob() {
  // Initial check
  checkAndExpireListings();

  // Hourly interval (3600000 ms)
  setInterval(() => {
    checkAndExpireListings();
  }, 3600000);
}

module.exports = {
  checkAndExpireListings,
  startExpiryJob
};
