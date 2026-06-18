import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchOrders, fetchDrivers, assignDriver, overridePrice } from '../api';
import { format } from 'date-fns';
import { Truck, DollarSign, X, Check, Clock, Calendar, MapPin } from 'lucide-react';

const statusColor: Record<string, string> = {
  pending_review: 'chip-warn',
  pending: 'chip-warn',
  assigned: 'chip-info',
  accepted: 'chip-info',
  arriving: 'chip-info',
  picked_up: 'chip-info',
  in_transit: 'chip-info',
  completed: 'chip-ok',
  cancelled: 'chip-danger',
  rejected: 'chip-danger',
};

const bookingLabel: Record<string, string> = {
  now: 'Immediate',
  scheduled: 'Scheduled',
  date: 'Date Booking',
  time: 'Time Booking',
};

function fmtIQD(v: number) { return (v || 0).toLocaleString('en-US') + ' IQD'; }

export default function Dispatch() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['dispatch-orders'],
    queryFn: () => fetchOrders({ status: 'pending', limit: 100 }),
    refetchInterval: 5000,
  });
  const { data: drivers = [] } = useQuery({ queryKey: ['drivers-for-dispatch'], queryFn: fetchDrivers });
  const approved = drivers.filter((d: any) => d.is_approved);

  const orders = data?.orders || [];

  const assign = useMutation({
    mutationFn: ({ orderId, driverId }: any) => assignDriver(orderId, driverId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dispatch-orders'] }),
  });
  const override = useMutation({
    mutationFn: ({ orderId, price }: any) => overridePrice(orderId, price),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dispatch-orders'] }),
  });

  const [selectedDriver, setSelectedDriver] = useState<Record<string, string>>({});
  const [priceDraft, setPriceDraft] = useState<Record<string, string>>({});

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Dispatch Center</h1>
        <p className="text-muted">Incoming customer orders awaiting driver assignment</p>
      </div>

      {isLoading && <div className="text-muted">Loading...</div>}
      {!isLoading && orders.length === 0 && (
        <div className="card p-10 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-ok/15 flex items-center justify-center mb-3">
            <Check className="text-ok" size={28} />
          </div>
          <div className="text-xl font-bold">No pending orders</div>
          <div className="text-muted text-sm mt-1">New customer bookings will appear here in real time.</div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {orders.map((o: any) => {
          const driverId = selectedDriver[o.id] || approved[0]?.id || '';
          const priceVal = priceDraft[o.id] ?? '';
          const isAssigning = assign.isPending && assign.variables?.orderId === o.id;
          const isOverriding = override.isPending && override.variables?.orderId === o.id;
          return (
            <div key={o.id} className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-warn/15 text-warn flex items-center justify-center">
                    <Truck size={18} />
                  </div>
                  <div>
                    <div className="font-bold">#{o.order_number || o.id.slice(0, 8)}</div>
                    <div className="text-xs text-muted">
                      {o.created_at ? format(new Date(o.created_at), 'PPp') : ''}
                    </div>
                  </div>
                </div>
                <span className={`${statusColor[o.status] || 'chip-muted'} px-2 py-1 rounded text-xs font-semibold`}>{o.status}</span>
              </div>

              <div className="text-sm space-y-1 mb-3">
                <div className="text-white font-medium">{o.customer_name || 'Customer'} • {o.customer_phone}</div>
                {o.booking_type && o.booking_type !== 'now' && (
                  <div className="flex items-center gap-2 text-xs text-warn">
                    <Calendar size={12} /> {bookingLabel[o.booking_type] || o.booking_type}
                    {o.scheduled_date && ` • ${o.scheduled_date}`}
                    {o.scheduled_time && ` • ${o.scheduled_time}`}
                  </div>
                )}
              </div>

              <div className="space-y-1 text-sm bg-bg/40 rounded-lg p-3 mb-3">
                <div className="flex items-start gap-2">
                  <MapPin size={14} className="text-ok mt-0.5 flex-shrink-0" />
                  <div className="flex-1"><div className="text-xs text-muted">Pickup</div>{o.pickup?.address}</div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin size={14} className="text-danger mt-0.5 flex-shrink-0" />
                  <div className="flex-1"><div className="text-xs text-muted">Drop-off</div>{o.dropoff?.address}</div>
                </div>
                <div className="flex items-center justify-between pt-1 mt-1 border-t border-border">
                  <span className="text-xs text-muted">{Math.round((o.distance_km || 0) * 10) / 10} km • {o.cargo_description}</span>
                  <span className="font-bold text-gold">{fmtIQD(o.final_price || o.estimated_price)}</span>
                </div>
              </div>

              {/* Override price */}
              <div className="flex items-end gap-2 mb-3">
                <div className="flex-1">
                  <label className="text-xs text-muted block mb-1">Override price (optional)</label>
                  <input
                    className="input"
                    placeholder={`current: ${fmtIQD(o.final_price)}`}
                    value={priceVal}
                    onChange={(e) => setPriceDraft({ ...priceDraft, [o.id]: e.target.value })}
                  />
                </div>
                <button
                  className="btn-secondary flex items-center gap-1"
                  onClick={() => {
                    const p = parseInt((priceVal || '').replace(/\D/g, ''), 10);
                    if (p >= 1000) override.mutate({ orderId: o.id, price: p });
                  }}
                  disabled={!priceVal || isOverriding}
                >
                  <DollarSign size={14} /> Set
                </button>
              </div>

              {/* Assign driver */}
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-xs text-muted block mb-1">Assign to driver</label>
                  <select
                    className="input"
                    value={driverId}
                    onChange={(e) => setSelectedDriver({ ...selectedDriver, [o.id]: e.target.value })}
                  >
                    {approved.length === 0 && <option value="">No approved drivers</option>}
                    {approved.map((d: any) => (
                      <option key={d.id} value={d.id}>
                        {d.name} • {d.vehicle_plate || d.vehicle_type} {d.is_online ? '● online' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  className="btn-primary"
                  onClick={() => driverId && assign.mutate({ orderId: o.id, driverId })}
                  disabled={!driverId || isAssigning}
                >
                  {isAssigning ? 'Assigning...' : 'Assign Driver'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
