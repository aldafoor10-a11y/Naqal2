import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, DollarSign, MessageSquare, Package, LogOut, Truck } from 'lucide-react';
import { clearSession, getSessionUser } from '../api';
import { disconnectAdminSocket } from '../socket';

const items = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/pricing', label: 'Pricing Review', icon: DollarSign },
  { to: '/drivers', label: 'Drivers', icon: Users },
  { to: '/orders', label: 'Orders', icon: Package },
  { to: '/support', label: 'Support', icon: MessageSquare },
];

export default function Layout() {
  const nav = useNavigate();
  const user = getSessionUser();
  const doLogout = () => {
    disconnectAdminSocket();
    clearSession();
    nav('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex bg-bg">
      <aside className="w-64 bg-surface border-r border-border flex flex-col">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gold flex items-center justify-center">
              <Truck className="text-bg" size={20} />
            </div>
            <div>
              <div className="font-bold">NAQAL GO</div>
              <div className="text-xs text-muted">Admin Panel</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${
                  isActive ? 'bg-gold text-bg font-semibold' : 'text-white/80 hover:bg-surface2'
                }`
              }
            >
              <it.icon size={18} />
              <span>{it.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-9 h-9 rounded-full bg-surface2 border border-border flex items-center justify-center font-bold">
              {(user?.username || 'A').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{user?.name || user?.username || 'Admin'}</div>
              <div className="text-xs text-muted">Administrator</div>
            </div>
          </div>
          <button onClick={doLogout} className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-danger hover:bg-danger/10 transition">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
