/**
 * ============================================================================
 * WebRTC Signaling Service
 * ============================================================================
 *
 * Purpose: Handle WebRTC signaling between peers via Socket.io
 * Manages offer/answer exchange, ICE candidate exchange, and connection state
 *
 * ============================================================================
 */

const QueueManager = require("./QueueManager");
const { peerConnectionConfig } = require("../../config/turnConfig");

class SignalingService {
  constructor(io) {
    this.io = io;
    this.setupSocketHandlers();
  }

  /**
   * Set up Socket.io event handlers
   */
  setupSocketHandlers() {
    this.io.on("connection", (socket) => {
      console.log(`✓ User connected: ${socket.id}`);

      // Send ICE server configuration to client
      socket.emit("ice-servers", peerConnectionConfig.iceServers);

      // Handle user looking for a chat partner
      socket.on("find-partner", async () => {
        await this.handleFindPartner(socket);
      });

      // Handle WebRTC offer
      socket.on("offer", async (data) => {
        await this.handleOffer(socket, data);
      });

      // Handle WebRTC answer
      socket.on("answer", async (data) => {
        await this.handleAnswer(socket, data);
      });

      // Handle ICE candidate
      socket.on("ice-candidate", async (data) => {
        await this.handleIceCandidate(socket, data);
      });

      // Handle user leaving chat
      socket.on("leave-chat", async () => {
        await this.handleLeaveChat(socket);
      });

      // Handle disconnection
      socket.on("disconnect", async () => {
        await this.handleDisconnect(socket);
      });

      // Handle skip partner
      socket.on("skip-partner", async () => {
        await this.handleSkipPartner(socket);
      });
    });
  }

  /**
   * Handle user looking for a chat partner
   * @param {Socket} socket - Socket.io socket instance
   */
  async handleFindPartner(socket) {
    try {
      console.log(`User ${socket.id} looking for partner...`);

      // Check if user is already in a room
      const existingRoom = await QueueManager.getRoomByUser(socket.id);
      if (existingRoom) {
        socket.emit("error", {
          message: "You are already in a chat",
        });
        return;
      }

      // Check if user is already in queue
      const inQueue = await QueueManager.isInQueue(socket.id);
      if (inQueue) {
        socket.emit("waiting", {
          message: "Already searching for a partner...",
        });
        return;
      }

      // Try to find a partner from the queue
      const partner = await QueueManager.getNextFromQueue();

      if (partner && partner.userId !== socket.id) {
        // Found a partner! Create a room
        const room = await QueueManager.createRoom(socket.id, partner.userId);

        if (room) {
          // Join both users to the Socket.io room
          socket.join(room.roomId);
          this.io.sockets.sockets.get(partner.userId)?.join(room.roomId);

          // Notify both users that they've been matched
          socket.emit("matched", {
            roomId: room.roomId,
            isInitiator: true, // This user should create the offer
          });

          this.io.to(partner.userId).emit("matched", {
            roomId: room.roomId,
            isInitiator: false, // This user should wait for offer
          });

          console.log(
            `✓ Matched users ${socket.id} and ${partner.userId} in room ${room.roomId}`
          );
        } else {
          // Failed to create room, add both back to queue
          await QueueManager.addToQueue(socket.id);
          await QueueManager.addToQueue(partner.userId);
          socket.emit("error", {
            message: "Failed to create chat room. Please try again.",
          });
        }
      } else {
        // No partner available, add user to queue
        await QueueManager.addToQueue(socket.id);
        socket.emit("waiting", {
          message: "Searching for a partner...",
        });

        // Get current queue size and send to user
        const queueSize = await QueueManager.getQueueSize();
        socket.emit("queue-update", { position: queueSize });

        console.log(
          `User ${socket.id} added to queue (position: ${queueSize})`
        );
      }
    } catch (error) {
      console.error("Error in handleFindPartner:", error);
      socket.emit("error", {
        message: "An error occurred while searching for a partner",
      });
    }
  }

  /**
   * Handle WebRTC offer from initiating peer
   * @param {Socket} socket - Socket.io socket instance
   * @param {object} data - Offer data
   */
  async handleOffer(socket, data) {
    try {
      const { offer, roomId } = data;

      if (!offer || !roomId) {
        socket.emit("error", { message: "Invalid offer data" });
        return;
      }

      // Get the other user in the room
      const partnerId = await QueueManager.getOtherUser(roomId, socket.id);

      if (partnerId) {
        // Forward the offer to the partner
        this.io.to(partnerId).emit("offer", {
          offer,
          roomId,
        });

        console.log(`✓ Forwarded offer from ${socket.id} to ${partnerId}`);
      } else {
        socket.emit("error", {
          message: "Partner not found",
        });
      }
    } catch (error) {
      console.error("Error in handleOffer:", error);
      socket.emit("error", {
        message: "Failed to send offer",
      });
    }
  }

  /**
   * Handle WebRTC answer from receiving peer
   * @param {Socket} socket - Socket.io socket instance
   * @param {object} data - Answer data
   */
  async handleAnswer(socket, data) {
    try {
      const { answer, roomId } = data;

      if (!answer || !roomId) {
        socket.emit("error", { message: "Invalid answer data" });
        return;
      }

      // Get the other user in the room
      const partnerId = await QueueManager.getOtherUser(roomId, socket.id);

      if (partnerId) {
        // Forward the answer to the partner
        this.io.to(partnerId).emit("answer", {
          answer,
          roomId,
        });

        console.log(`✓ Forwarded answer from ${socket.id} to ${partnerId}`);
      } else {
        socket.emit("error", {
          message: "Partner not found",
        });
      }
    } catch (error) {
      console.error("Error in handleAnswer:", error);
      socket.emit("error", {
        message: "Failed to send answer",
      });
    }
  }

  /**
   * Handle ICE candidate exchange
   * @param {Socket} socket - Socket.io socket instance
   * @param {object} data - ICE candidate data
   */
  async handleIceCandidate(socket, data) {
    try {
      const { candidate, roomId } = data;

      if (!candidate || !roomId) {
        return; // ICE candidates can be null (end-of-candidates)
      }

      // Get the other user in the room
      const partnerId = await QueueManager.getOtherUser(roomId, socket.id);

      if (partnerId) {
        // Forward the ICE candidate to the partner
        this.io.to(partnerId).emit("ice-candidate", {
          candidate,
          roomId,
        });

        console.log(
          `✓ Forwarded ICE candidate from ${socket.id} to ${partnerId}`
        );
      }
    } catch (error) {
      console.error("Error in handleIceCandidate:", error);
    }
  }

  /**
   * Handle user leaving chat
   * @param {Socket} socket - Socket.io socket instance
   */
  async handleLeaveChat(socket) {
    try {
      console.log(`User ${socket.id} leaving chat...`);

      // Get user's current room
      const room = await QueueManager.getRoomByUser(socket.id);

      if (room) {
        // Get the other user
        const partnerId = await QueueManager.getOtherUser(
          room.roomId,
          socket.id
        );

        // Notify partner that user left
        if (partnerId) {
          this.io.to(partnerId).emit("partner-left", {
            message: "Your partner has left the chat",
          });

          // Leave Socket.io room
          this.io.sockets.sockets.get(partnerId)?.leave(room.roomId);
        }

        // Leave Socket.io room
        socket.leave(room.roomId);

        // Close the room
        await QueueManager.closeRoom(room.roomId);

        console.log(`✓ User ${socket.id} left room ${room.roomId}`);
      }

      // Remove from queue if waiting
      await QueueManager.removeFromQueue(socket.id);

      socket.emit("left-chat", {
        message: "You have left the chat",
      });
    } catch (error) {
      console.error("Error in handleLeaveChat:", error);
      socket.emit("error", {
        message: "Failed to leave chat",
      });
    }
  }

  /**
   * Handle user disconnection
   * @param {Socket} socket - Socket.io socket instance
   */
  async handleDisconnect(socket) {
    try {
      console.log(`User disconnected: ${socket.id}`);

      // Get user's current room
      const room = await QueueManager.getRoomByUser(socket.id);

      if (room) {
        // Get the other user
        const partnerId = await QueueManager.getOtherUser(
          room.roomId,
          socket.id
        );

        // Notify partner that user disconnected
        if (partnerId) {
          this.io.to(partnerId).emit("partner-disconnected", {
            message: "Your partner has disconnected",
          });

          // Leave Socket.io room
          this.io.sockets.sockets.get(partnerId)?.leave(room.roomId);
        }

        // Close the room
        await QueueManager.closeRoom(room.roomId);
      }

      // Remove from queue if waiting
      await QueueManager.removeFromQueue(socket.id);
    } catch (error) {
      console.error("Error in handleDisconnect:", error);
    }
  }

  /**
   * Handle skip partner (same as leave, but user wants to find new partner)
   * @param {Socket} socket - Socket.io socket instance
   */
  async handleSkipPartner(socket) {
    await this.handleLeaveChat(socket);

    // Automatically search for new partner after a short delay
    setTimeout(async () => {
      await this.handleFindPartner(socket);
    }, 500);
  }
}

module.exports = SignalingService;
