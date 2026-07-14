'use client';

import { useEffect, useState } from 'react';
import { Clock, Flame, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type OrderRow = {
  id: string;
  bestellnummer?: string | null;
  status: string;
  bestellt_am?: string | null;
  zubereitung_start?: string | null;
  fertig_am?: string | null;
  targetPrepMin?: number;
};

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(iv);
  }, [intervalMs]);
  return now;
}

function fmtMmSs(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

type UrgencyLevel = 'critical' | 'warning' | 'ok' | 'done';

function getUrgency(row: OrderRow, now: number): { level: UrgencyLevel; remainingMs: number; elapsedMin: number } {
  const target = row.targetPrepMin ?? 15;
  if (row.status === 'fertig' || row.status === 'ready' || row.status === 'abgeholt') {
    return { level: 'done', remainingMs: 0, elapsedMin: 0 };
  }
  const startMs = row.zubereitung_start
    ? new Date(row.zubereitung_start).getTime()
    : row.bestellt_am
    ? new Date(row.bestellt_am).getTime()
    : now;
  const elapsedMs = now - startMs;
  const elapsedMin = elapsedMs / 60_000;
  const deadlineMs = startMs + target * 60_000;
  const remainingMs = deadlineMs - now;

  if (remainingMs < 0) return { level: 'critical', remainingMs, elapsedMin };
  if (remainingMs < 3 * 60_000) return { level: 'warning', remainingMs, elapsedMin };
  return { level: 'ok', remainingMs, elapsedMin };
}

const URGENCY_STYLES: Record<UrgencyLevel, { bg: string; border: string; badge: string; label: string; icon: React.ReactNode }> = {
  critical: {
    bg: 'bg-red-50',
    border: 'border-red-300',
    badge: 'bg-red-600 text-white',
    label: 'Überfällig',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    badge: 'bg-amber-500 text-white',
    label: '< 3 Min',
    icon: <Flame className="h-3.5 w-3.5" />,
  },
  ok: {
    bg: 'bg-matcha-50',
    border: 'border-matcha-200',
    badge: 'bg-matcha-600 text-white',
    label: 'Im Plan',
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  done: {
    bg: 'bg-stone-50',
    border: 'border-stone-200',
    badge: 'bg-stone-400 text-white',
    label: 'Fertig',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
};

export function KitchenPhase1385SmartTimingCountdownCockpit({
  locationId,
}: {
  locationId: string | null;
}) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const now = useNow();

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }
    function load() {
      fetch(`/api/delivery/kitchen/orders?location_id=${encodeURIComponent(locationId!)}&limit=30`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          if (d?.orders) setOrders(d.orders);
          else if (Array.isArray(d)) setOrders(d);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const active = orders.filter(
    (o) => !['fertig', 'ready', 'abgeholt', 'storniert', 'cancelled'].includes(o.status)
  );
  const sorted = [...active].sort((a, b) => {
    const ua = getUrgency(a, now);
    const ub = getUrgency(b, now);
    const prio: Record<UrgencyLevel, number> = { critical: 0, warning: 1, ok: 2, done: 3 };
    return prio[ua.level] - prio[ub.level] || ua.remainingMs - ub.remainingMs;
  });

  const criticalCount = sorted.filter((o) => getUrgency(o, now).level === 'critical').length;
  const warningCount = sorted.filter((o) => getUrgency(o, now).level === 'warning').length;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Smart-Timing Countdown
          </span>
          {criticalCount > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 animate-pulse">
              {criticalCount} überfällig
            </span>
          )}
          {warningCount > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              {warningCount} dringend
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t px-4 py-3">
          {loading && (
            <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Lade Bestellungen…
            </div>
          )}

          {!loading && sorted.length === 0 && (
            <div className="py-4 text-center text-sm text-muted-foreground">
              Keine aktiven Bestellungen
            </div>
          )}

          {!loading && sorted.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {sorted.slice(0, 20).map((order) => {
                const u = getUrgency(order, now);
                const style = URGENCY_STYLES[u.level];
                const overdue = u.remainingMs < 0;
                return (
                  <div
                    key={order.id}
                    className={cn(
                      'rounded-lg border p-2.5 flex flex-col gap-1.5 transition-colors',
                      style.bg,
                      style.border
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-muted-foreground truncate">
                        #{order.bestellnummer ?? order.id.slice(-4)}
                      </span>
                      <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold flex items-center gap-0.5', style.badge)}>
                        {style.icon}
                        {style.label}
                      </span>
                    </div>

                    <div className={cn(
                      'font-mono text-2xl font-black tabular-nums text-center leading-none',
                      u.level === 'critical' ? 'text-red-700 animate-pulse' :
                      u.level === 'warning' ? 'text-amber-700' :
                      u.level === 'done' ? 'text-stone-400' : 'text-matcha-700'
                    )}>
                      {u.level === 'done'
                        ? '✓'
                        : overdue
                        ? `+${fmtMmSs(Math.abs(u.remainingMs))}`
                        : fmtMmSs(u.remainingMs)}
                    </div>

                    <div className="text-[9px] text-center text-muted-foreground">
                      {overdue ? 'überfällig seit' : 'verbleibend'} · {Math.round(u.elapsedMin)}m aktiv
                    </div>

                    {/* Progress bar */}
                    {u.level !== 'done' && (
                      <div className="h-1 w-full rounded-full bg-black/10 overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            u.level === 'critical' ? 'bg-red-500' :
                            u.level === 'warning' ? 'bg-amber-500' : 'bg-matcha-500'
                          )}
                          style={{
                            width: `${Math.min(100, Math.max(0, (u.elapsedMin / (order.targetPrepMin ?? 15)) * 100))}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!loading && sorted.length > 20 && (
            <div className="mt-2 text-center text-[10px] text-muted-foreground">
              + {sorted.length - 20} weitere Bestellungen
            </div>
          )}
        </div>
      )}
    </div>
  );
}
