/**
 * ============================================================================
 * PostgreSQL Database Configuration
 * ============================================================================
 *
 * Purpose: PostgreSQL connection pool and query management
 * Handles connection, reconnection, and error handling
 *
 * ============================================================================
 */

const { Pool } = require("pg");
const config = require("./config");

let pool = null;

// Only create pool if database is enabled
if (config.database.enabled) {
  /**
   * Create PostgreSQL connection pool
   */
  const poolConfig = {
    host: config.database.host,
    port: config.database.port,
    database: config.database.database,
    user: config.database.user,
    min: config.database.min,
    max: config.database.max,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };

  // Only add password if it exists and is not empty
  if (config.database.password && config.database.password.trim() !== '') {
    poolConfig.password = config.database.password;
  } else {
    // For local development without password, use empty string
    poolConfig.password = '';
  }

  if (config.isDevelopment) {
    console.log("PostgreSQL Pool Config:", {
      ...poolConfig,
      password: poolConfig.password ? "***" : undefined,
    });
  }

  pool = new Pool(poolConfig);
} else {
  // Create a mock pool that does nothing
  pool = {
    connect: async () => { throw new Error("Database is disabled"); },
    query: async () => { throw new Error("Database is disabled"); },
    end: async () => {},
    on: () => {},
  };
}

/**
 * Pool event handlers
 */
pool.on("connect", () => {
  if (config.isDevelopment) {
    console.log("✓ PostgreSQL: New client connected");
  }
});

pool.on("error", (err) => {
  console.error("✗ PostgreSQL Pool Error:", err.message);
});

pool.on("remove", () => {
  if (config.isDevelopment) {
    console.log("⚠ PostgreSQL: Client removed from pool");
  }
});

/**
 * Test database connection
 */
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query("SELECT NOW()");
    client.release();
    console.log("✓ PostgreSQL: Connected successfully");
    console.log(
      `✓ PostgreSQL: Database "${config.database.database}" is ready`
    );
    return true;
  } catch (error) {
    console.error("✗ PostgreSQL Connection Error:", error.message);
    return false;
  }
};

/**
 * Initialize database tables
 */
const initializeTables = async () => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Create users table (for future enhancements)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        socket_id VARCHAR(255) UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create rooms table
    await client.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id UUID PRIMARY KEY,
        user1_socket_id VARCHAR(255) NOT NULL,
        user2_socket_id VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        closed_at TIMESTAMP
      )
    `);

    // Create statistics table
    await client.query(`
      CREATE TABLE IF NOT EXISTS statistics (
        id SERIAL PRIMARY KEY,
        metric_name VARCHAR(100) UNIQUE NOT NULL,
        metric_value BIGINT DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Initialize statistics
    await client.query(`
      INSERT INTO statistics (metric_name, metric_value)
      VALUES ('total_rooms_created', 0)
      ON CONFLICT (metric_name) DO NOTHING
    `);

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_rooms_status 
      ON rooms(status)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_rooms_created_at 
      ON rooms(created_at)
    `);

    await client.query("COMMIT");
    console.log("✓ PostgreSQL: Database tables initialized");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("✗ PostgreSQL Table Initialization Error:", error.message);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Query helper function
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>}
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    if (config.isDevelopment) {
      console.log("Executed query:", { text, duration, rows: result.rowCount });
    }

    return result;
  } catch (error) {
    console.error("Query error:", error.message);
    throw error;
  }
};

/**
 * Get a client from the pool for transactions
 * @returns {Promise<Object>}
 */
const getClient = async () => {
  return await pool.connect();
};

/**
 * Close all connections
 */
const closePool = async () => {
  try {
    await pool.end();
    console.log("✓ PostgreSQL: All connections closed");
  } catch (error) {
    console.error("✗ Error closing PostgreSQL pool:", error.message);
  }
};

/**
 * Graceful shutdown handler
 */
const gracefulShutdown = async () => {
  console.log("\n⚠ PostgreSQL: Closing connections gracefully...");
  await closePool();
};

// Handle process termination
process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

module.exports = {
  pool,
  query,
  getClient,
  testConnection,
  initializeTables,
  closePool,
};
