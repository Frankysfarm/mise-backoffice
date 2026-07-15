'use client';

import { useEffect, useState } from 'react';
import { Clock, Flame, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  items?: { name: string }[];
};

type Props = { orders: Order[] };

type Row = {
  id: string;
  nr: string;
  elapsedSec: number;
  targetSec: number;
  remainSec: number;
  urgency: 'ok' | 'tight' | 'urgent' | 'critical';
};

function urgencyLabel(u: Row['urgency']) {
  if (u === 'critical') return 'Überfällig';
  if (u === 'urgent') return 'Dringend';
  if (u === 'tight') return 'Knapp';
  return 'OK';
}

function fmtSec(s: number) {
  if (s <= 0) return `+${Math.abs(Math.ceil(s / 60))}m`;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function KitchenPhase1700LiveTimingCockpit({ orders }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const active = orders.filter(
    (o) => o.status === 'in_zubereitung' || o.status === 'bestätigt',
  );

  if (active.length === 0) return null;

  const rows: Row[] = active
    .map((o) => {
      const startMs = o.bestellt_am ? new Date(o.bestellt_am).getTime() : now;
      const targetMin = o.geschaetzte_zubereitung_min ?? 15;
      const targetSec = targetMin * 60;
      const elapsedSec = (now - startMs) / 1000;
      const remainSec = targetSec - elapsedSec;
      const pct = elapsedSec / targetSec;

      let urgency: Row['urgency'] = 'ok';
      if (remainSec < 0) urgency = 'critical';
      else if (pct >= 0.85) urgency = 'urgent';
      else if (pct >= 0.65) urgency = 'tight';

      return {
        id: o.id,
        nr: o.bestellnummer,
        elapsedSec,
        targetSec,
        remainSec,
        urgency,
      };
    })
    .sort((a, b) => a.remainSec - b.remainSec);

  const critical = rows.filter((r) => r.urgency === 'critical').length;
  const urgent = rows.filter((r) => r.urgency === 'urgent').length;

  const urgencyStyle: Record<Row['urgency'], { bar: string; bg: string; text: string; badge: string }> = {
    critical: { bar: 'bg-red-500',    bg: 'bg-red-50',    text: 'text-red-700',    badge: 'bg-red-500 text-white animate-pulse' },
    urgent:   { bar: 'bg-orange-400', bg: 'bg-orange-50', text: 'text-orange-700', badge: 'bg-orange-400 text-white' },
    tight:    { bar: 'bg-amber-400',  bg: 'bg-amber-50',  text: 'text-amber-700',  badge: 'bg-amber-300 text-amber-900' },
    ok:       { bar: 'bg-matcha-500', bg: 'bg-white',     text: 'text-matcha-700', badge: 'bg-matcha-100 text-matcha-800' },
  };

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-100">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100 text-matcha-700">
          <Clock className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-foreground">Live Timing Cockpit</div>
          <div className="text-[11px] text-muted-foreground">
            {rows.length} aktiv{rows.length !== 1 ? 'e' : 'e'} Bestellung{rows.length !== 1 ? 'en' : ''}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {critical > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[9px] font-black text-white animate-pulse">
              <AlertTriangle className="h-2.5 w-2.5" />
              {critical} überfällig
            </span>
          )}
          {urgent > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-400 px-2 py-0.5 text-[9px] font-black text-white">
              <Flame className="h-2.5 w-2.5" />
              {urgent} dringend
            </span>
          )}
          {critical === 0 && urgent === 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-matcha-100 px-2 py-0.5 text-[9px] font-bold text-matcha-800">
              <CheckCircle2 className="h-2.5 w-2.5" />
              Alles im Plan
            </span>
          )}
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-stone-100">
        {rows.map((row) => {
          const s = urgencyStyle[row.urgency];
          const pct = Math.min(100, Math.max(0, (row.elapsedSec / row.targetSec) * 100));
          return (
            <div key={row.id} className={cn('flex items-center gap-3 px-4 py-2.5', s.bg)}>
              {/* Urgency badge */}
              <div className={cn('shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black min-w-[64px] text-center', s.badge)}>
                {urgencyLabel(row.urgency)}
              </div>

              {/* Order number + progress */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold tabular-nums">#{row.nr}</span>
                  <span className={cn('text-[11px] font-mono font-black tabular-nums', s.text)}>
                    {fmtSec(row.remainSec)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-black/5 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-1000', s.bar)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Elapsed */}
              <div className="shrink-0 text-right">
                <div className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {Math.floor(row.elapsedSec / 60)}m
                </div>
                <div className="text-[8px] text-muted-foreground">vergangen</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
