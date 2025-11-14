/**
 * ============================================================================
 * Queue Manager Service
 * ============================================================================
 *
 * Purpose: Manage user waiting queue and pair users for voice chat
 * Handles room creation, user pairing, and queue operations with Redis
 * Persists room data to PostgreSQL for analytics
 *
 * ============================================================================
 */

const { v4: uuidv4 } = require("uuid");
const { redisClient } = require("../../config/redisConfig");
const DatabaseService = require("./DatabaseService");

/**
 * Redis key prefixes for different data types
 */
const KEYS = {
  WAITING_QUEUE: "queue:waiting",
  ACTIVE_ROOMS: "rooms:active",
  USER_ROOM: "user:room:",
  ROOM_DATA: "room:data:",
  STATS: "stats:global",
};

class QueueManager {
  constructor() {
    this.redisClient = redisClient;
  }

  /**
   * Add user to waiting queue
   * @param {string} userId - Socket ID of the user
   * @param {object} userData - Additional user data
   * @returns {Promise<boolean>}
   */
  async addToQueue(userId, userData = {}) {
    try {
      const timestamp = Date.now();
      const queueEntry = JSON.stringify({
        userId,
        timestamp,
        ...userData,
      });

      await this.redisClient.zadd(KEYS.WAITING_QUEUE, timestamp, queueEntry);
      console.log(`✓ User ${userId} added to waiting queue`);
      return true;
    } catch (error) {
      console.error("Error adding user to queue:", error);
      return false;
    }
  }

  /**
   * Remove user from waiting queue
   * @param {string} userId - Socket ID of the user
   * @returns {Promise<boolean>}
   */
  async removeFromQueue(userId) {
    try {
      // Get all queue entries
      const entries = await this.redisClient.zrange(KEYS.WAITING_QUEUE, 0, -1);

      // Find and remove the user's entry
      for (const entry of entries) {
        const data = JSON.parse(entry);
        if (data.userId === userId) {
          await this.redisClient.zrem(KEYS.WAITING_QUEUE, entry);
          console.log(`✓ User ${userId} removed from waiting queue`);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error("Error removing user from queue:", error);
      return false;
    }
  }

  /**
   * Get next user from waiting queue (FIFO)
   * @returns {Promise<object|null>}
   */
  async getNextFromQueue() {
    try {
      const entries = await this.redisClient.zrange(
        KEYS.WAITING_QUEUE,
        0,
        0,
        "WITHSCORES"
      );

      if (entries.length === 0) {
        return null;
      }

      const userData = JSON.parse(entries[0]);
      await this.redisClient.zrem(KEYS.WAITING_QUEUE, entries[0]);
      return userData;
    } catch (error) {
      console.error("Error getting next from queue:", error);
      return null;
    }
  }

  /**
   * Get queue size
   * @returns {Promise<number>}
   */
  async getQueueSize() {
    try {
      return await this.redisClient.zcard(KEYS.WAITING_QUEUE);
    } catch (error) {
      console.error("Error getting queue size:", error);
      return 0;
    }
  }

  /**
   * Pair two users and create a room
   * @param {string} userId1 - First user's socket ID
   * @param {string} userId2 - Second user's socket ID
   * @returns {Promise<object|null>} Room data or null
   */
  async createRoom(userId1, userId2) {
    try {
      const roomId = uuidv4();
      const roomData = {
        roomId,
        users: [userId1, userId2],
        createdAt: Date.now(),
        status: "active",
      };

      // Store room data in Redis
      await this.redisClient.setex(
        `${KEYS.ROOM_DATA}${roomId}`,
        3600, // 1 hour TTL
        JSON.stringify(roomData)
      );

      // Map users to room
      await this.redisClient.setex(`${KEYS.USER_ROOM}${userId1}`, 3600, roomId);
      await this.redisClient.setex(`${KEYS.USER_ROOM}${userId2}`, 3600, roomId);

      // Add to active rooms set
      await this.redisClient.sadd(KEYS.ACTIVE_ROOMS, roomId);

      // Update statistics in Redis
      await this.incrementStat("totalRooms");

      // Persist to PostgreSQL (non-blocking)
      DatabaseService.saveRoom(roomId, userId1, userId2).catch((err) => {
        console.error("Error persisting room to database:", err.message);
      });

      console.log(
        `✓ Room ${roomId} created for users ${userId1} and ${userId2}`
      );
      return roomData;
    } catch (error) {
      console.error("Error creating room:", error);
      return null;
    }
  }

  /**
   * Get room by room ID
   * @param {string} roomId - Room ID
   * @returns {Promise<object|null>}
   */
  async getRoom(roomId) {
    try {
      const roomData = await this.redisClient.get(`${KEYS.ROOM_DATA}${roomId}`);
      return roomData ? JSON.parse(roomData) : null;
    } catch (error) {
      console.error("Error getting room:", error);
      return null;
    }
  }

  /**
   * Get room by user ID
   * @param {string} userId - User's socket ID
   * @returns {Promise<object|null>}
   */
  async getRoomByUser(userId) {
    try {
      const roomId = await this.redisClient.get(`${KEYS.USER_ROOM}${userId}`);
      if (!roomId) return null;

      return await this.getRoom(roomId);
    } catch (error) {
      console.error("Error getting room by user:", error);
      return null;
    }
  }

  /**
   * Close a room and clean up
   * @param {string} roomId - Room ID to close
   * @returns {Promise<boolean>}
   */
  async closeRoom(roomId) {
    try {
      const roomData = await this.getRoom(roomId);
      if (!roomData) return false;

      // Remove user mappings
      for (const userId of roomData.users) {
        await this.redisClient.del(`${KEYS.USER_ROOM}${userId}`);
      }

      // Remove room data
      await this.redisClient.del(`${KEYS.ROOM_DATA}${roomId}`);

      // Remove from active rooms set
      await this.redisClient.srem(KEYS.ACTIVE_ROOMS, roomId);

      // Update in PostgreSQL (non-blocking)
      DatabaseService.closeRoom(roomId).catch((err) => {
        console.error("Error closing room in database:", err.message);
      });

      console.log(`✓ Room ${roomId} closed`);
      return true;
    } catch (error) {
      console.error("Error closing room:", error);
      return false;
    }
  }

  /**
   * Get other user in room
   * @param {string} roomId - Room ID
   * @param {string} userId - Current user's ID
   * @returns {Promise<string|null>}
   */
  async getOtherUser(roomId, userId) {
    try {
      const roomData = await this.getRoom(roomId);
      if (!roomData) return null;

      return roomData.users.find((id) => id !== userId) || null;
    } catch (error) {
      console.error("Error getting other user:", error);
      return null;
    }
  }

  /**
   * Get all active rooms count
   * @returns {Promise<number>}
   */
  async getActiveRoomsCount() {
    try {
      return await this.redisClient.scard(KEYS.ACTIVE_ROOMS);
    } catch (error) {
      console.error("Error getting active rooms count:", error);
      return 0;
    }
  }

  /**
   * Increment a statistic
   * @param {string} statName - Statistic name
   * @returns {Promise<number>}
   */
  async incrementStat(statName) {
    try {
      return await this.redisClient.hincrby(KEYS.STATS, statName, 1);
    } catch (error) {
      console.error("Error incrementing stat:", error);
      return 0;
    }
  }

  /**
   * Get statistics
   * @returns {Promise<object>}
   */
  async getStats() {
    try {
      const stats = await this.redisClient.hgetall(KEYS.STATS);
      const queueSize = await this.getQueueSize();
      const activeRooms = await this.getActiveRoomsCount();

      return {
        totalRooms: parseInt(stats.totalRooms || 0),
        currentQueueSize: queueSize,
        activeRooms: activeRooms,
      };
    } catch (error) {
      console.error("Error getting stats:", error);
      return {
        totalRooms: 0,
        currentQueueSize: 0,
        activeRooms: 0,
      };
    }
  }

  /**
   * Check if user is in queue
   * @param {string} userId - User's socket ID
   * @returns {Promise<boolean>}
   */
  async isInQueue(userId) {
    try {
      const entries = await this.redisClient.zrange(KEYS.WAITING_QUEUE, 0, -1);

      for (const entry of entries) {
        const data = JSON.parse(entry);
        if (data.userId === userId) {
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error("Error checking if user in queue:", error);
      return false;
    }
  }
}

module.exports = new QueueManager();
