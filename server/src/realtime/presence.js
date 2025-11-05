// realtime/presence.js
const ONLINE = new Map();    // accountId -> Set<socketId>
const LAST_PING = new Map(); // accountId -> timestamp

function onlineSet() {
  const out = new Set();
  const now = Date.now();
  for (const [id, set] of ONLINE) if (set.size > 0) out.add(id);
  for (const [id, ts] of LAST_PING) if (now - ts <= 30_000) out.add(id);
  return out;
}

function setOnline(accountId, socketId) {
  const id = String(accountId);
  let set = ONLINE.get(id);
  if (!set) ONLINE.set(id, (set = new Set()));
  set.add(socketId);
}

function setOffline(accountId, socketId) {
  const id = String(accountId);
  const set = ONLINE.get(id);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) ONLINE.delete(id);
}

function ping(accountId) {
  LAST_PING.set(String(accountId), Date.now());
}

export const presence = {
  setOnline,
  setOffline,
  ping,
  onlineSet,
  _ONLINE: ONLINE,
  _LAST_PING: LAST_PING,
};
