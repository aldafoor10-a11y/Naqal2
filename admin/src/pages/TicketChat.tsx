import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchTicket, postTicketMessage, updateTicketStatus } from '../api';
import { ChevronLeft, Send, Shield, User as UserIcon } from 'lucide-react';
import { format } from 'date-fns';

const chip: Record<string, string> = {
  open: 'chip-ok', pending: 'chip-warn', resolved: 'chip-info', closed: 'chip-muted',
};

export default function TicketChat() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { data: ticket } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => fetchTicket(id as string),
    refetchInterval: 4000,
    enabled: !!id,
  });
  const [text, setText] = useState('');
  const post = useMutation({
    mutationFn: (msg: string) => postTicketMessage(id as string, msg),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket', id] }),
  });
  const upd = useMutation({
    mutationFn: (s: string) => updateTicketStatus(id as string, s),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ticket', id] }),
  });
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.messages?.length]);

  const send = () => {
    const msg = text.trim();
    if (!msg) return;
    setText('');
    post.mutate(msg);
  };

  if (!ticket) return <div className="p-8 text-muted">Loading...</div>;

  return (
    <div className="p-6 flex flex-col h-screen">
      <div className="flex items-center justify-between mb-4">
        <Link to="/support" className="text-muted hover:text-white flex items-center gap-1"><ChevronLeft size={16} /> Back to inbox</Link>
        <select
          className="input max-w-[180px]"
          value={ticket.status}
          onChange={(e) => upd.mutate(e.target.value)}
          disabled={upd.isPending}
        >
          <option value="open">Open</option>
          <option value="pending">Pending</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      <div className="card p-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-gold/20 text-gold flex items-center justify-center font-bold">
            {(ticket.customer_name || '?').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="font-bold text-lg">{ticket.subject}</div>
            <div className="text-xs text-muted">{ticket.customer_name} • {ticket.customer_phone}</div>
          </div>
          <span className={`${chip[ticket.status]} px-3 py-1 rounded-full text-xs font-semibold`}>{ticket.status}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto card p-4 space-y-3">
        {(ticket.messages || []).map((m: any) => {
          const isAdmin = m.author?.role === 'admin';
          return (
            <div key={m.id} className={`flex gap-2 ${isAdmin ? 'justify-end' : 'justify-start'}`}>
              {!isAdmin && (
                <div className="w-8 h-8 rounded-full bg-info/20 text-info flex items-center justify-center flex-shrink-0">
                  <UserIcon size={14} />
                </div>
              )}
              <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${isAdmin ? 'bg-gold text-bg' : 'bg-surface2 border border-border'}`}>
                <div className={`text-xs font-semibold mb-1 ${isAdmin ? 'text-bg/70' : 'text-gold'}`}>
                  {isAdmin ? 'Admin (you)' : m.author?.name || 'Customer'}
                </div>
                <div className="text-sm whitespace-pre-wrap">{m.text}</div>
                <div className={`text-[10px] mt-1 ${isAdmin ? 'text-bg/60' : 'text-muted'}`}>
                  {m.at ? format(new Date(m.at), 'p • MMM d') : ''}
                </div>
              </div>
              {isAdmin && (
                <div className="w-8 h-8 rounded-full bg-gold/20 text-gold flex items-center justify-center flex-shrink-0">
                  <Shield size={14} />
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2 mt-4">
        <textarea
          className="input min-h-[44px] max-h-32 resize-none"
          placeholder="Reply to customer..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
        />
        <button className="btn-primary flex items-center gap-2" onClick={send} disabled={!text.trim() || post.isPending}>
          <Send size={16} /> Send
        </button>
      </div>
    </div>
  );
}
