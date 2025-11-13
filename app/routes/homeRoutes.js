/**
 * ============================================================================
 * Home Routes
 * ============================================================================
 *
 * Purpose: Define routes for home page views
 * Maps URLs to HomeController methods
 *
 * MVC Pattern: Route Layer
 * ============================================================================
 */

const express = require("express");
const homeController = require("../controllers/HomeController");

/**
 * Create router instance
 * @type {express.Router}
 */
const router = express.Router();

/**
 * GET / - Home Page
 * Route: /
 * Controller: HomeController.getHome
 */
router.get("/", homeController.getHome);

/**
 * GET /about - About Page
 * Route: /about
 * Controller: HomeController.getAbout
 */
router.get("/about", homeController.getAbout);

/**
 * GET /contact - Contact Page
 * Route: /contact
 * Controller: HomeController.getContact
 */
router.get("/contact", homeController.getContact);

// ============================================================================
// MODULE EXPORTS
// ============================================================================

module.exports = router;
