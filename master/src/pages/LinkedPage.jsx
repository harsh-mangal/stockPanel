import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { BASE_URL } from "../config";

export default function LinkedPage() {
  const [accountId, setAccountId] = useState("");
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState([]);
  const sockRef = useRef(null);

  useEffect(() => {
    return () => {
      if (sockRef.current) sockRef.current.disconnect();
    };
  }, []);

  const connect = () => {
    if (!accountId) return;
    if (sockRef.current) sockRef.current.disconnect();
    const socket = io(BASE_URL, {
      transports: ["websocket"],
      query: { accountId },
    });
    sockRef.current = socket;

    const push = (type) => (payload) =>
      setEvents((e) => [{ type, payload, ts: Date.now() }, ...e].slice(0, 500));

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join", `account:${accountId}`);
      socket.emit("presence.online", { accountId });
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("order.child.updated", push("order.child.updated"));
    socket.on("trade.new", push("trade.new"));

    // keep presence fresh
    const t = setInterval(
      () => socket.emit("presence.ping", { accountId }),
      5000
    );
    socket.on("disconnect", () => clearInterval(t));
  };

  const disconnect = () => {
    const s = sockRef.current;
    if (!s) return;
    s.emit("presence.offline", { accountId });
    s.disconnect();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Linked Account Panel</h2>
      <div className="flex gap-2">
        <input
          className="bg-white/5 border border-white/10 rounded p-2"
          placeholder="Enter accountId (Mongo _id)"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
        />
        <button onClick={connect} className="px-3 py-2 rounded bg-sky-600">
          Connect
        </button>
        <button onClick={disconnect} className="px-3 py-2 rounded bg-white/10">
          Disconnect
        </button>
        <span
          className={`px-2 py-1 rounded text-sm ${
            connected ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {connected ? "Online" : "Offline"}
        </span>
      </div>

      <div className="bg-white/5 border border-white/10 rounded p-3">
        <div className="font-semibold mb-2">Realtime Feed</div>
        <div className="text-xs max-h-72 overflow-auto">
          {events.map((e, i) => (
            <div key={i} className="mb-1">
              <b>{e.type}</b> {new Date(e.ts).toLocaleTimeString()} —{" "}
              {JSON.stringify(e.payload)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
