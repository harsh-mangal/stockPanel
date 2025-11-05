// realtime/io.js
import { Server } from "socket.io";
import { presence } from "./presence.js";

let io;
const extractHex24 = (val) => (String(val ?? "").match(/[a-f0-9]{24}/i) || [])[0] || null;

export function attachIO(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST", "PATCH"] },
  });

  io.on("connection", (socket) => {
    const fromAuth  = socket.handshake?.auth?.accountId;
    const fromQuery = socket.handshake?.query?.accountId;
    const bootHex   = extractHex24(fromAuth || fromQuery);

    if (bootHex) {
      socket.data.linkedAccountId = bootHex;
      socket.join(`account:${bootHex}`);
      presence.setOnline(bootHex, socket.id);
      io.to("presence:accounts").emit("presence.roster.changed");
    }

    socket.on("presence.linked.online", (p = {}) => {
      const hex = extractHex24(p.accountId);
      if (!hex) return;
      socket.data.linkedAccountId = hex;
      socket.join(`account:${hex}`);
      if (p.userId) socket.join(`user:${p.userId}`);
      presence.setOnline(hex, socket.id);
      io.to("presence:accounts").emit("presence.roster.changed");
    });

    socket.on("join", (arg) => {
      const room = typeof arg === "string" ? arg : arg?.room;
      if (!room) return;
      socket.join(String(room));
      const m = String(room).match(/^account:([a-f0-9]{24})$/i);
      if (m) {
        const hex = m[1];
        socket.data.linkedAccountId = hex;
        presence.setOnline(hex, socket.id);
        io.to("presence:accounts").emit("presence.roster.changed");
      }
    });

    socket.on("leave", (arg) => {
      const room = typeof arg === "string" ? arg : arg?.room;
      if (!room) return;
      socket.leave(String(room));
    });

    socket.on("presence.ping", (p = {}) => {
      const hex = extractHex24(p.accountId || socket.data.linkedAccountId);
      if (hex) presence.ping(hex);
    });

    socket.on("disconnect", () => {
      const hex = extractHex24(socket.data.linkedAccountId);
      if (hex) {
        presence.setOffline(hex, socket.id);
        io.to("presence:accounts").emit("presence.roster.changed");
      }
    });
  });

  return io;
}

export function getIO() {
  if (!io) throw new Error("Socket.IO not initialized yet");
  return io;
}
