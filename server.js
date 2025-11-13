/**
 * ============================================================================
 * Express.js Server Entry Point - MVC Pattern
 * ============================================================================
 *
 * Purpose: Initialize and configure the main Express application server
 * Following MVC (Model-View-Controller) architectural pattern
 * This module sets up middleware, routes, and error handling
 *
 * Environment: Node.js
 * ============================================================================
 */

// ============================================================================
// DEPENDENCIES
// ============================================================================

const express = require("express");
const path = require("path");

// ============================================================================
// ROUTE IMPORTS
// ============================================================================

const homeRoutes = require("./app/routes/homeRoutes");
const apiRoutes = require("./app/routes/apiRoutes");

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Initialize the Express application instance
 * @type {Express.Application}
 */
const app = express();

/**
 * Server port configuration
 * Uses environment variable PORT if available, defaults to 3000
 * @type {number}
 */
const PORT = process.env.PORT || 3000;

// ============================================================================
// MIDDLEWARE SETUP
// ============================================================================

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
 * Start the Express server
 * Listen on the configured PORT and log startup information
 */
app.listen(PORT, () => {
  console.log(`
  ============================================================================
  🚀 Express Server Started Successfully (MVC Pattern)
  ============================================================================
  
  Server URL: http://localhost:${PORT}
  Environment: ${process.env.NODE_ENV || "development"}
  Port: ${PORT}
  Timestamp: ${new Date().toISOString()}
  
  Application Structure:
  - /app/controllers  - Business logic
  - /app/models       - Data models
  - /app/views        - EJS templates
  - /app/routes       - Route definitions
  - /public           - Static files
  
  Press Ctrl+C to stop the server
  ============================================================================
  `);
});

// ============================================================================
// MODULE EXPORTS
// ============================================================================

module.exports = app;
