/**
 * ============================================================================
 * API Routes
 * ============================================================================
 *
 * Purpose: Define routes for API endpoints
 * Maps URLs to ApiController methods for JSON responses
 *
 * MVC Pattern: Route Layer
 * ============================================================================
 */

const express = require("express");
const apiController = require("../controllers/ApiController");

/**
 * Create router instance
 * @type {express.Router}
 */
const router = express.Router();

/**
 * GET /status - Server Status
 * Route: /api/status
 * Controller: ApiController.getStatus
 * Response: JSON with server status information
 */
router.get("/status", apiController.getStatus);

/**
 * GET /info - Server Information
 * Route: /api/info
 * Controller: ApiController.getServerInfo
 * Response: JSON with application info
 */
router.get("/info", apiController.getServerInfo);

/**
 * POST /contact - Submit Contact Form
 * Route: /api/contact
 * Controller: ApiController.submitForm
 * Request: JSON with form data (name, email, message)
 * Response: JSON with submission result
 */
router.post("/contact", apiController.submitForm);

// ============================================================================
// MODULE EXPORTS
// ============================================================================

module.exports = router;
