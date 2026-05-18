import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchPendingReview, setOrderPrice, rejectOrder } from '../api';
import { DollarSign, MapPin, Truck, Clock, X, Check } from 'lucide-react';
import { format } from 'date-fns';

function fmtIQD(v: number) { return (v || 0).toLocaleString('en-US') + ' IQD'; }

export default function PricingReview() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['pending-review'],
    queryFn: fetchPendingReview,
    refetchInterval: 10000,
  });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [errMap, setErrMap] = useState<Record<string, string>>({});

  const setPrice = useMutation({
    mutationFn: ({ id, price }: any) => setOrderPrice(id, price),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pending-review'] }),
  });
  const rej = useMutation({
    mutationFn: ({ id, reason }: any) => rejectOrder(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pending-review'] }),
  });

  const orders = data?.orders || [];

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Pricing Review</h1>
        <p className="text-muted">Approve manual pricing for orders &gt; 130 km</p>
      </div>

      {isLoading && <div className="text-muted">Loading...</div>}

      {!isLoading && orders.length === 0 && (
        <div className="card p-10 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-ok/15 flex items-center justify-center mb-3">
            <Check className="text-ok" size={28} />
          </div>
          <div className="text-xl font-bold">All caught up</div>
          <div className="text-muted text-sm mt-1">No orders awaiting manual pricing approval.</div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {orders.map((o: any) => {
          const dist = Math.round((o.distance_km || 0) * 10) / 10;
          const submitting = setPrice.isPending && setPrice.variables?.id === o.id;
          const onSet = () => {
            const raw = (drafts[o.id] || '').replace(/[^0-9]/g, '');
            const price = parseInt(raw, 10);
            if (!price || price < 1000) {
              setErrMap((m) => ({ ...m, [o.id]: 'Enter a valid price (>= 1000)' }));
              return;
            }
            setErrMap((m) => ({ ...m, [o.id]: '' }));
            setPrice.mutate({ id: o.id, price });
          };
          const onReject = () => {
            const reason = window.prompt('Reason for rejecting this order?', 'Distance not serviceable');
            if (reason && reason.trim()) rej.mutate({ id: o.id, reason: reason.trim() });
          };
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
                <span className="chip-warn px-3 py-1 rounded-full text-xs font-semibold">{dist} km</span>
              </div>

              <div className="space-y-2 text-sm bg-bg/40 rounded-lg p-3 mb-3">
                <div className="flex items-start gap-2">
                  <MapPin size={14} className="text-ok mt-0.5 flex-shrink-0" />
                  <div className="flex-1"><div className="text-xs text-muted">Pickup</div>{o.pickup?.address}</div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin size={14} className="text-danger mt-0.5 flex-shrink-0" />
                  <div className="flex-1"><div className="text-xs text-muted">Drop-off</div>{o.dropoff?.address}</div>
                </div>
              </div>

              {o.cargo_description && (
                <div className="text-sm text-muted mb-3">
                  <span className="text-white">Cargo:</span> {o.cargo_description}
                </div>
              )}

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-xs text-muted block mb-1">Final price (IQD)</label>
                  <div className="relative">
                    <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      className="input pl-9"
                      placeholder="e.g. 90000"
                      value={drafts[o.id] || ''}
                      onChange={(e) => setDrafts({ ...drafts, [o.id]: e.target.value })}
                    />
                  </div>
                  {errMap[o.id] && <div className="text-danger text-xs mt-1">{errMap[o.id]}</div>}
                </div>
                <button className="btn-primary" onClick={onSet} disabled={submitting}>
                  {submitting ? 'Saving...' : 'Approve'}
                </button>
                <button className="btn-danger" onClick={onReject}><X size={16} /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
