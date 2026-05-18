import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchSupportTickets } from '../api';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, Phone } from 'lucide-react';

const chip: Record<string, string> = {
  open: 'chip-ok',
  pending: 'chip-warn',
  resolved: 'chip-info',
  closed: 'chip-muted',
};

export default function SupportInbox() {
  const [filter, setFilter] = useState<string>('');
  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['support-tickets', filter],
    queryFn: () => fetchSupportTickets(filter || undefined),
    refetchInterval: 5000,
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Support Inbox</h1>
          <p className="text-muted">Customer tickets ({tickets.length})</p>
        </div>
        <select className="input max-w-xs" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All</option>
          <option value="open">Open</option>
          <option value="pending">Pending</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {isLoading && <div className="text-muted">Loading...</div>}
      {!isLoading && tickets.length === 0 && (
        <div className="card p-10 text-center">
          <MessageSquare className="mx-auto text-muted mb-3" size={36} />
          <div className="text-lg font-bold">No tickets</div>
          <div className="text-muted text-sm">Inbox is empty for the selected filter.</div>
        </div>
      )}

      <div className="grid gap-3">
        {tickets.map((t: any) => (
          <Link to={`/support/${t.id}`} key={t.id} className="card p-4 hover:border-gold transition">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`${chip[t.status] || 'chip-muted'} px-2 py-0.5 rounded text-xs font-semibold`}>{t.status}</span>
                  {t.unread_for_admin > 0 && (
                    <span className="bg-gold text-bg px-2 py-0.5 rounded-full text-xs font-bold">
                      {t.unread_for_admin} new
                    </span>
                  )}
                  <span className="text-xs text-muted">
                    {t.last_message_at ? formatDistanceToNow(new Date(t.last_message_at), { addSuffix: true }) : ''}
                  </span>
                </div>
                <div className="font-bold truncate">{t.subject}</div>
                <div className="text-sm text-muted truncate">{t.last_message_preview}</div>
                <div className="text-xs text-muted mt-1 flex items-center gap-2">
                  <span>{t.customer_name || 'Customer'}</span>
                  {t.customer_phone && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1"><Phone size={10} /> {t.customer_phone}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
