/**
 * ============================================================================
 * API Controller
 * ============================================================================
 *
 * Purpose: Handle business logic for API endpoints
 * Manages data retrieval and JSON responses for API routes
 *
 * MVC Pattern: Controller Layer
 * ============================================================================
 */

/**
 * Controller: Get Status
 * Returns detailed server status information in JSON format
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with server status
 */
exports.getStatus = (req, res, next) => {
  try {
    const status = {
      status: "active",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
    };

    res.status(200).json(status);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Get Server Info
 * Returns basic server information
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with server info
 */
exports.getServerInfo = (req, res, next) => {
  try {
    const info = {
      name: "Strenger Talk",
      version: "1.0.0",
      environment: process.env.NODE_ENV || "development",
      timestamp: new Date().toISOString(),
      message: "Express.js server running with MVC pattern",
    };

    res.status(200).json(info);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Handle Form Submission
 * Processes contact form submission (example)
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with submission result
 */
exports.submitForm = (req, res, next) => {
  try {
    const { name, email, message } = req.body;

    // Basic validation
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Process form data (example: would save to database)
    const result = {
      success: true,
      message: "Form submitted successfully",
      data: {
        name,
        email,
        message,
        receivedAt: new Date().toISOString(),
      },
    };

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
