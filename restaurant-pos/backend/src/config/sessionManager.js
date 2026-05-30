const SESSION_DURATION_MS = 30 * 60 * 1000;

const activeSessions = new Map();

function hasActiveSession(userId) {
  const session = activeSessions.get(userId);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    activeSessions.delete(userId);
    return false;
  }
  return true;
}

function addSession(userId) {
  activeSessions.set(userId, {
    loginTime: Date.now(),
    expiresAt: Date.now() + SESSION_DURATION_MS,
  });
}

function removeSession(userId) {
  activeSessions.delete(userId);
}

setInterval(() => {
  const now = Date.now();
  for (const [userId, session] of activeSessions) {
    if (now > session.expiresAt) {
      activeSessions.delete(userId);
    }
  }
}, 5 * 60 * 1000);

module.exports = { hasActiveSession, addSession, removeSession };
