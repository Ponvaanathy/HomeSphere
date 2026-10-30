const pool = require('../config/db');

/**
 * TiDB Cloud & MySQL Distributed Sequence Service
 * 
 * Provides atomic, race-condition-free unique ID generation:
 * - Uses atomic `LAST_INSERT_ID(next_id + 1)` operations on the exact same database connection.
 * - Removes deprecated `VALUES(col)` upsert patterns for full TiDB compatibility.
 * - Manages concurrent sequence initialization and cold-starts safely with in-process mutexes.
 * - Ensures sequence resync is strictly monotonic (`GREATEST`) and never lowers counter values.
 * - Preserves all existing database records and ensures IDs start strictly above current table maximums.
 */
class SequenceService {
  constructor() {
    this.initialized = new Set();
    this.initPromises = new Map();
    this.tableEnsured = false;
  }

  /**
   * Ensures the lightweight sequence tracking table exists.
   */
  async ensureTable() {
    if (this.tableEnsured) return;
    await pool.query(`
      CREATE TABLE IF NOT EXISTS id_sequences (
        sequence_name VARCHAR(64) NOT NULL PRIMARY KEY,
        next_id BIGINT NOT NULL
      ) ENGINE=InnoDB
    `);
    this.tableEnsured = true;
  }

  /**
   * Initialize a sequence row safely starting from the target table's current MAX(id).
   * Safe for cold starts: Uses an in-memory Promise mutex to prevent concurrent DML conflicts.
   * Completely eliminates deprecated VALUES(col) syntax by using parameterized queries.
   */
  async initSequence(tableName, idColumn = 'id') {
    if (!/^[a-zA-Z0-9_]+$/.test(tableName) || !/^[a-zA-Z0-9_]+$/.test(idColumn)) {
      throw new Error(`Invalid identifier: ${tableName}.${idColumn}`);
    }

    // Mutex check: If initialization is already in flight for this table, await the existing task
    if (this.initPromises.has(tableName)) {
      return this.initPromises.get(tableName);
    }

    const initTask = (async () => {
      await this.ensureTable();

      // 1. Query the current maximum ID in the target table (preserves all existing records)
      const [maxRows] = await pool.query(
        `SELECT COALESCE(MAX(\`${idColumn}\`), 0) AS current_max FROM \`${tableName}\``
      );
      const currentMax = Number(maxRows[0]?.current_max || 0);

      // 2. Safe upsert: Parameterized GREATEST without deprecated VALUES(col) syntax
      await pool.query(
        `INSERT INTO id_sequences (sequence_name, next_id)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE next_id = GREATEST(id_sequences.next_id, ?)`,
        [tableName, currentMax, currentMax]
      );

      this.initialized.add(tableName);
    })();

    this.initPromises.set(tableName, initTask);
    try {
      await initTask;
    } finally {
      this.initPromises.delete(tableName);
    }
  }

  /**
   * Atomically generates and returns the next sequential ID.
   * Guarantees both UPDATE LAST_INSERT_ID(next_id + 1) and SELECT LAST_INSERT_ID()
   * execute on the exact same database connection before releasing it to the pool.
   *
   * @param {string} tableName - The table requiring an ID (e.g. 'users', 'user_preferences')
   * @param {string} idColumn - The primary key column name (defaults to 'id')
   * @returns {Promise<number>} - Next unique, monotonic ID
   */
  async getNextId(tableName, idColumn = 'id') {
    if (!/^[a-zA-Z0-9_]+$/.test(tableName) || !/^[a-zA-Z0-9_]+$/.test(idColumn)) {
      throw new Error(`Invalid identifier: ${tableName}.${idColumn}`);
    }

    // Cold-start check
    if (!this.initialized.has(tableName)) {
      await this.initSequence(tableName, idColumn);
    }

    // Acquire a dedicated connection to ensure session-scoped LAST_INSERT_ID() consistency
    const conn = await pool.getConnection();
    try {
      // 1. Atomically increment next_id and record it in connection session state
      const [updateRes] = await conn.query(
        `UPDATE id_sequences
         SET next_id = LAST_INSERT_ID(next_id + 1)
         WHERE sequence_name = ?`,
        [tableName]
      );

      // Self-heal: If row was missing, re-initialize and update on same connection
      if (updateRes.affectedRows === 0) {
        await this.initSequence(tableName, idColumn);
        await conn.query(
          `UPDATE id_sequences
           SET next_id = LAST_INSERT_ID(next_id + 1)
           WHERE sequence_name = ?`,
          [tableName]
        );
      }

      // 2. Fetch the ID generated on this EXACT same connection
      const [rows] = await conn.query('SELECT LAST_INSERT_ID() AS next_id');
      const allocatedId = Number(rows[0]?.next_id);

      if (!allocatedId || isNaN(allocatedId)) {
        throw new Error(`Failed to allocate atomic sequence ID for table "${tableName}"`);
      }

      return allocatedId;
    } finally {
      // 3. Always release connection back to pool
      conn.release();
    }
  }

  /**
   * Monotonic, concurrency-safe resync.
   * Advances sequence counter to strictly match or exceed the table's current MAX(id).
   * Uses GREATEST to guarantee it NEVER lowers an existing sequence counter.
   *
   * @param {string} tableName - Target table name
   * @param {string} idColumn - Target primary key column name
   */
  async resync(tableName, idColumn = 'id') {
    await this.ensureTable();
    if (!/^[a-zA-Z0-9_]+$/.test(tableName) || !/^[a-zA-Z0-9_]+$/.test(idColumn)) {
      throw new Error(`Invalid identifier: ${tableName}.${idColumn}`);
    }

    const [maxRows] = await pool.query(
      `SELECT COALESCE(MAX(\`${idColumn}\`), 0) AS current_max FROM \`${tableName}\``
    );
    const currentMax = Number(maxRows[0]?.current_max || 0);

    // Atomic monotonic upsert: preserves the greater of current counter and table MAX(id)
    await pool.query(
      `INSERT INTO id_sequences (sequence_name, next_id)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE next_id = GREATEST(id_sequences.next_id, ?)`,
      [tableName, currentMax, currentMax]
    );
  }
}

const sequenceService = new SequenceService();

module.exports = sequenceService;
