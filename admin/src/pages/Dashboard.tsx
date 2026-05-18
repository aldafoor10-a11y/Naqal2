import { useQuery } from '@tanstack/react-query';
import { fetchStats } from '../api';
import { Package, DollarSign, Users, MessageSquare, Wifi, CheckCircle2, Activity, AlertCircle, ArrowUp } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from 'recharts';
import { format } from 'date-fns';

function fmtIQD(v: number) { return (v || 0).toLocaleString('en-US') + ' IQD'; }

function StatCard({ icon: Icon, label, value, sub, accent = 'gold' }: any) {
  const colorMap: any = {
    gold: 'bg-gold/15 text-gold',
    ok: 'bg-ok/15 text-ok',
    info: 'bg-info/15 text-info',
    warn: 'bg-warn/15 text-warn',
  };
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-muted">{label}</div>
          <div className="text-3xl font-bold mt-2">{value}</div>
          {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorMap[accent]}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['stats'], queryFn: fetchStats, refetchInterval: 15000 });

  if (isLoading || !data) {
    return <div className="p-8"><div className="text-muted">Loading...</div></div>;
  }

  const { totals, pipeline, today, week, series_7d } = data;
  const chart = (series_7d || []).map((d: any) => ({
    day: format(new Date(d.day), 'MMM d'),
    orders: d.orders,
    revenue: d.revenue,
  }));

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted">NAQAL GO operations at a glance</p>
        </div>
        <div className="text-sm text-muted">Auto-refresh every 15s</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Package} label="Total Orders" value={totals.orders} sub={`${totals.completed} completed`} accent="gold" />
        <StatCard icon={DollarSign} label="Total Revenue" value={fmtIQD(totals.revenue)} sub={`Today: ${fmtIQD(today.revenue)}`} accent="ok" />
        <StatCard icon={Users} label="Drivers" value={totals.drivers} sub={`${totals.online_drivers} online`} accent="info" />
        <StatCard icon={MessageSquare} label="Open Tickets" value={totals.open_tickets} sub="Awaiting reply" accent="warn" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <StatCard icon={AlertCircle} label="Manual Pricing Queue" value={pipeline.pending_review} sub="Orders > 130 km" accent="warn" />
        <StatCard icon={Wifi} label="Awaiting Driver" value={pipeline.pending} sub="Pending pickup" accent="info" />
        <StatCard icon={Activity} label="Active Trips" value={pipeline.active} sub="Currently in transit" accent="ok" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-lg font-bold">Orders (Last 7 Days)</div>
              <div className="text-xs text-muted">Daily order creation</div>
            </div>
            <div className="chip-info text-xs px-2 py-1 rounded">Week: {week.orders_completed} done</div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chart}>
              <CartesianGrid stroke="#3A2A1A" strokeDasharray="3 3" />
              <XAxis dataKey="day" stroke="#9C9388" tick={{ fontSize: 12 }} />
              <YAxis stroke="#9C9388" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ background: '#1A130B', border: '1px solid #3A2A1A', borderRadius: 8 }} />
              <Bar dataKey="orders" fill="#D4A437" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-lg font-bold">Revenue (Last 7 Days)</div>
              <div className="text-xs text-muted">Completed-order revenue (IQD)</div>
            </div>
            <div className="chip-ok text-xs px-2 py-1 rounded flex items-center gap-1">
              <ArrowUp size={12} /> {fmtIQD(week.revenue)}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chart}>
              <CartesianGrid stroke="#3A2A1A" strokeDasharray="3 3" />
              <XAxis dataKey="day" stroke="#9C9388" tick={{ fontSize: 12 }} />
              <YAxis stroke="#9C9388" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ background: '#1A130B', border: '1px solid #3A2A1A', borderRadius: 8 }} />
              <Line type="monotone" dataKey="revenue" stroke="#34C759" strokeWidth={3} dot={{ r: 4, fill: '#34C759' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
