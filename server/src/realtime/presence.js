// Simple in-memory presence registry for linked accounts
const accountPresence = new Map(); // accountId -> { socketId, userId, displayName, lastSeen }
const PRESENCE_TTL_MS = Number(process.env.PRESENCE_TTL_MS || 12_000);

export function registerAccountOnline({ accountId, userId, displayName, socketId }) {
  if (!accountId) return;
  accountPresence.set(String(accountId), {
    socketId,
    userId: userId ? String(userId) : null,
    displayName: displayName || null,
    lastSeen: Date.now()
  });
}

export function touchAccount(accountId) {
  const k = String(accountId);
  const cur = accountPresence.get(k);
  if (cur) cur.lastSeen = Date.now();
}

export function unregisterSocket(socketId) {
  for (const [accId, v] of accountPresence.entries()) {
    if (v.socketId === socketId) accountPresence.delete(accId);
  }
}

export function isAccountOnline(accountId, staleMs = 20_000) {
  const v = accountPresence.get(String(accountId));
  if (!v) return false;
  return (Date.now() - v.lastSeen) < staleMs;
}

export function listOnlineAccounts(staleMs = 20_000) {
  const out = [];
  const now = Date.now();
  for (const [accId, v] of accountPresence.entries()) {
    if ((now - v.lastSeen) < staleMs) out.push({ accountId: accId, ...v });
  }
  return out;
}

// Optional API helper: map of {accountId: boolean}
export function onlineMap(ids = [], staleMs = 20_000) {
  const m = {};
  ids.forEach(id => { m[String(id)] = isAccountOnline(id, staleMs); });
  return m;
}
const presence = {
  // accountId -> { lastPing: number, socketIds: Set<string> }
  map: new Map(),

  setOnline(accountId, socketId) {
    if (!accountId) return;
    const row = presence.map.get(accountId) || { lastPing: Date.now(), socketIds: new Set() };
    row.lastPing = Date.now();
    row.socketIds.add(socketId);
    presence.map.set(accountId, row);
  },

  ping(accountId) {
    const row = presence.map.get(accountId);
    if (row) row.lastPing = Date.now();
  },

  setOffline(accountId, socketId) {
    const row = presence.map.get(accountId);
    if (!row) return;
    if (socketId) row.socketIds.delete(socketId);
    if (!socketId || row.socketIds.size === 0) {
      presence.map.delete(accountId);
    }
  },

  isOnline(accountId) {
    const row = presence.map.get(accountId);
    if (!row) return false;
    return Date.now() - row.lastPing <= PRESENCE_TTL_MS;
  },

  onlineSet() {
    const out = new Set();
    const now = Date.now();
    for (const [id, row] of presence.map.entries()) {
      if (now - row.lastPing <= PRESENCE_TTL_MS) out.add(id);
    }
    return out;
  },

  cleanup() {
    const now = Date.now();
    for (const [id, row] of presence.map.entries()) {
      if (now - row.lastPing > PRESENCE_TTL_MS) presence.map.delete(id);
    }
  }
};

// periodic cleanup
setInterval(() => presence.cleanup(), Math.max(2_000, PRESENCE_TTL_MS / 3));

export { presence, PRESENCE_TTL_MS };