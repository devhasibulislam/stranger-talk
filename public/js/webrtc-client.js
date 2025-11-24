/**
 * ============================================================================
 * WebRTC Voice Chat Client
 * ============================================================================
 *
 * Purpose: Handle WebRTC peer connections and Socket.io communication
 * Features: Microphone capture, peer-to-peer audio, signaling
 *
 * ============================================================================
 */

class VoiceChatClient {
  constructor() {
    // Socket.io connection
    this.socket = null;

    // WebRTC peer connection
    this.peerConnection = null;

    // Media stream
    this.localStream = null;
    this.remoteStream = null;

    // Room information
    this.currentRoomId = null;
    this.isInitiator = false;

    // ICE servers (received from server)
    this.iceServers = [];

    // ICE candidate queue (for candidates received before remote description)
    this.iceCandidateQueue = [];

    // Connection state
    this.isConnecting = false;
    this.isConnected = false;

    // UI elements
    this.initializeUI();

    // Initialize Socket.io connection
    this.initializeSocket();
  }

  /**
   * Initialize UI element references
   */
  initializeUI() {
    this.ui = {
      statusText: document.getElementById("status-text"),
      connectBtn: document.getElementById("connect-btn"),
      disconnectBtn: document.getElementById("disconnect-btn"),
      skipBtn: document.getElementById("skip-btn"),
      statusIndicator: document.getElementById("status-indicator"),
      volumeMeter: document.getElementById("volume-meter"),
      volumeFill: document.getElementById("volume-fill"),
      errorMessage: document.getElementById("error-message"),
      queuePosition: document.getElementById("queue-position"),
    };

    // Attach event listeners
    this.ui.connectBtn?.addEventListener("click", () => this.startChat());
    this.ui.disconnectBtn?.addEventListener("click", () => this.disconnect());
    this.ui.skipBtn?.addEventListener("click", () => this.skipPartner());
  }

  /**
   * Initialize Socket.io connection
   */
  initializeSocket() {
    this.socket = io({
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    // Socket connection events
    this.socket.on("connect", () => {
      console.log("✓ Connected to signaling server");
      this.updateStatus("Connected to server", "success");
    });

    this.socket.on("disconnect", () => {
      console.log("✗ Disconnected from signaling server");
      this.updateStatus("Disconnected from server", "error");
      this.cleanup();
    });

    // Receive ICE servers from server
    this.socket.on("ice-servers", (servers) => {
      this.iceServers = servers;
      console.log("✓ Received ICE servers configuration");
    });

    // Waiting for partner
    this.socket.on("waiting", (data) => {
      console.log("⏳ Waiting for partner...");
      this.updateStatus(
        data.message || "Searching for a partner...",
        "waiting"
      );
      this.setUIState("waiting");
    });

    // Queue position update
    this.socket.on("queue-update", (data) => {
      if (this.ui.queuePosition) {
        this.ui.queuePosition.textContent = `Position in queue: ${data.position}`;
        this.ui.queuePosition.style.display = "block";
      }
    });

    // Matched with partner
    this.socket.on("matched", async (data) => {
      console.log("✓ Matched with partner!", data);
      this.currentRoomId = data.roomId;
      this.isInitiator = data.isInitiator;
      this.updateStatus("Matched! Connecting...", "success");

      if (this.ui.queuePosition) {
        this.ui.queuePosition.style.display = "none";
      }

      // Ensure we have local stream before setting up peer connection
      if (!this.localStream) {
        console.log("Local stream not ready, requesting microphone...");
        try {
          await this.getMicrophone();
        } catch (error) {
          console.error("Failed to get microphone:", error);
          this.showError("Microphone access required for voice chat");
          return;
        }
      }

      await this.setupPeerConnection();

      if (this.isInitiator) {
        await this.createOffer();
      }
    });

    // Received WebRTC offer
    this.socket.on("offer", async (data) => {
      console.log("✓ Received offer from peer");
      await this.handleOffer(data.offer);
    });

    // Received WebRTC answer
    this.socket.on("answer", async (data) => {
      console.log("✓ Received answer from peer");
      await this.handleAnswer(data.answer);
    });

    // Received ICE candidate
    this.socket.on("ice-candidate", async (data) => {
      console.log("✓ Received ICE candidate from peer");
      await this.handleIceCandidate(data.candidate);
    });

    // Partner left
    this.socket.on("partner-left", (data) => {
      console.log("⚠ Partner left the chat");
      this.showError(data.message || "Your partner has left");
      this.cleanup();
      this.updateStatus("Partner left the chat", "warning");
      this.setUIState("idle");
    });

    // Partner disconnected
    this.socket.on("partner-disconnected", (data) => {
      console.log("⚠ Partner disconnected");
      this.showError(data.message || "Your partner has disconnected");
      this.cleanup();
      this.updateStatus("Partner disconnected", "warning");
      this.setUIState("idle");
    });

    // Left chat
    this.socket.on("left-chat", (data) => {
      console.log("✓ Successfully left chat");
      this.updateStatus("Ready to connect", "idle");
      this.setUIState("idle");
    });

    // Error handling
    this.socket.on("error", (data) => {
      console.error("✗ Server error:", data.message);
      this.showError(data.message || "An error occurred");
      this.cleanup();
      this.setUIState("idle");
    });
  }

  /**
   * Start looking for a chat partner
   */
  async startChat() {
    if (this.isConnecting || this.isConnected) {
      console.log("Already connecting or connected");
      return;
    }

    try {
      this.isConnecting = true;
      this.updateStatus("Requesting microphone access...", "waiting");
      this.setUIState("connecting");

      // Request microphone access
      await this.getMicrophone();

      // Request to find partner
      this.socket.emit("find-partner");

      console.log("✓ Searching for partner...");
    } catch (error) {
      console.error("✗ Error starting chat:", error);
      this.showError(
        "Failed to access microphone. Please grant permission and try again."
      );
      this.isConnecting = false;
      this.setUIState("idle");
    }
  }

  /**
   * Get microphone access
   */
  async getMicrophone() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
        video: false,
      });

      console.log("✓ Microphone access granted");

      // Start volume meter
      this.startVolumeMeter();

      return this.localStream;
    } catch (error) {
      console.error("✗ Error accessing microphone:", error);
      throw new Error("Microphone access denied");
    }
  }

  /**
   * Setup WebRTC peer connection
   */
  async setupPeerConnection() {
    try {
      // Create peer connection with ICE servers
      this.peerConnection = new RTCPeerConnection({
        iceServers: this.iceServers,
        iceCandidatePoolSize: 10,
        iceTransportPolicy: 'all', // Use both STUN and TURN
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
      });

      console.log('Peer connection created with config:', {
        iceServers: this.iceServers.length + ' servers',
        iceTransportPolicy: 'all',
      });

      // Add local stream tracks to peer connection
      if (this.localStream) {
        const tracks = this.localStream.getTracks();
        console.log("Adding local tracks to peer connection:", tracks.length);
        
        tracks.forEach((track) => {
          console.log("Adding track:", track.kind, "enabled:", track.enabled);
          const sender = this.peerConnection.addTrack(track, this.localStream);
          console.log("Track added, sender:", sender);
        });
      } else {
        console.error("No local stream available to add to peer connection");
      }

      // Handle ICE candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("✓ Sending ICE candidate to peer:", {
            type: event.candidate.type,
            protocol: event.candidate.protocol,
            address: event.candidate.address,
            port: event.candidate.port,
          });
          this.socket.emit("ice-candidate", {
            candidate: event.candidate,
            roomId: this.currentRoomId,
          });
        } else {
          console.log("✓ All ICE candidates have been sent");
        }
      };

      // Handle ICE gathering state changes
      this.peerConnection.onicegatheringstatechange = () => {
        console.log("ICE gathering state:", this.peerConnection.iceGatheringState);
      };

      // Handle remote stream
      this.peerConnection.ontrack = (event) => {
        console.log("✓ Received remote track");
        console.log("Track details:", {
          kind: event.track.kind,
          id: event.track.id,
          enabled: event.track.enabled,
          muted: event.track.muted,
          readyState: event.track.readyState,
        });
        console.log("Streams:", event.streams);
        
        if (event.streams && event.streams[0]) {
          this.remoteStream = event.streams[0];
          
          // Log all tracks in the stream
          const audioTracks = this.remoteStream.getAudioTracks();
          console.log("Remote audio tracks:", audioTracks.length);
          audioTracks.forEach((track, index) => {
            console.log(`Audio track ${index}:`, {
              id: track.id,
              enabled: track.enabled,
              muted: track.muted,
              readyState: track.readyState,
            });
          });
          
          this.playRemoteAudio();
          this.updateStatus("Connected! You can now talk", "success");
          this.isConnected = true;
          this.isConnecting = false;
          this.setUIState("connected");
        } else {
          console.error("No remote stream received");
        }
      };

      // Handle connection state changes
      this.peerConnection.onconnectionstatechange = () => {
        console.log("Connection state:", this.peerConnection.connectionState);

        switch (this.peerConnection.connectionState) {
          case "connected":
            console.log("✓ Peer connection established");
            break;
          case "disconnected":
            console.log("⚠ Peer connection disconnected");
            this.showError("Connection lost");
            this.cleanup();
            break;
          case "failed":
            console.log("✗ Peer connection failed");
            this.showError("Connection failed");
            this.cleanup();
            break;
          case "closed":
            console.log("✓ Peer connection closed");
            break;
        }
      };

      // Handle ICE connection state changes
      this.peerConnection.oniceconnectionstatechange = () => {
        console.log("ICE connection state:", this.peerConnection.iceConnectionState);
        
        switch (this.peerConnection.iceConnectionState) {
          case "checking":
            console.log("Checking ICE candidates...");
            break;
          case "connected":
            console.log("✓ ICE connection established");
            break;
          case "completed":
            console.log("✓ ICE connection completed");
            break;
          case "failed":
            console.error("✗ ICE connection failed");
            this.showError("Connection failed. Please try again.");
            break;
          case "disconnected":
            console.warn("⚠ ICE connection disconnected");
            break;
          case "closed":
            console.log("ICE connection closed");
            break;
        }
      };

      console.log("✓ Peer connection setup complete");
    } catch (error) {
      console.error("✗ Error setting up peer connection:", error);
      throw error;
    }
  }

  /**
   * Create and send WebRTC offer
   */
  async createOffer() {
    try {
      console.log("Creating offer...");
      console.log("Local stream tracks:", this.localStream?.getTracks());
      
      const senders = this.peerConnection.getSenders();
      console.log("Peer connection senders:", senders.length);
      senders.forEach((sender, index) => {
        console.log(`Sender ${index}:`, {
          track: sender.track ? sender.track.kind : 'null',
          trackEnabled: sender.track ? sender.track.enabled : 'N/A',
        });
      });

      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
        voiceActivityDetection: true,
      });

      console.log("Offer created with SDP:");
      console.log(offer.sdp);
      
      await this.peerConnection.setLocalDescription(offer);
      console.log("Local description set");
      console.log("Signaling state:", this.peerConnection.signalingState);

      // Send offer to peer through signaling server
      this.socket.emit("offer", {
        offer: offer,
        roomId: this.currentRoomId,
      });

      console.log("✓ Offer sent to peer");
    } catch (error) {
      console.error("✗ Error creating offer:", error);
      this.showError("Failed to create connection offer");
    }
  }

  /**
   * Handle received WebRTC offer
   */
  async handleOffer(offer) {
    try {
      console.log("Handling received offer...");
      console.log("Offer SDP:");
      console.log(offer.sdp);
      console.log("Current signaling state:", this.peerConnection.signalingState);

      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription(offer)
      );
      console.log("Remote description set from offer");
      console.log("Signaling state after setting remote description:", this.peerConnection.signalingState);

      // Process any queued ICE candidates
      console.log(`Processing ${this.iceCandidateQueue.length} queued ICE candidates...`);
      while (this.iceCandidateQueue.length > 0) {
        const queuedCandidate = this.iceCandidateQueue.shift();
        try {
          await this.peerConnection.addIceCandidate(
            new RTCIceCandidate(queuedCandidate)
          );
          console.log("✓ Queued ICE candidate added");
        } catch (err) {
          console.error("Error adding queued ICE candidate:", err);
        }
      }

      // Create answer
      const answer = await this.peerConnection.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
        voiceActivityDetection: true,
      });
      console.log("Answer created with SDP:");
      console.log(answer.sdp);
      
      await this.peerConnection.setLocalDescription(answer);
      console.log("Local description set from answer");
      console.log("Signaling state:", this.peerConnection.signalingState);

      // Send answer to peer through signaling server
      this.socket.emit("answer", {
        answer: answer,
        roomId: this.currentRoomId,
      });

      console.log("✓ Answer sent to peer");
    } catch (error) {
      console.error("✗ Error handling offer:", error);
      this.showError("Failed to handle connection offer");
    }
  }

  /**
   * Handle received WebRTC answer
   */
  async handleAnswer(answer) {
    try {
      console.log("Handling received answer...");
      console.log("Answer SDP:", answer.sdp);

      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription(answer)
      );

      console.log("✓ Answer processed");
      console.log("Remote description:", this.peerConnection.remoteDescription);
      console.log("Connection state:", this.peerConnection.connectionState);
      console.log("ICE connection state:", this.peerConnection.iceConnectionState);
      
      // Process any queued ICE candidates
      console.log(`Processing ${this.iceCandidateQueue.length} queued ICE candidates...`);
      while (this.iceCandidateQueue.length > 0) {
        const queuedCandidate = this.iceCandidateQueue.shift();
        try {
          await this.peerConnection.addIceCandidate(
            new RTCIceCandidate(queuedCandidate)
          );
          console.log("✓ Queued ICE candidate added");
        } catch (err) {
          console.error("Error adding queued ICE candidate:", err);
        }
      }
    } catch (error) {
      console.error("✗ Error handling answer:", error);
      this.showError("Failed to handle connection answer");
    }
  }

  /**
   * Handle received ICE candidate
   */
  async handleIceCandidate(candidate) {
    try {
      if (candidate && this.peerConnection) {
        // Check if remote description is set
        if (this.peerConnection.remoteDescription && this.peerConnection.remoteDescription.type) {
          await this.peerConnection.addIceCandidate(
            new RTCIceCandidate(candidate)
          );
          console.log("✓ ICE candidate added:", {
            type: candidate.type,
            protocol: candidate.protocol,
          });
          
          // Process any queued candidates
          while (this.iceCandidateQueue.length > 0) {
            const queuedCandidate = this.iceCandidateQueue.shift();
            await this.peerConnection.addIceCandidate(
              new RTCIceCandidate(queuedCandidate)
            );
            console.log("✓ Queued ICE candidate added");
          }
        } else {
          // Queue the candidate until remote description is set
          console.log("⏳ Queueing ICE candidate (remote description not set yet)");
          this.iceCandidateQueue.push(candidate);
        }
      }
    } catch (error) {
      console.error("✗ Error adding ICE candidate:", error);
      console.error("Candidate:", candidate);
    }
  }

  /**
   * Play remote audio stream
   */
  playRemoteAudio() {
    const remoteAudio = document.getElementById("remote-audio");
    if (remoteAudio && this.remoteStream) {
      console.log("Setting up remote audio playback...");
      
      remoteAudio.srcObject = this.remoteStream;
      remoteAudio.volume = 1.0; // Set volume to maximum
      remoteAudio.muted = false; // Ensure not muted
      
      // Log stream details
      const audioTracks = this.remoteStream.getAudioTracks();
      console.log("Remote stream audio tracks:", audioTracks.length);
      audioTracks.forEach((track, index) => {
        console.log(`Setting up audio track ${index}:`, {
          id: track.id,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
        });
        
        // Ensure track is enabled
        track.enabled = true;
        
        // Listen for track events
        track.onended = () => console.log(`Track ${index} ended`);
        track.onmute = () => console.log(`Track ${index} muted`);
        track.onunmute = () => console.log(`Track ${index} unmuted`);
      });
      
      // Try to play immediately
      const playPromise = remoteAudio.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log("✓ Remote audio playing successfully");
            console.log("Audio element state:", {
              volume: remoteAudio.volume,
              muted: remoteAudio.muted,
              paused: remoteAudio.paused,
              readyState: remoteAudio.readyState,
            });
          })
          .catch((error) => {
            console.error("✗ Error playing remote audio:", error);
            console.log("Autoplay blocked. Waiting for user interaction...");
            
            // Add one-time click handler to resume playback
            const resumeAudio = () => {
              remoteAudio.play()
                .then(() => {
                  console.log("✓ Audio resumed after user interaction");
                  this.showError("Audio is now playing. You should hear your partner.");
                })
                .catch(err => console.error("Failed to resume audio:", err));
              document.removeEventListener('click', resumeAudio);
            };
            
            document.addEventListener('click', resumeAudio, { once: true });
            this.showError("Click anywhere to enable audio playback");
          });
      }
    } else {
      console.error("Remote audio element or stream not found");
      console.log("Remote audio element:", remoteAudio);
      console.log("Remote stream:", this.remoteStream);
    }
  }

  /**
   * Start volume meter for local microphone
   */
  startVolumeMeter() {
    if (!this.localStream) return;

    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(this.localStream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;

    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const updateMeter = () => {
      if (!this.localStream) return;

      analyser.getByteFrequencyData(dataArray);

      // Calculate average volume
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      const volume = Math.min(100, (average / 128) * 100);

      // Update volume meter UI
      if (this.ui.volumeFill) {
        this.ui.volumeFill.style.width = `${volume}%`;
      }

      requestAnimationFrame(updateMeter);
    };

    updateMeter();
  }

  /**
   * Disconnect from current chat
   */
  disconnect() {
    console.log("Disconnecting from chat...");
    this.socket.emit("leave-chat");
    this.cleanup();
    this.updateStatus("Disconnected", "idle");
    this.setUIState("idle");
  }

  /**
   * Skip current partner and find new one
   */
  skipPartner() {
    console.log("Skipping partner...");
    this.socket.emit("skip-partner");
    this.cleanup();
    this.updateStatus("Finding new partner...", "waiting");
    this.setUIState("waiting");
  }

  /**
   * Clean up connections and streams
   */
  cleanup() {
    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    // Clear remote stream
    this.remoteStream = null;

    // Clear remote audio
    const remoteAudio = document.getElementById("remote-audio");
    if (remoteAudio) {
      remoteAudio.srcObject = null;
    }

    // Reset volume meter
    if (this.ui.volumeFill) {
      this.ui.volumeFill.style.width = "0%";
    }

    // Clear ICE candidate queue
    this.iceCandidateQueue = [];

    // Reset state
    this.currentRoomId = null;
    this.isInitiator = false;
    this.isConnecting = false;
    this.isConnected = false;

    console.log("✓ Cleanup complete");
  }

  /**
   * Update status text
   */
  updateStatus(message, type = "idle") {
    if (this.ui.statusText) {
      this.ui.statusText.textContent = message;
    }

    if (this.ui.statusIndicator) {
      this.ui.statusIndicator.className = `status-indicator status-${type}`;
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    if (this.ui.errorMessage) {
      this.ui.errorMessage.textContent = message;
      this.ui.errorMessage.style.display = "block";

      setTimeout(() => {
        this.ui.errorMessage.style.display = "none";
      }, 5000);
    }
  }

  /**
   * Set UI state (idle, connecting, waiting, connected)
   */
  setUIState(state) {
    switch (state) {
      case "idle":
        this.ui.connectBtn.disabled = false;
        this.ui.disconnectBtn.disabled = true;
        this.ui.skipBtn.disabled = true;
        if (this.ui.queuePosition) {
          this.ui.queuePosition.style.display = "none";
        }
        break;

      case "connecting":
      case "waiting":
        this.ui.connectBtn.disabled = true;
        this.ui.disconnectBtn.disabled = false;
        this.ui.skipBtn.disabled = true;
        break;

      case "connected":
        this.ui.connectBtn.disabled = true;
        this.ui.disconnectBtn.disabled = false;
        this.ui.skipBtn.disabled = false;
        if (this.ui.queuePosition) {
          this.ui.queuePosition.style.display = "none";
        }
        break;
    }
  }
}

// Initialize client when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  console.log("✓ Initializing Voice Chat Client...");
  window.voiceChatClient = new VoiceChatClient();
});
