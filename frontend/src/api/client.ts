/**
 * NAQAL GO - API client
 */
import axios, { AxiosInstance } from 'axios';
import { storage } from '@/src/utils/storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

if (!BACKEND_URL) {
  console.warn('EXPO_PUBLIC_BACKEND_URL not set');
}

export const api: AxiosInstance = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  timeout: 20000,
});

let _token: string | null = null;

export async function loadToken(): Promise<string | null> {
  if (_token) return _token;
  const t = await storage.secureGet<string>('auth_token', '');
  _token = t || null;
  return _token;
}

export async function setToken(token: string | null): Promise<void> {
  _token = token;
  if (token) {
    await storage.secureSet('auth_token', token);
  } else {
    await storage.secureRemove('auth_token');
  }
}

api.interceptors.request.use(async (config) => {
  const token = await loadToken();
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // bubble error up
    return Promise.reject(err);
  }
);

// ---- Auth ----
export async function sendOtp(phone: string) {
  const { data } = await api.post('/auth/send-otp', { phone });
  return data;
}

export async function verifyOtp(phone: string, code: string) {
  const { data } = await api.post('/auth/verify-otp', { phone, code });
  if (data.token) await setToken(data.token);
  return data;
}

export async function updateProfile(name: string) {
  const { data } = await api.put('/auth/profile', { name });
  return data;
}

export async function fetchMe() {
  const { data } = await api.get('/auth/me');
  return data.user;
}

export async function logout() {
  await setToken(null);
}

// ---- Driver ----
export async function driverProfile() {
  const { data } = await api.get('/driver/profile');
  return data.driver;
}

export async function driverSetStatus(is_online: boolean) {
  const { data } = await api.put('/driver/status', { is_online });
  return data.driver;
}

export async function driverUpdateLocation(latitude: number, longitude: number) {
  const { data } = await api.put('/driver/location', { latitude, longitude });
  return data;
}

export async function driverAvailableOrders() {
  const { data } = await api.get('/driver/orders/available');
  return data.orders;
}

export async function driverActiveOrders() {
  const { data } = await api.get('/driver/orders/active');
  return data.orders;
}

export async function driverHistory() {
  const { data } = await api.get('/driver/orders/history');
  return data.orders;
}

export async function driverAcceptOrder(orderId: string) {
  const { data } = await api.post(`/driver/orders/${orderId}/accept`);
  return data.order;
}

export async function driverRejectOrder(orderId: string) {
  const { data } = await api.post(`/driver/orders/${orderId}/reject`);
  return data;
}

export async function driverUpdateOrderStatus(
  orderId: string,
  status: 'arriving' | 'picked_up' | 'in_transit' | 'completed'
) {
  const { data } = await api.post(`/driver/orders/${orderId}/status`, { status });
  return data.order;
}

export async function driverEarnings() {
  const { data } = await api.get('/driver/earnings');
  return data;
}

// ---- Pricing ----
export async function estimatePrice(params: {
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  vehicle_type?: string;
  service_type?: string;
}) {
  const { data } = await api.post('/pricing/estimate', params);
  return data;
}

// ---- Orders ----
export async function createOrder(payload: any) {
  const { data } = await api.post('/orders', payload);
  return data.order;
}

export async function listOrders(status?: string) {
  const { data } = await api.get('/orders', { params: { status } });
  return data.orders;
}

export async function getOrder(id: string) {
  const { data } = await api.get(`/orders/${id}`);
  return data.order;
}

export async function cancelOrder(id: string) {
  const { data } = await api.post(`/orders/${id}/cancel`);
  return data;
}

export async function simulateAccept(id: string) {
  const { data } = await api.post(`/orders/${id}/simulate-accept`);
  return data.order;
}

export async function simulateProgress(id: string) {
  const { data } = await api.post(`/orders/${id}/simulate-progress`);
  return data.order;
}

// ---- Support tickets ----
export async function createTicket(subject: string, message: string) {
  const { data } = await api.post('/support/tickets', { subject, message });
  return data.ticket;
}

export async function listMyTickets() {
  const { data } = await api.get('/support/tickets');
  return data.tickets as any[];
}

export async function getTicket(id: string) {
  const { data } = await api.get(`/support/tickets/${id}`);
  return data.ticket;
}

export async function postTicketMessage(id: string, message: string) {
  const { data } = await api.post(`/support/tickets/${id}/messages`, { message });
  return data.ticket;
}
