/**
 * ============================================================================
 * Home Controller
 * ============================================================================
 *
 * Purpose: Handle business logic for home page views
 * Manages all view rendering and data preparation for home routes
 *
 * MVC Pattern: Controller Layer
 * ============================================================================
 */

/**
 * Controller: Get Home Page
 * Renders the home/welcome page with server information
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void} Renders home.ejs template
 */
exports.getHome = (req, res, next) => {
  try {
    const data = {
      title: "Home - Strenger Talk",
      message: "Welcome to Strenger Talk!",
      serverTime: new Date().toISOString(),
      uptime: process.uptime(),
    };

    res.render("home", data);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Get About Page
 * Renders the about page with application information
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void} Renders about.ejs template
 */
exports.getAbout = (req, res, next) => {
  try {
    const data = {
      title: "About - Strenger Talk",
      appName: "Strenger Talk",
      version: "1.0.0",
      description: "A professional Express.js server following MVC pattern",
      createdAt: "2025-11-13",
    };

    res.render("about", data);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Get Contact Page
 * Renders the contact page form
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void} Renders contact.ejs template
 */
exports.getContact = (req, res, next) => {
  try {
    const data = {
      title: "Contact - Strenger Talk",
    };

    res.render("contact", data);
  } catch (error) {
    next(error);
  }
};
