/**
 * Build the ICE server list handed to the app for WebRTC calls.
 *
 * STUN alone is enough when both phones are on simple home Wi-Fi, but calls
 * between mobile networks (and most 4G/5G carriers) need a TURN relay to get
 * through. So:
 *
 *   1. Public STUN is always included.
 *   2. If TURN_URL / TURN_USERNAME / TURN_CREDENTIAL are set, your own TURN is
 *      used — this is what you want in production.
 *   3. Otherwise a free public relay is added so calls have a good chance of
 *      working out of the box. It is rate-limited and shared with the whole
 *      internet, so treat it as a testing crutch, not a real service.
 *      Turn it off with PUBLIC_TURN_ENABLED=false.
 */

const PUBLIC_TURN = [
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

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
    return servers;
  }

  if (process.env.PUBLIC_TURN_ENABLED !== 'false') {
    servers.push(...PUBLIC_TURN);
  }

  return servers;
}

module.exports = { iceServers, PUBLIC_TURN };
