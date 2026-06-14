'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Megaphone, RefreshCw, Send, Trash2, Zap } from 'lucide-react';

interface DriverBroadcast {
  id: string;
  message: string;
  priority: 'normal' | 'urgent';
  target: string;
  sentByName: string | null;
  createdAt: string;
  expiresAt: string;
  isActive: boolean;
  readCount: number;
}

interface BroadcastsData {
  broadcasts: DriverBroadcast[];
}

export function BroadcastsClient({ locationId }: { locationId: string }) {
  const [data, setData] = useState<BroadcastsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/delivery/admin/broadcasts?location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.broadcasts) setData(d as BroadcastsData); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  useEffect(() => { load(); }, [load]);

  const send = async () => {
    if (!message.trim()) return;
    setSending(true);
    await fetch('/api/delivery/admin/broadcasts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location_id: locationId, message: message.trim(), priority }),
    });
    setMessage('');
    setSending(false);
    load();
  };

  const remove = async (id: string) => {
    setDeleting(id);
    await fetch(`/api/delivery/admin/broadcasts?id=${id}&location_id=${locationId}`, { method: 'DELETE' });
    setDeleting(null);
    load();
  };

  return (
    <div className="space-y-6">
      {/* Compose */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Megaphone className="h-4 w-4 text-matcha-700" />
          <span className="font-semibold text-sm">Neue Nachricht senden</span>
        </div>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Nachricht an alle Fahrer eingeben…"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-matcha-500"
          rows={3}
          maxLength={500}
        />
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {(['normal', 'urgent'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-semibold transition',
                  priority === p
                    ? p === 'urgent' ? 'bg-red-600 text-white border-red-600' : 'bg-matcha-700 text-white border-matcha-700'
                    : 'bg-card border-border text-muted-foreground hover:bg-muted',
                )}
              >
                {p === 'urgent' && <Zap className="h-3.5 w-3.5" />}
                {p === 'normal' ? 'Normal' : 'Dringend'}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">{message.length}/500</span>
            <button
              onClick={send}
              disabled={sending || !message.trim()}
              className="flex items-center gap-1.5 rounded-lg border border-matcha-700 bg-matcha-700 text-white px-3 py-1.5 text-sm font-semibold hover:bg-matcha-800 transition disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {sending ? 'Wird gesendet…' : 'Senden'}
            </button>
          </div>
        </div>
      </div>

      {/* Broadcast list */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">Letzte Nachrichten</span>
        <button onClick={load} disabled={loading} className="ml-auto flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-sm bg-card border-border text-muted-foreground hover:bg-muted transition disabled:opacity-50">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </button>
      </div>

      {loading && <div className="flex items-center justify-center py-12 text-muted-foreground">Lade Nachrichten…</div>}

      {!loading && (!data || data.broadcasts.length === 0) && (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Noch keine Nachrichten gesendet.</div>
      )}

      {!loading && data && data.broadcasts.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden divide-y divide-border">
          {data.broadcasts.map(b => (
            <div key={b.id} className={cn('px-4 py-3 flex items-start gap-3', !b.isActive && 'opacity-50')}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {b.priority === 'urgent' && (
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-bold border bg-red-50 border-red-300 text-red-700 flex items-center gap-1">
                      <Zap className="h-2.5 w-2.5" />Dringend
                    </span>
                  )}
                  {b.isActive
                    ? <span className="rounded-full px-2 py-0.5 text-[11px] font-bold border bg-matcha-50 border-matcha-200 text-matcha-700">Aktiv</span>
                    : <span className="rounded-full px-2 py-0.5 text-[11px] font-bold border bg-muted border-border text-muted-foreground">Abgelaufen</span>}
                  {b.readCount > 0 && (
                    <span className="text-[11px] text-muted-foreground">{b.readCount} gelesen</span>
                  )}
                </div>
                <p className="text-sm">{b.message}</p>
                <div className="text-[11px] text-muted-foreground mt-1">
                  {b.sentByName ? `Von ${b.sentByName} · ` : ''}{new Date(b.createdAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
                  {' · Gültig bis '}{new Date(b.expiresAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
                </div>
              </div>
              <button
                onClick={() => remove(b.id)}
                disabled={deleting === b.id}
                className="shrink-0 p-1.5 rounded-md hover:bg-red-50 hover:text-red-600 text-muted-foreground transition disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
