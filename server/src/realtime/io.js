import { Server } from 'socket.io';
import { presence } from './presence.js';

let io;

export function attachIO(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET','POST','PATCH'] },
  });

  io.on('connection', (socket) => {
    const accountId = socket.handshake?.query?.accountId;

    // If this socket represents a linked account, mark online and join its room
    if (accountId) {
      socket.join(`account:${accountId}`);
      presence.setOnline(String(accountId), socket.id);
      io.to('presence:accounts').emit('presence.roster.changed'); // optional broadcast
    }

    // Generic room join/leave for admin pages
    socket.on('join', (room) => room && socket.join(String(room)));
    socket.on('leave', (room) => room && socket.leave(String(room)));

    // Presence explicit messages from clients
    socket.on('presence.online', (p) => {
      if (!p?.accountId) return;
      presence.setOnline(String(p.accountId), socket.id);
    });

    socket.on('presence.ping', (p) => {
      if (!p?.accountId) return;
      presence.ping(String(p.accountId));
    });

    socket.on('presence.offline', (p) => {
      if (!p?.accountId) return;
      presence.setOffline(String(p.accountId), socket.id);
      io.to('presence:accounts').emit('presence.roster.changed');
    });

    socket.on('disconnect', () => {
      if (accountId) {
        presence.setOffline(String(accountId), socket.id);
        io.to('presence:accounts').emit('presence.roster.changed');
      }
    });
  });

  return io;
}

export function getIO() {
  if (!io) throw new Error('Socket.IO not initialized yet');
  return io;
}
