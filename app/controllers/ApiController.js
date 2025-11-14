/**
 * ============================================================================
 * API Controller
 * ============================================================================
 *
 * Purpose: Handle business logic for API endpoints
 * Manages data retrieval and JSON responses for API routes
 * Includes WebRTC voice chat statistics and monitoring
 *
 * MVC Pattern: Controller Layer
 * ============================================================================
 */

const QueueManager = require("../services/QueueManager");
const DatabaseService = require("../services/DatabaseService");
const config = require("../../config/config");

/**
 * Controller: Get Status
 * Returns detailed server status information in JSON format
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with server status
 */
exports.getStatus = async (req, res, next) => {
  try {
    // Get chat statistics from both Redis and PostgreSQL
    const stats = await QueueManager.getStats();
    const dbStats = await DatabaseService.getAllStatistics();

    const status = {
      status: "active",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      environment: config.nodeEnv,
      voiceChat: {
        activeRooms: stats.activeRooms,
        usersInQueue: stats.currentQueueSize,
        totalRoomsCreated: stats.totalRooms,
        database: dbStats,
      },
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
      version: "2.0.0",
      description: "WebRTC-based random voice chat application",
      environment: config.nodeEnv,
      timestamp: new Date().toISOString(),
      features: [
        "Peer-to-peer WebRTC audio",
        "Real-time Socket.io signaling",
        "Redis queue management",
        "PostgreSQL persistent storage",
        "TURN/STUN NAT traversal",
        "Random user pairing",
      ],
    };

    res.status(200).json(info);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Get Voice Chat Statistics
 * Returns current voice chat statistics
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with chat statistics
 */
exports.getChatStats = async (req, res, next) => {
  try {
    const stats = await QueueManager.getStats();

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      statistics: {
        activeRooms: stats.activeRooms,
        usersWaiting: stats.currentQueueSize,
        totalRoomsCreated: stats.totalRooms,
        serverUptime: process.uptime(),
      },
    };

    res.status(200).json(response);
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
