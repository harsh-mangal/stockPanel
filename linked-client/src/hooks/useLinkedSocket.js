// src/hooks/useLinkedSocket.js
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { SOCKET_URL } from "../config";

const toHex24 = (v) => {
  const m = String(v || "").match(/[a-f0-9]{24}/i);
  return m ? m[0] : null;
};

export function useLinkedSocket({ accountId, userId, authKey }) {
  const socketRef = useRef(null);
  const seenChildIdsRef = useRef(new Set()); // dedupe
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState([]);
  const [children, setChildren] = useState([]);
  const [masters, setMasters] = useState([]);

  const push = (type, payload) =>
    setEvents((p) => [{ at: Date.now(), type, payload }, ...p].slice(0, 200));

  useEffect(() => {
    const hex = toHex24(accountId);
    if (!hex) return;

    const s = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      withCredentials: true,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 2500,
      timeout: 15000,
      // send id in BOTH places
      auth: { role: "linked", accountId: hex, userId: userId || null, authKey: authKey || null },
      query: { accountId: hex },
      // path: "/socket.io" // uncomment if you customized server path
    });

    socketRef.current = s;

    s.on("connect", () => {
      setConnected(true);
      push("socket.connect", { id: s.id });

      // Announce presence + join rooms
      s.emit("presence.linked.online", { accountId: hex, userId: userId || null });

      // IMPORTANT: send a STRING to be compatible with servers that expect string
      s.emit("join", `account:${hex}`);
      if (userId) s.emit("join", `user:${userId}`);
    });

    s.on("disconnect", (reason) => {
      setConnected(false);
      push("socket.disconnect", { reason });
    });

    s.on("connect_error", (err) => {
      setConnected(false);
      push("socket.connect_error", { message: err?.message, stack: err?.stack });
      console.warn("[socket] connect_error:", err?.message);
    });

    s.on("error", (err) => {
      push("socket.error", { message: err?.message });
      console.warn("[socket] error:", err?.message);
    });

    // Master events
    s.on("order.master.created", (p) => {
      push("order.master.created", p);
      setMasters((prev) => [p, ...prev].slice(0, 50));
    });
    s.on("order.master.summary", (p) => {
      push("order.master.summary", p);
      setMasters((prev) => [p, ...prev].slice(0, 50));
    });

    // Child events (with dedupe)
    const upsertChild = (p) => {
      const id = String(p.childId || p._id || "");
      if (!id) return;
      if (seenChildIdsRef.current.has(id) && p.type === "created") return;
      seenChildIdsRef.current.add(id);
      setChildren((prev) => {
        const i = prev.findIndex((x) => String(x.childId || x._id || "") === id);
        if (i === -1) return [p, ...prev].slice(0, 100);
        const copy = [...prev];
        copy[i] = { ...copy[i], ...p };
        return copy;
      });
    };

    s.on("order.child.created", (p) => {
      push("order.child.created", p);
      upsertChild({ ...p, type: "created" });
    });

    s.on("order.child.update", (p) => {
      push("order.child.update", p);
      upsertChild(p);
    });

    s.on("order.child.filled", (p) => {
      push("order.child.filled", p);
      upsertChild({ ...p, status: "FILLED" });
    });

    s.on("order.child.rejected", (p) => {
      push("order.child.rejected", p);
      upsertChild({ ...p, status: "REJECTED" });
    });

    // Catch-all to see every event name the server actually emits
    s.onAny((event, payload) => {
      push(`socket.any:${event}`, payload);
      // Optional quick mapping if your adapter emits a combined event:
      if (event === "order.child" && payload?.type) upsertChild(payload);
    });

    // Heartbeat ping (prevents TTL eviction)
    const hb = setInterval(() => {
      s.emit("presence.ping", { accountId: hex });
    }, 20000);

    return () => {
      clearInterval(hb);
      s.removeAllListeners();
      s.disconnect();
    };
  }, [accountId, userId, authKey]);

  return { connected, events, children, masters };
}
