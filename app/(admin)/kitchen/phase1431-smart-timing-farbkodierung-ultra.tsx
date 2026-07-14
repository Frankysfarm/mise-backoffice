'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, Flame, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Order {
  id: string;
  bestellnummer?: string;
  status: string;
  bestellt_am?: string | null;
  geschaetzte_zubereitung_min?: number | null;
  zubereitung_start?: string | null;
  items?: Array<{ name?: string }>;
}

interface Timing {
  order_id: string;
  prep_min?: number | null;
  ready_target?: string | null;
}

type Urgency = 'ok' | 'tight' | 'urgent' | 'critical' | 'done';

const URGENCY = {
  critical: { bg: 'bg-red-600',     text: 'text-white',       label: 'Überfällig',  icon: AlertTriangle, pulse: true  },
  urgent:   { bg: 'bg-orange-500',  text: 'text-white',       label: 'Dringend',    icon: Flame,         pulse: false },
  tight:    { bg: 'bg-amber-400',   text: 'text-amber-950',   label: 'Knapp',       icon: Clock,         pulse: false },
  ok:       { bg: 'bg-matcha-600',  text: 'text-white',       label: 'OK',          icon: Clock,         pulse: false },
  done:     { bg: 'bg-stone-300',   text: 'text-stone-700',   label: 'Fertig',      icon: CheckCircle2,  pulse: false },
} as const;

function fmtRemain(sec: number): string {
  if (sec < 0) return `+${Math.abs(Math.ceil(sec / 60))}m`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `0:${String(s).padStart(2, '0')}`;
}

function classify(o: Order, t: Timing | undefined, now: number): { urgency: Urgency; remainSec: number | null } {
  if (o.status === 'fertig') return { urgency: 'done', remainSec: null };
  if (t?.ready_target) {
    const sec = Math.round((new Date(t.ready_target).getTime() - now) / 1000);
    let urgency: Urgency = sec < 0 ? 'critical' : sec < 120 ? 'urgent' : sec < 300 ? 'tight' : 'ok';
    return { urgency, remainSec: sec };
  }
  const prepMin = o.geschaetzte_zubereitung_min ?? t?.prep_min ?? null;
  const startMs = o.zubereitung_start ? new Date(o.zubereitung_start).getTime() : o.bestellt_am ? new Date(o.bestellt_am).getTime() : null;
  if (prepMin !== null && startMs !== null) {
    const sec = Math.round(startMs + prepMin * 60_000 - now) / 1000;
    let urgency: Urgency = sec < 0 ? 'critical' : sec < 120 ? 'urgent' : sec < 300 ? 'tight' : 'ok';
    return { urgency, remainSec: Math.round(sec) };
  }
  const elapsed = o.bestellt_am ? (now - new Date(o.bestellt_am).getTime()) / 60_000 : 0;
  const urgency: Urgency = elapsed > 20 ? 'critical' : elapsed > 12 ? 'urgent' : elapsed > 7 ? 'tight' : 'ok';
  return { urgency, remainSec: null };
}

export function KitchenPhase1431SmartTimingFarbkodierungUltra({
  orders,
  timings,
}: {
  orders: Order[];
  timings: Timing[];
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const now = Date.now();
  const active = orders.filter((o) => ['neu', 'bestätigt', 'in_zubereitung', 'fertig'].includes(o.status));
  if (active.length === 0) return null;

  const enriched = active.map((o) => {
    const t = timings.find((t) => t.order_id === o.id);
    return { ...o, ...classify(o, t, now) };
  }).sort((a, b) => {
    const ord: Urgency[] = ['critical', 'urgent', 'tight', 'ok', 'done'];
    return ord.indexOf(a.urgency) - ord.indexOf(b.urgency);
  });

  const critCount = enriched.filter((e) => e.urgency === 'critical').length;
  const urgentCount = enriched.filter((e) => e.urgency === 'urgent').length;

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-stone-50">
        <Flame className={cn('h-4 w-4 shrink-0', critCount > 0 ? 'text-red-600 animate-pulse' : 'text-amber-500')} />
        <span className="text-[11px] font-black uppercase tracking-wider text-stone-600">
          Smart-Timing · Farbkodierung · {active.length} Bestellungen
        </span>
        <div className="ml-auto flex items-center gap-2">
          {critCount > 0 && (
            <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] font-black text-white animate-pulse">
              {critCount} überfällig
            </span>
          )}
          {urgentCount > 0 && (
            <span className="rounded-full bg-orange-500 px-2.5 py-0.5 text-[10px] font-black text-white">
              {urgentCount} dringend
            </span>
          )}
        </div>
      </div>

      {/* Cards grid */}
      <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
        {enriched.map((o) => {
          const cfg = URGENCY[o.urgency];
          const Icon = cfg.icon;
          const nr = (o.bestellnummer ?? o.id).replace('FF-', '').slice(-4);
          return (
            <div
              key={o.id}
              className={cn(
                'rounded-xl p-3 flex flex-col items-center gap-1.5 border',
                cfg.bg, cfg.text,
                cfg.pulse && 'animate-pulse',
                o.urgency === 'critical' && 'border-red-700',
                o.urgency === 'urgent' && 'border-orange-600',
                o.urgency === 'tight' && 'border-amber-500',
                o.urgency === 'ok' && 'border-matcha-700',
                o.urgency === 'done' && 'border-stone-400',
              )}
            >
              <div className="flex items-center gap-1">
                <Icon className="h-3 w-3 shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-wide">{cfg.label}</span>
              </div>
              <div className="font-display text-xl font-black tabular-nums leading-none">
                {o.remainSec !== null ? fmtRemain(o.remainSec) : '—'}
              </div>
              <div className="text-[9px] font-bold opacity-80">#{nr}</div>
              {o.items && o.items.length > 0 && (
                <div className="text-[8px] opacity-70 text-center truncate w-full max-w-[80px]">
                  {o.items.length} Pos.
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary bar */}
      <div className="px-4 py-2 border-t bg-stone-50 flex items-center gap-3 flex-wrap">
        {(['critical', 'urgent', 'tight', 'ok', 'done'] as Urgency[]).map((u) => {
          const count = enriched.filter((e) => e.urgency === u).length;
          if (count === 0) return null;
          const cfg = URGENCY[u];
          return (
            <div key={u} className="flex items-center gap-1">
              <div className={cn('h-2.5 w-2.5 rounded-full', cfg.bg)} />
              <span className="text-[10px] font-bold text-stone-600">{count}× {cfg.label}</span>
            </div>
          );
        })}
        <span className="ml-auto text-[9px] text-stone-400 font-mono tabular-nums">
          live ·{tick > 0 ? '' : ''}
        </span>
      </div>
    </div>
  );
}
