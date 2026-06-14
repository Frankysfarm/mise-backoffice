'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bell, CheckCircle2, RefreshCw, XCircle } from 'lucide-react';

type NotifStatus = 'pending' | 'sent' | 'failed' | 'skipped';

interface NotificationEntry {
  id: string;
  orderId: string;
  eventType: string;
  customerName: string | null;
  customerPhone: string | null;
  messageDe: string;
  status: NotifStatus;
  attemptCount: number;
  sentAt: string | null;
  createdAt: string;
}

interface NotificationStats {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  skipped: number;
  successRate: number;
}

const STATUS_OPTIONS: { value: NotifStatus | ''; label: string }[] = [
  { value: '', label: 'Alle' },
  { value: 'sent', label: 'Gesendet' },
  { value: 'pending', label: 'Ausstehend' },
  { value: 'failed', label: 'Fehlgeschlagen' },
  { value: 'skipped', label: 'Übersprungen' },
];

function statusBadge(s: NotifStatus) {
  if (s === 'sent') return <span className="rounded-full px-2 py-0.5 text-[11px] font-bold border bg-matcha-50 border-matcha-200 text-matcha-700">Gesendet</span>;
  if (s === 'pending') return <span className="rounded-full px-2 py-0.5 text-[11px] font-bold border bg-blue-50 border-blue-200 text-blue-700">Ausstehend</span>;
  if (s === 'failed') return <span className="rounded-full px-2 py-0.5 text-[11px] font-bold border bg-red-50 border-red-200 text-red-700">Fehlgeschlagen</span>;
  return <span className="rounded-full px-2 py-0.5 text-[11px] font-bold border bg-muted border-border text-muted-foreground">Übersprungen</span>;
}

const EVENT_LABELS: Record<string, string> = {
  driver_assigned: 'Fahrer zugewiesen',
  order_picked_up: 'Abgeholt',
  order_delivered: 'Geliefert',
  order_delayed: 'Verspätung',
  order_failed: 'Zustellfehler',
  eta_updated: 'ETA aktualisiert',
};

export function NotificationLogClient({ locationId }: { locationId: string }) {
  const [statusFilter, setStatusFilter] = useState<NotifStatus | ''>('');
  const [entries, setEntries] = useState<NotificationEntry[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    const url = `/api/delivery/admin/notification-log?location_id=${locationId}&limit=100${statusFilter ? `&status=${statusFilter}` : ''}`;
    fetch(url)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.log) setEntries(d.log as NotificationEntry[]);
        if (d?.stats) setStats(d.stats as NotificationStats);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [statusFilter, locationId]);

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border bg-card px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Gesamt</div>
            <div className="font-display text-2xl font-black">{stats.total}</div>
          </div>
          <div className="rounded-xl border bg-matcha-50 border-matcha-200 px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Gesendet</div>
            <div className="font-display text-2xl font-black text-matcha-700">{stats.sent}</div>
          </div>
          <div className={cn('rounded-xl border px-4 py-3', stats.failed > 0 ? 'bg-red-50 border-red-200' : 'bg-card')}>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Fehlgeschlagen</div>
            <div className={cn('font-display text-2xl font-black', stats.failed > 0 ? 'text-red-700' : '')}>{stats.failed}</div>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Erfolgsquote</div>
            <div className="font-display text-2xl font-black">{stats.successRate}%</div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-sm font-semibold transition',
              statusFilter === opt.value
                ? 'bg-matcha-700 text-white border-matcha-700'
                : 'bg-card border-border text-muted-foreground hover:bg-muted',
            )}
          >
            {opt.label}
          </button>
        ))}
        <button onClick={load} disabled={loading} className="ml-auto flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-sm bg-card border-border text-muted-foreground hover:bg-muted transition disabled:opacity-50">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </button>
      </div>

      {loading && <div className="flex items-center justify-center py-16 text-muted-foreground">Lade Benachrichtigungen…</div>}

      {!loading && entries.length === 0 && (
        <div className="flex items-center gap-2 justify-center py-16 text-muted-foreground text-sm">
          <CheckCircle2 className="h-4 w-4" />
          Keine Einträge.
        </div>
      )}

      {!loading && entries.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <Bell className="h-4 w-4 text-matcha-700" />
            <span className="font-semibold text-sm">{entries.length} Benachrichtigungen</span>
          </div>
          <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
            {entries.map(e => (
              <div key={e.id} className="px-4 py-3 flex items-start gap-3">
                <div className="shrink-0 mt-0.5">
                  {e.status === 'sent' ? <CheckCircle2 className="h-4 w-4 text-matcha-600" /> : e.status === 'failed' ? <XCircle className="h-4 w-4 text-red-500" /> : <Bell className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    {statusBadge(e.status)}
                    <span className="text-[11px] text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                      {EVENT_LABELS[e.eventType] ?? e.eventType}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{e.messageDe}</p>
                  {e.customerName && <div className="text-[11px] text-muted-foreground mt-0.5">{e.customerName}{e.customerPhone ? ` · ${e.customerPhone}` : ''}</div>}
                </div>
                <div className="text-[11px] text-muted-foreground tabular-nums shrink-0 text-right">
                  <div>{new Date(e.createdAt).toLocaleDateString('de-DE')}</div>
                  <div>{new Date(e.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
