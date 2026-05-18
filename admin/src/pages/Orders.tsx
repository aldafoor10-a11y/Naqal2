import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchOrders } from '../api';
import { format } from 'date-fns';

const statusColor: Record<string, string> = {
  pending_review: 'chip-warn',
  pending: 'chip-info',
  accepted: 'chip-info',
  arriving: 'chip-info',
  picked_up: 'chip-info',
  in_transit: 'chip-info',
  completed: 'chip-ok',
  cancelled: 'chip-danger',
  rejected: 'chip-danger',
};

function fmtIQD(v: number) { return (v || 0).toLocaleString('en-US') + ' IQD'; }

export default function Orders() {
  const [statusFilter, setStatusFilter] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['orders', statusFilter],
    queryFn: () => fetchOrders(statusFilter ? { status: statusFilter, limit: 200 } : { limit: 200 }),
    refetchInterval: 15000,
  });

  const orders = data?.orders || [];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Orders</h1>
          <p className="text-muted">All customer orders ({orders.length})</p>
        </div>
        <select className="input max-w-xs" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="pending_review">Pending review</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="arriving">Arriving</option>
          <option value="picked_up">Picked up</option>
          <option value="in_transit">In transit</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface2 text-muted">
            <tr>
              <th className="text-left px-4 py-3">Order #</th>
              <th className="text-left px-4 py-3">Customer</th>
              <th className="text-left px-4 py-3">Route</th>
              <th className="text-right px-4 py-3">Distance</th>
              <th className="text-right px-4 py-3">Price</th>
              <th className="text-center px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="text-center text-muted py-8">Loading...</td></tr>}
            {!isLoading && orders.length === 0 && <tr><td colSpan={7} className="text-center text-muted py-8">No orders</td></tr>}
            {orders.map((o: any) => (
              <tr key={o.id} className="border-t border-border hover:bg-surface2/40">
                <td className="px-4 py-3 font-mono text-xs">{o.order_number || '#' + o.id.slice(0, 6)}</td>
                <td className="px-4 py-3">
                  <div>{o.customer_name || '—'}</div>
                  <div className="text-xs text-muted">{o.customer_phone || ''}</div>
                </td>
                <td className="px-4 py-3 max-w-md">
                  <div className="truncate">{o.pickup?.address}</div>
                  <div className="text-xs text-muted truncate">→ {o.dropoff?.address}</div>
                </td>
                <td className="px-4 py-3 text-right">{Math.round((o.distance_km || 0) * 10) / 10} km</td>
                <td className="px-4 py-3 text-right font-semibold">{fmtIQD(o.final_price || o.estimated_price)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`${statusColor[o.status] || 'chip-muted'} px-2 py-1 rounded text-xs font-semibold`}>
                    {o.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted">{o.created_at ? format(new Date(o.created_at), 'PPp') : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
