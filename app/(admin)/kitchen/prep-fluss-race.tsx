'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Flame, Clock, ChefHat, CheckCircle2, AlertTriangle } from 'lucide-react';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  kunde_name: string;
};

type KitchenTiming = {
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

interface Props {
  orders: Order[];
  timings: KitchenTiming[];
}

type RaceEntry = {
  id: string;
  nr: string;
  name: string;
  status: string;
  elapsedSec: number;
  totalSec: number;
  progressPct: number;
  remainSec: number;
  urgency: 'krit' | 'warn' | 'ok' | 'done';
};

function fmtSec(s: number): string {
  if (s <= 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function KitchenPrepFlussRace({ orders, timings }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();

  const active = orders.filter((o) =>
    ['in_zubereitung', 'bestätigt', 'fertig'].includes(o.status),
  );

  const entries: RaceEntry[] = active.map((o): RaceEntry => {
    const timing = timings.find((t) => t.order_id === o.id);
    const cookStartMs = timing?.cook_start_at ? new Date(timing.cook_start_at).getTime() : null;
    const readyMs = timing?.ready_target ? new Date(timing.ready_target).getTime() : null;
    const prepSec = (timing?.prep_min ?? o.geschaetzte_zubereitung_min ?? 15) * 60;

    const elapsedSec = cookStartMs ? Math.floor((now - cookStartMs) / 1000) : 0;
    const totalSec = prepSec > 0 ? prepSec : 900;
    const progressPct = Math.min(100, Math.round((elapsedSec / totalSec) * 100));
    const remainSec = readyMs ? Math.max(0, Math.floor((readyMs - now) / 1000)) : Math.max(0, totalSec - elapsedSec);

    let urgency: RaceEntry['urgency'] = 'ok';
    if (o.status === 'fertig') urgency = 'done';
    else if (remainSec <= 0) urgency = 'krit';
    else if (remainSec < 120) urgency = 'warn';

    return {
      id: o.id,
      nr: o.bestellnummer.slice(-4),
      name: o.kunde_name,
      status: o.status,
      elapsedSec,
      totalSec,
      progressPct,
      remainSec,
      urgency,
    };
  });

  entries.sort((a, b) => {
    const order = { krit: 0, warn: 1, ok: 2, done: 3 };
    if (order[a.urgency] !== order[b.urgency]) return order[a.urgency] - order[b.urgency];
    return a.remainSec - b.remainSec;
  });

  if (entries.length === 0) return null;

  const urgencyStyle = {
    krit: { bar: 'bg-red-500', text: 'text-red-700', border: 'border-red-200', bg: 'bg-red-50', badge: 'bg-red-500 text-white' },
    warn: { bar: 'bg-amber-400', text: 'text-amber-700', border: 'border-amber-200', bg: 'bg-amber-50', badge: 'bg-amber-400 text-white' },
    ok:   { bar: 'bg-matcha-500', text: 'text-matcha-700', border: 'border-matcha-200', bg: 'bg-matcha-50/60', badge: 'bg-matcha-500 text-white' },
    done: { bar: 'bg-slate-300', text: 'text-slate-500', border: 'border-slate-200', bg: 'bg-slate-50', badge: 'bg-slate-400 text-white' },
  };

  const statusLabel: Record<string, string> = {
    bestätigt: 'Warten',
    in_zubereitung: 'Kocht',
    fertig: 'Fertig',
  };

  const kritCount = entries.filter((e) => e.urgency === 'krit').length;
  const warnCount = entries.filter((e) => e.urgency === 'warn').length;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-card">
        <Flame className="h-4 w-4 text-orange-500 shrink-0" />
        <span className="text-xs font-black uppercase tracking-wider">Prep-Race · {active.length} aktiv</span>
        {kritCount > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[9px] font-black text-white animate-pulse">
            <AlertTriangle className="h-2.5 w-2.5" />
            {kritCount} überfällig
          </span>
        )}
        {kritCount === 0 && warnCount > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-black text-white">
            <Clock className="h-2.5 w-2.5" />
            {warnCount} knapp
          </span>
        )}
      </div>

      <div className="divide-y">
        {entries.map((e) => {
          const s = urgencyStyle[e.urgency];
          return (
            <div key={e.id} className={cn('px-4 py-2.5', s.bg)}>
              <div className="flex items-center gap-3 mb-1.5">
                {/* Status icon */}
                <div className={cn('shrink-0 flex h-7 w-7 items-center justify-center rounded-full text-white text-[10px] font-black', s.badge)}>
                  {e.status === 'fertig' ? <CheckCircle2 className="h-3.5 w-3.5" /> : e.urgency === 'krit' ? <AlertTriangle className="h-3.5 w-3.5" /> : <ChefHat className="h-3.5 w-3.5" />}
                </div>

                {/* Order info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black">#{e.nr}</span>
                    <span className="text-[11px] text-muted-foreground truncate">{e.name}</span>
                    <span className={cn('ml-auto shrink-0 text-[9px] font-bold rounded px-1 py-0.5', s.bg, s.text, 'border', s.border)}>
                      {statusLabel[e.status] ?? e.status}
                    </span>
                  </div>
                </div>

                {/* Countdown */}
                <div className="shrink-0 text-right min-w-[42px]">
                  {e.status === 'fertig' ? (
                    <span className="text-[10px] text-slate-400 font-bold">✓</span>
                  ) : e.urgency === 'krit' ? (
                    <span className="font-mono text-xs font-black text-red-600 animate-pulse">+{fmtSec(-e.remainSec)}</span>
                  ) : (
                    <span className={cn('font-mono text-xs font-black', s.text)}>{fmtSec(e.remainSec)}</span>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-2 rounded-full bg-black/8 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-1000',
                    s.bar,
                    e.urgency === 'krit' && 'animate-pulse',
                  )}
                  style={{ width: `${e.progressPct}%` }}
                />
              </div>
              <div className="flex justify-between mt-0.5">
                <span className="text-[9px] text-muted-foreground tabular-nums">{fmtSec(e.elapsedSec)} vergangen</span>
                <span className="text-[9px] text-muted-foreground tabular-nums">{e.progressPct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
