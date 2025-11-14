/**
 * ============================================================================
 * Database Service
 * ============================================================================
 *
 * Purpose: Handle PostgreSQL operations for rooms and statistics
 * Provides persistent storage alongside Redis queue management
 *
 * ============================================================================
 */

const { query } = require("../../config/dbConfig");

/**
 * Save room information to database
 * @param {string} roomId - Unique room identifier
 * @param {string} user1SocketId - First user's socket ID
 * @param {string} user2SocketId - Second user's socket ID
 * @returns {Promise<Object>}
 */
const saveRoom = async (roomId, user1SocketId, user2SocketId) => {
  try {
    const result = await query(
      `INSERT INTO rooms (id, user1_socket_id, user2_socket_id, status, created_at)
       VALUES ($1, $2, $3, 'active', CURRENT_TIMESTAMP)
       RETURNING *`,
      [roomId, user1SocketId, user2SocketId]
    );
    return result.rows[0];
  } catch (error) {
    console.error("Error saving room:", error.message);
    throw error;
  }
};

/**
 * Close a room in the database
 * @param {string} roomId - Room identifier to close
 * @returns {Promise<Object>}
 */
const closeRoom = async (roomId) => {
  try {
    const result = await query(
      `UPDATE rooms 
       SET status = 'closed', closed_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [roomId]
    );
    return result.rows[0];
  } catch (error) {
    console.error("Error closing room:", error.message);
    throw error;
  }
};

/**
 * Get active rooms count
 * @returns {Promise<number>}
 */
const getActiveRoomsCount = async () => {
  try {
    const result = await query(
      `SELECT COUNT(*) as count 
       FROM rooms 
       WHERE status = 'active'`
    );
    return parseInt(result.rows[0].count);
  } catch (error) {
    console.error("Error getting active rooms count:", error.message);
    return 0;
  }
};

/**
 * Get total rooms created
 * @returns {Promise<number>}
 */
const getTotalRoomsCreated = async () => {
  try {
    const result = await query(`SELECT COUNT(*) as count FROM rooms`);
    return parseInt(result.rows[0].count);
  } catch (error) {
    console.error("Error getting total rooms:", error.message);
    return 0;
  }
};

/**
 * Increment statistics counter
 * @param {string} metricName - Name of the metric to increment
 * @returns {Promise<void>}
 */
const incrementStatistic = async (metricName) => {
  try {
    await query(
      `INSERT INTO statistics (metric_name, metric_value, updated_at)
       VALUES ($1, 1, CURRENT_TIMESTAMP)
       ON CONFLICT (metric_name)
       DO UPDATE SET 
         metric_value = statistics.metric_value + 1,
         updated_at = CURRENT_TIMESTAMP`,
      [metricName]
    );
  } catch (error) {
    console.error("Error incrementing statistic:", error.message);
  }
};

/**
 * Get statistic value
 * @param {string} metricName - Name of the metric
 * @returns {Promise<number>}
 */
const getStatistic = async (metricName) => {
  try {
    const result = await query(
      `SELECT metric_value FROM statistics WHERE metric_name = $1`,
      [metricName]
    );
    return result.rows.length > 0 ? parseInt(result.rows[0].metric_value) : 0;
  } catch (error) {
    console.error("Error getting statistic:", error.message);
    return 0;
  }
};

/**
 * Get all statistics
 * @returns {Promise<Object>}
 */
const getAllStatistics = async () => {
  try {
    const [activeRooms, totalRooms] = await Promise.all([
      getActiveRoomsCount(),
      getTotalRoomsCreated(),
    ]);

    return {
      activeRooms,
      totalRooms,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error getting all statistics:", error.message);
    return {
      activeRooms: 0,
      totalRooms: 0,
      timestamp: new Date().toISOString(),
    };
  }
};

/**
 * Get recent rooms (last 100)
 * @returns {Promise<Array>}
 */
const getRecentRooms = async () => {
  try {
    const result = await query(
      `SELECT id, status, created_at, closed_at
       FROM rooms
       ORDER BY created_at DESC
       LIMIT 100`
    );
    return result.rows;
  } catch (error) {
    console.error("Error getting recent rooms:", error.message);
    return [];
  }
};

module.exports = {
  saveRoom,
  closeRoom,
  getActiveRoomsCount,
  getTotalRoomsCreated,
  incrementStatistic,
  getStatistic,
  getAllStatistics,
  getRecentRooms,
};
