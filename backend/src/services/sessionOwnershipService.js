const WORKER_COUNT = Math.max(1, Number.parseInt(process.env.WA_WORKER_COUNT || "1", 10));
const WORKER_INDEX = Math.min(WORKER_COUNT - 1, Math.max(0, Number.parseInt(process.env.WA_WORKER_INDEX || "0", 10)));

function hashSessionId(sessionId = "") {
  let hash = 0;
  const value = String(sessionId || "");
  for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) - hash + value.charCodeAt(i)) >>> 0;
  return hash >>> 0;
}

function getWorkerIndexForSession(sessionId) {
  return WORKER_COUNT <= 1 ? 0 : hashSessionId(sessionId) % WORKER_COUNT;
}

function isCurrentWorkerOwner(sessionId) {
  return getWorkerIndexForSession(sessionId) === WORKER_INDEX;
}

module.exports = { WORKER_COUNT, WORKER_INDEX, getWorkerIndexForSession, isCurrentWorkerOwner };
