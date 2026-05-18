import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchDrivers, createDriver, toggleDriverApproval } from '../api';
import { Plus, ToggleLeft, ToggleRight, Search, UserCheck, Phone, Truck, X } from 'lucide-react';

function Modal({ children, onClose }: any) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export default function Drivers() {
  const qc = useQueryClient();
  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ['drivers'],
    queryFn: fetchDrivers,
    refetchInterval: 10000,
  });
  const toggle = useMutation({
    mutationFn: (id: string) => toggleDriverApproval(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drivers'] }),
  });
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = drivers.filter(
    (d: any) =>
      d.name?.toLowerCase().includes(search.toLowerCase()) ||
      d.phone?.toLowerCase().includes(search.toLowerCase()) ||
      d.vehicle_plate?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Drivers</h1>
          <p className="text-muted">Create, approve and manage drivers</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> Add Driver
        </button>
      </div>

      <div className="mb-4 relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input className="input pl-9" placeholder="Search by name, phone or plate" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface2 text-muted">
            <tr>
              <th className="text-left px-4 py-3">Driver</th>
              <th className="text-left px-4 py-3">Phone</th>
              <th className="text-left px-4 py-3">Vehicle</th>
              <th className="text-left px-4 py-3">Trips</th>
              <th className="text-left px-4 py-3">Rating</th>
              <th className="text-center px-4 py-3">Online</th>
              <th className="text-center px-4 py-3">Approved</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="text-center text-muted py-8">Loading...</td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={7} className="text-center text-muted py-8">No drivers</td></tr>
            )}
            {filtered.map((d: any) => (
              <tr key={d.id} className="border-t border-border hover:bg-surface2/40">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gold/20 text-gold flex items-center justify-center font-bold">
                      {(d.name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium">{d.name || 'Unnamed'}</div>
                      <div className="text-xs text-muted">#{d.id.slice(0, 8)}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3"><div className="flex items-center gap-1"><Phone size={12} className="text-muted" /> {d.phone}</div></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1"><Truck size={12} className="text-muted" /> {d.vehicle_plate || '—'}</div>
                  <div className="text-xs text-muted">{d.vehicle_type || ''}</div>
                </td>
                <td className="px-4 py-3">{d.total_trips || 0}</td>
                <td className="px-4 py-3">{(d.rating || 5).toFixed(1)} ★</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${d.is_online ? 'bg-ok' : 'bg-muted/50'}`} />
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggle.mutate(d.id)}
                    className="inline-flex items-center gap-1"
                    title="Toggle approval"
                  >
                    {d.is_approved ? (
                      <ToggleRight className="text-ok" size={26} />
                    ) : (
                      <ToggleLeft className="text-muted" size={26} />
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <Modal onClose={() => setShowCreate(false)}>
          <CreateDriverForm onClose={() => setShowCreate(false)} onSuccess={() => qc.invalidateQueries({ queryKey: ['drivers'] })} />
        </Modal>
      )}
    </div>
  );
}

function CreateDriverForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ name: '', phone: '', vehicle_type: 'pickup_truck', vehicle_plate: '' });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!form.name.trim() || !form.phone.trim() || !form.vehicle_plate.trim()) {
      setErr('All fields required');
      return;
    }
    setLoading(true);
    try {
      await createDriver({ ...form, phone: form.phone.trim() });
      onSuccess();
      onClose();
    } catch (e: any) {
      setErr(e?.response?.data?.detail || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center gap-2"><UserCheck size={20} className="text-gold" /> Add Driver</h2>
        <button type="button" onClick={onClose} className="text-muted hover:text-white"><X size={20} /></button>
      </div>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted block mb-1">Full Name</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
        </div>
        <div>
          <label className="text-xs text-muted block mb-1">Phone (with country code)</label>
          <input className="input" placeholder="+9647xxxxxxxxx" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-muted block mb-1">Vehicle Type</label>
          <select className="input" value={form.vehicle_type} onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}>
            <option value="pickup_truck">Pickup Truck</option>
            <option value="kia_pickup">Kia Pickup</option>
            <option value="small_truck">Small Truck</option>
            <option value="medium_truck">Medium Truck</option>
            <option value="large_truck">Large Truck</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-muted block mb-1">License Plate</label>
          <input className="input" placeholder="e.g. MOSUL 12345" value={form.vehicle_plate} onChange={(e) => setForm({ ...form, vehicle_plate: e.target.value })} />
        </div>
        {err && <div className="text-danger text-sm bg-danger/10 border border-danger/30 px-3 py-2 rounded">{err}</div>}
        <div className="flex gap-2 pt-2">
          <button type="button" className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary flex-1" disabled={loading}>
            {loading ? 'Creating...' : 'Create Driver'}
          </button>
        </div>
      </div>
    </form>
  );
}
