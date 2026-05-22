const chains = new Map();

function runSessionTask(sessionId, task) {
  const key = String(sessionId || "").trim();
  if (!key) return Promise.resolve().then(task);
  const previous = chains.get(key) || Promise.resolve();
  const next = previous.catch(() => {}).then(task);
  let tracked = null;
  tracked = next.finally(() => {
    if (chains.get(key) === tracked) chains.delete(key);
  });
  chains.set(key, tracked);
  return tracked;
}

module.exports = { runSessionTask };
