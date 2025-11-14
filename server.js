/**
 * ============================================================================
 * WebRTC Voice Chat Server - MVC Pattern with Socket.io
 * ============================================================================
 *
 * Purpose: Initialize and configure WebRTC-based random voice chat server
 * Following MVC pattern with real-time WebRTC signaling via Socket.io
 * Features: Peer-to-peer audio, Redis queue management, TURN/STUN support
 *
 * Environment: Node.js
 * ============================================================================
 */

// ============================================================================
// DEPENDENCIES
// ============================================================================

const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const path = require("path");

// ============================================================================
// CONFIGURATION IMPORTS
// ============================================================================

const config = require("./config/config");
const { redisClient, closeRedisConnection } = require("./config/redisConfig");
const {
  testConnection: testDbConnection,
  initializeTables,
  closePool,
} = require("./config/dbConfig");

// ============================================================================
// ROUTE IMPORTS
// ============================================================================

const homeRoutes = require("./app/routes/homeRoutes");
const apiRoutes = require("./app/routes/apiRoutes");

// ============================================================================
// SERVICE IMPORTS
// ============================================================================

const SignalingService = require("./app/services/SignalingService");

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Initialize the Express application instance
 * @type {Express.Application}
 */
const app = express();

/**
 * Create HTTP server for Socket.io integration
 * @type {http.Server}
 */
const server = http.createServer(app);

/**
 * Initialize Socket.io with CORS support
 * @type {socketIo.Server}
 */
const io = socketIo(server, {
  cors: {
    origin: config.server.corsOrigin,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
  pingInterval: 25000,
});

/**
 * Server port configuration
 * @type {number}
 */
const PORT = config.server.port;

// ============================================================================
// MIDDLEWARE SETUP
// ============================================================================

/**
 * Middleware: Enable CORS for cross-origin requests
 */
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
  })
);

/**
 * Middleware: Parse incoming JSON request bodies
 * Enables automatic JSON parsing for application/json content-type
 */
app.use(express.json());

/**
 * Middleware: Parse incoming form-encoded request bodies
 * Enables automatic parsing for application/x-www-form-urlencoded content-type
 */
app.use(express.urlencoded({ extended: true }));

/**
 * Middleware: Set up EJS as view engine
 * EJS (Embedded JavaScript) allows dynamic HTML rendering
 */
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "app/views"));

/**
 * Middleware: Serve static files from the 'public' directory
 * Allows serving images, documents, and other static assets
 */
app.use(express.static(path.join(__dirname, "public")));

// ============================================================================
// SOCKET.IO INITIALIZATION
// ============================================================================

/**
 * Initialize WebRTC Signaling Service
 * Handles all real-time communication for voice chat
 */
new SignalingService(io);

console.log("✓ Socket.io and SignalingService initialized");

// ============================================================================
// ROUTE REGISTRATION
// ============================================================================

/**
 * Mount home routes
 * Handles view-related requests (HTML pages)
 */
app.use("/", homeRoutes);

/**
 * Mount API routes
 * Handles API endpoints (JSON responses)
 */
app.use("/api", apiRoutes);

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Middleware: 404 Not Found Handler
 * Catches all requests that don't match defined routes
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
app.use((req, res) => {
  res.status(404).render("errors/404", {
    url: req.originalUrl,
  });
});

/**
 * Middleware: Global Error Handler
 * Catches and handles all errors thrown in the application
 *
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  res.status(err.status || 500).render("errors/500", {
    error: err.message,
  });
});

// ============================================================================
// SERVER INITIALIZATION
// ============================================================================

/**
 * Initialize database and start server
 */
const startServer = async () => {
  try {
    // Test database connection only if enabled
    if (config.database.enabled) {
      const dbConnected = await testDbConnection();

      if (dbConnected) {
        // Initialize database tables
        await initializeTables();
      } else {
        console.warn(
          "⚠ PostgreSQL: Connection failed, continuing without database"
        );
      }
    } else {
      console.log("ℹ PostgreSQL: Disabled (DB_ENABLED=false)");
    }

    // Start HTTP server
    server.listen(PORT, () => {
      console.log(`
  ============================================================================
  🎙️  WebRTC Voice Chat Server Started Successfully
  ============================================================================
  
  Server URL: http://localhost:${PORT}
  Environment: ${config.nodeEnv}
  Log Level: ${config.logging.level}
  Port: ${PORT}
  Timestamp: ${new Date().toISOString()}
  
  Features:
  ✓ WebRTC peer-to-peer audio communication
  ✓ Socket.io real-time signaling
  ✓ Redis queue management
  ✓ PostgreSQL persistent storage
  ✓ TURN/STUN server support for NAT traversal
  
  Application Structure:
  - /app/controllers  - Business logic
  - /app/services     - WebRTC signaling & queue management
  - /app/views        - EJS templates
  - /app/routes       - Route definitions
  - /config           - Config, Redis, PostgreSQL, TURN setup
  - /public           - Static files & WebRTC client
  
  Press Ctrl+C to stop the server
  ============================================================================
      `);
    });
  } catch (error) {
    console.error("✗ Server Initialization Error:", error.message);
    process.exit(1);
  }
};

// Start the server
startServer();

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

/**
 * Handle graceful shutdown on SIGTERM/SIGINT
 */
const gracefulShutdown = async () => {
  console.log("\n⚠ Received shutdown signal, closing server gracefully...");

  // Close HTTP server
  server.close(async () => {
    console.log("✓ HTTP server closed");

    // Close Redis connections
    await closeRedisConnection();

    // Close PostgreSQL connections
    await closePool();

    // Close Socket.io connections
    io.close(() => {
      console.log("✓ Socket.io connections closed");
      process.exit(0);
    });
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error("✗ Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// ============================================================================
// MODULE EXPORTS
// ============================================================================

module.exports = { app, server, io };
