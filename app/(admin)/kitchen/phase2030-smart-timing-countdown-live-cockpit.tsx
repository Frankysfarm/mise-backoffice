'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, AlertTriangle, CheckCircle2, Flame } from 'lucide-react';

interface Order {
  id: string;
  status?: string;
  scheduled_for?: string | null;
  created_at?: string;
  customer_name?: string | null;
  total_price?: number | null;
  items?: { name?: string; quantity?: number }[];
}

interface Props {
  orders: Order[];
}

type Urgency = 'overdue' | 'critical' | 'warning' | 'ok';

interface Row {
  id: string;
  label: string;
  customerName: string;
  itemsSummary: string;
  secondsLeft: number | null;
  urgency: Urgency;
}

function urgencyOf(secsLeft: number | null): Urgency {
  if (secsLeft === null) return 'ok';
  if (secsLeft < 0) return 'overdue';
  if (secsLeft < 300) return 'critical';   // < 5 min
  if (secsLeft < 600) return 'warning';    // < 10 min
  return 'ok';
}

const URGENCY_STYLE: Record<Urgency, { bg: string; border: string; badge: string; dot: string }> = {
  overdue:  { bg: 'bg-red-50 dark:bg-red-900/20',    border: 'border-red-300',   badge: 'bg-red-500 text-white',       dot: 'bg-red-500 animate-ping' },
  critical: { bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-300', badge: 'bg-orange-500 text-white',  dot: 'bg-orange-400 animate-pulse' },
  warning:  { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-300',  badge: 'bg-amber-400 text-white',    dot: 'bg-amber-400' },
  ok:       { bg: 'bg-matcha-50 dark:bg-matcha-900/20', border: 'border-matcha-200', badge: 'bg-matcha-500 text-white', dot: 'bg-matcha-400' },
};

function formatCountdown(secs: number | null): string {
  if (secs === null) return '—';
  if (secs < 0) return `+${Math.ceil(Math.abs(secs) / 60)} Min`;
  const m = Math.floor(Math.abs(secs) / 60);
  const s = Math.abs(secs) % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function buildRows(orders: Order[], now: number): Row[] {
  const active = orders.filter(o =>
    o.status !== 'delivered' && o.status !== 'cancelled' &&
    o.status !== 'storniert' && o.status !== 'completed',
  );

  return active
    .map(o => {
      const target = o.scheduled_for
        ? new Date(o.scheduled_for).getTime()
        : o.created_at
          ? new Date(o.created_at).getTime() + 28 * 60 * 1000
          : null;

      const secondsLeft = target != null ? Math.round((target - now) / 1000) : null;
      const urgency = urgencyOf(secondsLeft);
      const items = o.items ?? [];
      const itemsSummary = items.length > 0
        ? items.slice(0, 2).map(i => `${i.quantity ?? 1}× ${i.name ?? '?'}`).join(', ') + (items.length > 2 ? ` +${items.length - 2}` : '')
        : '—';

      return {
        id: o.id,
        label: secondsLeft !== null && secondsLeft < 0
          ? `${Math.ceil(Math.abs(secondsLeft) / 60)} Min überfällig`
          : secondsLeft !== null
            ? `${Math.floor(secondsLeft / 60)} Min verbleibend`
            : 'Kein Zeitfenster',
        customerName: o.customer_name ?? `#${o.id.slice(-4)}`,
        itemsSummary,
        secondsLeft,
        urgency,
      };
    })
    .sort((a, b) => {
      const rank: Record<Urgency, number> = { overdue: 0, critical: 1, warning: 2, ok: 3 };
      const r = rank[a.urgency] - rank[b.urgency];
      if (r !== 0) return r;
      if (a.secondsLeft !== null && b.secondsLeft !== null) return a.secondsLeft - b.secondsLeft;
      return 0;
    })
    .slice(0, 6);
}

export function KitchenPhase2030SmartTimingCountdownLiveCockpit({ orders }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const rows = buildRows(orders, now);
  const overdueCount = rows.filter(r => r.urgency === 'overdue').length;
  const criticalCount = rows.filter(r => r.urgency === 'critical').length;

  if (rows.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
        <Clock className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">
          Smart-Timing · Live-Cockpit
        </span>
        <div className="ml-auto flex items-center gap-2">
          {overdueCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[9px] font-black text-white">
              <AlertTriangle className="h-2.5 w-2.5" />
              {overdueCount} überfällig
            </span>
          )}
          {criticalCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-400 px-2 py-0.5 text-[9px] font-black text-white">
              <Flame className="h-2.5 w-2.5" />
              {criticalCount} kritisch
            </span>
          )}
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border">
        {rows.map(row => {
          const style = URGENCY_STYLE[row.urgency];
          return (
            <div key={row.id} className={cn('flex items-center gap-3 px-4 py-2.5', style.bg, 'border-l-2', style.border)}>
              {/* Pulsing dot */}
              <div className="relative shrink-0 h-2.5 w-2.5">
                <span className={cn('absolute inset-0 rounded-full', style.dot)} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold truncate">{row.customerName}</span>
                  <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-black', style.badge)}>
                    {row.label}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground truncate mt-0.5">{row.itemsSummary}</div>
              </div>

              {/* Countdown */}
              <div className={cn(
                'shrink-0 font-mono text-base font-black tabular-nums',
                row.urgency === 'overdue'  ? 'text-red-600' :
                row.urgency === 'critical' ? 'text-orange-500' :
                row.urgency === 'warning'  ? 'text-amber-600' :
                'text-matcha-700',
              )}>
                {formatCountdown(row.secondsLeft)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer summary */}
      <div className="flex items-center gap-4 px-4 py-2 border-t bg-muted/10 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block" /> Überfällig: {overdueCount}</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-orange-400 inline-block" /> Kritisch: {criticalCount}</span>
        <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-matcha-500" /> Gesamt aktiv: {rows.length}</span>
      </div>
    </div>
  );
}
