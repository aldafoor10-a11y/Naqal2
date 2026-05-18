import { io, Socket } from 'socket.io-client';
import { getToken } from './api';

let socket: Socket | null = null;

export function getAdminSocket(): Socket | null {
  const token = getToken();
  if (!token) return null;
  if (socket?.connected) return socket;
  if (socket) return socket; // connecting
  socket = io({
    path: '/api/socket.io',
    transports: ['websocket', 'polling'],
    auth: { token },
    reconnection: true,
  });
  socket.on('connect', () => console.log('[admin socket] connected'));
  socket.on('disconnect', () => console.log('[admin socket] disconnected'));
  return socket;
}

export function disconnectAdminSocket() {
  socket?.disconnect();
  socket = null;
}
