import axios from 'axios';

// We're served from /api/web-admin/, so API base is one level up.
export const API_BASE = '/api';

export const api = axios.create({ baseURL: API_BASE, timeout: 15000 });

const TOKEN_KEY = 'naqal_admin_token';
const USER_KEY = 'naqal_admin_user';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setSession(token: string, user: any) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getSessionUser(): any | null {
  try {
    const v = localStorage.getItem(USER_KEY);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

api.interceptors.request.use((c) => {
  const t = getToken();
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      clearSession();
      if (typeof window !== 'undefined' && !location.pathname.endsWith('/login')) {
        location.href = '/api/web-admin/login';
      }
    }
    return Promise.reject(err);
  }
);

// ---- Endpoints ----
export async function adminLogin(username: string, password: string) {
  const { data } = await api.post('/auth/admin/login', { username, password });
  return data; // { token, user }
}

export async function fetchStats() {
  const { data } = await api.get('/admin/stats');
  return data;
}
export async function fetchOrders(params?: any) {
  const { data } = await api.get('/admin/orders', { params });
  return data;
}
export async function fetchPendingReview() {
  const { data } = await api.get('/admin/orders/pending-review');
  return data;
}
export async function setOrderPrice(id: string, price: number) {
  const { data } = await api.post(`/admin/orders/${id}/set-price`, { price });
  return data;
}
export async function rejectOrder(id: string, reason: string) {
  const { data } = await api.post(`/admin/orders/${id}/reject`, { reason });
  return data;
}
export async function fetchDrivers() {
  const { data } = await api.get('/admin/drivers');
  return data.drivers || [];
}
export async function createDriver(payload: any) {
  const { data } = await api.post('/admin/drivers', payload);
  return data;
}
export async function toggleDriverApproval(id: string) {
  const { data } = await api.put(`/admin/drivers/${id}/toggle-approval`);
  return data;
}
export async function fetchSupportTickets(status?: string) {
  const { data } = await api.get('/admin/support/tickets', { params: status ? { status } : {} });
  return data.tickets || [];
}
export async function fetchTicket(id: string) {
  const { data } = await api.get(`/support/tickets/${id}`);
  return data.ticket;
}
export async function postTicketMessage(id: string, message: string) {
  const { data } = await api.post(`/support/tickets/${id}/messages`, { message });
  return data.ticket;
}
export async function updateTicketStatus(id: string, status: string) {
  const { data } = await api.put(`/admin/support/tickets/${id}/status`, { status });
  return data;
}

// ---- Assignment & pricing ----
export async function assignDriver(orderId: string, driverId: string) {
  const { data } = await api.post(`/admin/orders/${orderId}/assign-driver`, { driver_id: driverId });
  return data.order;
}
export async function overridePrice(orderId: string, price: number) {
  const { data } = await api.post(`/admin/orders/${orderId}/override-price`, { price });
  return data.order;
}
export async function fetchPricingSettings() {
  const { data } = await api.get('/admin/pricing-settings');
  return data.settings || {};
}
export async function updatePricingSettings(payload: any) {
  const { data } = await api.put('/admin/pricing-settings', payload);
  return data.settings;
}
