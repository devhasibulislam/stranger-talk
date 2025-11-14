/**
 * ============================================================================
 * Application Configuration
 * ============================================================================
 *
 * Purpose: Centralized configuration management
 * Loads environment-specific variables from .env files
 *
 * ============================================================================
 */

require("dotenv").config({
  path: `.env.${process.env.NODE_ENV || "development"}`,
});

const config = {
  // Environment
  nodeEnv: process.env.NODE_ENV || "development",
  env: process.env.NODE_ENV || "development",
  isDevelopment: process.env.NODE_ENV === "development",
  isProduction: process.env.NODE_ENV === "production",

  // Server Configuration
  server: {
    port: parseInt(process.env.PORT || "3000", 10),
    corsOrigin: process.env.CORS_ORIGIN || "*",
  },

  // PostgreSQL Database Configuration
  database: {
    enabled: process.env.DB_ENABLED === "true",
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    database: process.env.DB_NAME || "strenger_talk_dev",
    user: process.env.DB_USER || "prokken",
    password:
      (process.env.DB_PASSWORD && process.env.DB_PASSWORD.trim()) || undefined,
    min: parseInt(process.env.DB_POOL_MIN || "2", 10),
    max: parseInt(process.env.DB_POOL_MAX || "10", 10),
  },

  // Redis Configuration
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || "0", 10),
  },

  // TURN/STUN Configuration
  turn: {
    serverUrl: process.env.TURN_SERVER_URL || null,
    secureServerUrl: process.env.TURNS_SERVER_URL || null,
    username: process.env.TURN_USERNAME || null,
    password: process.env.TURN_PASSWORD || null,
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || "info",
  },
};

// Validate required configuration
const validateConfig = () => {
  const required = [
    { key: "server.port", value: config.server.port },
    { key: "database.host", value: config.database.host },
    { key: "database.database", value: config.database.database },
    { key: "redis.host", value: config.redis.host },
  ];

  const missing = required.filter((item) => !item.value);

  if (missing.length > 0) {
    console.error("❌ Missing required configuration:");
    missing.forEach((item) => console.error(`   - ${item.key}`));
    process.exit(1);
  }
};

// Validate on load
validateConfig();

// Log configuration on startup (development only)
if (config.isDevelopment) {
  console.log("\n📋 Configuration loaded:");
  console.log(`   Environment: ${config.env}`);
  console.log(`   Port: ${config.server.port}`);
  console.log(`   Database: ${config.database.database}`);
  console.log(`   Redis: ${config.redis.host}:${config.redis.port}`);
  console.log("");
}

module.exports = config;
