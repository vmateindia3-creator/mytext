/**
 * Build the ICE server list handed to the app for WebRTC calls.
 * Always includes public STUN; adds a TURN server when configured, which is
 * what makes calls work reliably across strict/mobile networks.
 */
function iceServers() {
  const servers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  if (process.env.TURN_URL) {
    servers.push({
      urls: process.env.TURN_URL,
      username: process.env.TURN_USERNAME || '',
      credential: process.env.TURN_CREDENTIAL || '',
    });
  }

  return servers;
}

module.exports = { iceServers };
