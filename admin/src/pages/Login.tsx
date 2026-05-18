import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminLogin, setSession } from '../api';
import { Shield, Loader2 } from 'lucide-react';

export default function Login() {
  const nav = useNavigate();
  const [u, setU] = useState('admin');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const res = await adminLogin(u, p);
      setSession(res.token, res.user);
      nav('/', { replace: true });
    } catch (e: any) {
      setErr(e?.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card p-8 w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gold flex items-center justify-center">
            <Shield className="text-bg" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">NAQAL GO</h1>
            <p className="text-muted text-sm">Admin Panel</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-sm text-muted mb-1 block">Username</label>
            <input className="input" value={u} onChange={(e) => setU(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="text-sm text-muted mb-1 block">Password</label>
            <input className="input" type="password" value={p} onChange={(e) => setP(e.target.value)} />
          </div>
          {err && <div className="text-danger text-sm bg-danger/10 border border-danger/30 px-3 py-2 rounded">{err}</div>}
          <button className="btn-primary w-full justify-center flex items-center gap-2" disabled={loading}>
            {loading && <Loader2 size={16} className="animate-spin" />} Sign in
          </button>
        </form>
        <p className="text-xs text-muted mt-6 text-center">Restricted access — admin only.</p>
      </div>
    </div>
  );
}
