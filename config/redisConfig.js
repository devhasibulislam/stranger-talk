/**
 * ============================================================================
 * Redis Configuration
 * ============================================================================
 *
 * Purpose: Configure Redis connection for queue management and scaling
 * Handles connection, reconnection, and error handling
 *
 * ============================================================================
 */

const Redis = require("ioredis");
const config = require("./config");

/**
 * Redis connection configuration
 */
const redisConfig = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  db: config.redis.db,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
};

/**
 * Create Redis client instance
 */
const redisClient = new Redis(redisConfig);

/**
 * Redis connection event handlers
 */
redisClient.on("connect", () => {
  console.log("✓ Redis: Connected successfully");
});

redisClient.on("ready", () => {
  console.log("✓ Redis: Ready to accept commands");
});

redisClient.on("error", (error) => {
  console.error("✗ Redis Error:", error.message);
});

redisClient.on("close", () => {
  console.log("⚠ Redis: Connection closed");
});

redisClient.on("reconnecting", () => {
  console.log("↻ Redis: Attempting to reconnect...");
});

/**
 * Create a second Redis client for pub/sub operations
 * Note: In Redis, once a client enters pub/sub mode, it cannot perform regular commands
 */
const redisPubSubClient = new Redis(redisConfig);

redisPubSubClient.on("connect", () => {
  console.log("✓ Redis Pub/Sub: Connected successfully");
});

redisPubSubClient.on("error", (error) => {
  console.error("✗ Redis Pub/Sub Error:", error.message);
});

/**
 * Graceful shutdown handler
 */
const closeRedisConnection = async () => {
  try {
    await redisClient.quit();
    await redisPubSubClient.quit();
    console.log("✓ Redis connections closed gracefully");
  } catch (error) {
    console.error("✗ Error closing Redis connections:", error.message);
    redisClient.disconnect();
    redisPubSubClient.disconnect();
  }
};

// Handle process termination
process.on("SIGINT", closeRedisConnection);
process.on("SIGTERM", closeRedisConnection);

module.exports = {
  redisClient,
  redisPubSubClient,
  closeRedisConnection,
};
