/**
 * Singleton Socket.IO client for NAQAL GO real-time events.
 *
 * Events:
 *   - "driver_location" { order_id, driver_id, location:{latitude,longitude}, at }
 *   - "order_update"    { order_id, order }
 *   - "new_order"       { order }   (sent to room "drivers")
 *
 * Acks:
 *   - subscribe_order   { order_id } -> { ok, room|error }
 *   - unsubscribe_order { order_id } -> { ok }
 */
import { io, Socket } from 'socket.io-client';
import { loadToken } from '@/src/api/client';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

let socket: Socket | null = null;
let connectPromise: Promise<Socket> | null = null;

export async function getSocket(): Promise<Socket> {
  if (socket?.connected) return socket;
  if (connectPromise) return connectPromise;

  const token = await loadToken();
  if (!token) throw new Error('Not authenticated');

  connectPromise = new Promise<Socket>((resolve, reject) => {
    const s = io(BACKEND_URL, {
      path: '/api/socket.io',
      transports: ['websocket', 'polling'],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 1500,
      timeout: 15000,
    });
    s.once('connect', () => {
      socket = s;
      connectPromise = null;
      resolve(s);
    });
    s.once('connect_error', (err) => {
      connectPromise = null;
      console.warn('[socket] connect_error', err?.message);
      reject(err);
    });
  });

  return connectPromise;
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  connectPromise = null;
}

export async function subscribeOrder(orderId: string): Promise<boolean> {
  try {
    const s = await getSocket();
    return await new Promise<boolean>((resolve) => {
      s.emit('subscribe_order', { order_id: orderId }, (ack: any) => {
        resolve(!!ack?.ok);
      });
      // safety: timeout after 4s
      setTimeout(() => resolve(false), 4000);
    });
  } catch {
    return false;
  }
}

export async function unsubscribeOrder(orderId: string): Promise<void> {
  if (!socket || !socket.connected) return;
  socket.emit('unsubscribe_order', { order_id: orderId });
}
