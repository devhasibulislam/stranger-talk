/**
 * ============================================================================
 * TURN/STUN Server Configuration
 * ============================================================================
 *
 * Purpose: Configure Coturn TURN/STUN servers for NAT traversal
 * Provides ICE server configuration for WebRTC peer connections
 *
 * ============================================================================
 */

const config = require("./config");

/**
 * ICE Servers Configuration
 * Includes both public STUN servers and configurable TURN server
 *
 * STUN (Session Traversal Utilities for NAT):
 * - Helps discover public IP addresses and port mappings
 * - Works for most symmetric NAT scenarios
 *
 * TURN (Traversal Using Relays around NAT):
 * - Relays media when direct peer-to-peer connection fails
 * - Required for restrictive NATs and corporate firewalls
 */
const iceServers = [
  // Public Google STUN servers (free)
  {
    urls: "stun:stun.l.google.com:19302",
  },
  {
    urls: "stun:stun1.l.google.com:19302",
  },

  // Additional public STUN servers for redundancy
  {
    urls: "stun:stun.stunprotocol.org:3478",
  },

  // Free public TURN servers for better connectivity
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject",
  },

  // Coturn TURN server configuration (configure with your server)
  // Uncomment and configure when you have a TURN server deployed
  /*
  {
    urls: process.env.TURN_SERVER_URL || "turn:your-turn-server.com:3478",
    username: process.env.TURN_USERNAME || "username",
    credential: process.env.TURN_PASSWORD || "password",
  },
  {
    urls: process.env.TURNS_SERVER_URL || "turns:your-turn-server.com:5349",
    username: process.env.TURN_USERNAME || "username",
    credential: process.env.TURN_PASSWORD || "password",
  },
  */
];

/**
 * WebRTC Peer Connection Configuration
 */
const peerConnectionConfig = {
  iceServers: iceServers,
  iceCandidatePoolSize: 10, // Pre-gather ICE candidates
  iceTransportPolicy: "all", // Use both STUN and TURN (can be "relay" for TURN only)
};

/**
 * Media Constraints for Audio-Only Chat
 */
const mediaConstraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 48000,
    channelCount: 1, // Mono audio for voice chat
  },
  video: false, // Audio-only chat
};

/**
 * Coturn Installation and Configuration Guide
 * ===========================================
 *
 * 1. Install Coturn on Ubuntu/Debian:
 *    sudo apt-get update
 *    sudo apt-get install coturn
 *
 * 2. Enable Coturn service:
 *    Edit /etc/default/coturn
 *    Uncomment: TURNSERVER_ENABLED=1
 *
 * 3. Configure Coturn (/etc/turnserver.conf):
 *    listening-port=3478
 *    tls-listening-port=5349
 *    listening-ip=0.0.0.0
 *    relay-ip=<your-server-public-ip>
 *    external-ip=<your-server-public-ip>
 *    realm=your-domain.com
 *    server-name=your-domain.com
 *    lt-cred-mech
 *    user=username:password
 *    fingerprint
 *    no-multicast-peers
 *    no-cli
 *    no-tlsv1
 *    no-tlsv1_1
 *
 * 4. For TLS/TURNS (recommended):
 *    cert=/path/to/certificate.pem
 *    pkey=/path/to/private-key.pem
 *
 * 5. Start Coturn:
 *    sudo systemctl start coturn
 *    sudo systemctl enable coturn
 *
 * 6. Open firewall ports:
 *    sudo ufw allow 3478/tcp
 *    sudo ufw allow 3478/udp
 *    sudo ufw allow 5349/tcp
 *    sudo ufw allow 5349/udp
 *    sudo ufw allow 49152:65535/udp  # TURN relay ports
 *
 * 7. Test your TURN server:
 *    https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/
 */

module.exports = {
  iceServers,
  peerConnectionConfig,
  mediaConstraints,
};
