// src/hooks/useOrdersRealtime.js
import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

export function useOrdersRealtime({ onCreated, onSummary, masterRoomId }) {
  const socketRef = useRef(null);

  useEffect(() => {
    const url = "https://final.dodunsoftsolutions.com";
    const s = io(url, { transports: ["websocket"] });
    socketRef.current = s;

    const handleCreated = (p) => onCreated?.(p);
    const handleSummary = (p) => onSummary?.(p);

    s.on("order.master.created", handleCreated);
    s.on("order.master.summary", handleSummary);

    // Optionally join a room for a specific master ID to reduce noise
    if (masterRoomId) s.emit("join", { room: `order:${masterRoomId}` });

    return () => {
      s.off("order.master.created", handleCreated);
      s.off("order.master.summary", handleSummary);
      s.disconnect();
    };
  }, [masterRoomId, onCreated, onSummary]);
}
