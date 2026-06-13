'use client';

/**
 * KitchenPrepProgressCards
 * Compact Fortschritts-Ringe für alle in_zubereitung-Bestellungen.
 * Zeigt pro Bestellung: Fortschrittsring (% der Zubereitungszeit),
 * Restzeit und Farbcodierung nach Dringlichkeit.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat } from 'lucide-react';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  kunde_name: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
};

type KitchenTiming = {
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  status: string;
};

interface Props {
  orders: Order[];
  timings: KitchenTiming[];
}

function useTick(ms = 1000) {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT(n => n + 1), ms);
    return () => clearInterval(iv);
  }, [ms]);
}

function PrepRing({
  pct,
  remainSec,
  label,
  urgency,
}: {
  pct: number;
  remainSec: number | null;
  label: string;
  urgency: 'ok' | 'tight' | 'urgent' | 'overdue';
}) {
  const R = 26;
  const circ = 2 * Math.PI * R;
  const filled = Math.min(1, Math.max(0, pct)) * circ;

  const colors = {
    ok:     { stroke: '#22c55e', text: 'text-matcha-700',  bg: 'bg-matcha-50  border-matcha-200' },
    tight:  { stroke: '#f59e0b', text: 'text-amber-700',   bg: 'bg-amber-50   border-amber-200'  },
    urgent: { stroke: '#f97316', text: 'text-orange-700',  bg: 'bg-orange-50  border-orange-200' },
    overdue:{ stroke: '#ef4444', text: 'text-red-700',     bg: 'bg-red-50     border-red-200'    },
  };
  const c = colors[urgency];

  const mm = remainSec !== null ? Math.floor(Math.abs(remainSec) / 60) : null;
  const ss = remainSec !== null ? Math.abs(remainSec) % 60 : null;

  return (
    <div className={cn('relative flex flex-col items-center rounded-xl border px-3 py-2.5 gap-1.5 min-w-[80px]', c.bg, urgency === 'overdue' && 'animate-pulse')}>
      <div className="relative" style={{ width: 60, height: 60 }}>
        <svg width="60" height="60" viewBox="0 0 60 60" className="-rotate-90">
          <circle cx="30" cy="30" r={R} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="5" />
          <circle
            cx="30" cy="30" r={R} fill="none"
            stroke={c.stroke} strokeWidth="5" strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ - filled}
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          {remainSec !== null ? (
            <div className="flex flex-col items-center leading-none">
              <span className={cn('font-mono text-[10px] font-black tabular-nums', remainSec < 0 ? 'text-red-600' : c.text)}>
                {remainSec < 0 ? '+' : ''}{mm}:{String(ss).padStart(2, '0')}
              </span>
            </div>
          ) : (
            <ChefHat className={cn('h-4 w-4', c.text)} />
          )}
        </div>
      </div>
      <div className={cn('text-[10px] font-bold text-center leading-snug truncate max-w-[72px]', c.text)}>
        {label}
      </div>
      <div className={cn('text-[9px] font-black uppercase tracking-wide', c.text)}>
        {urgency === 'overdue' ? 'Überfällig' : urgency === 'urgent' ? 'Eilt' : urgency === 'tight' ? 'Bald' : 'OK'}
      </div>
    </div>
  );
}

export function KitchenPrepProgressCards({ orders, timings }: Props) {
  useTick();

  const cooking = orders.filter(o => o.status === 'in_zubereitung');
  if (cooking.length === 0) return null;

  const now = Date.now();

  const cards = cooking.map(order => {
    const timing = timings.find(t => t.order_id === order.id);

    let pct = 0;
    let remainSec: number | null = null;
    let urgency: 'ok' | 'tight' | 'urgent' | 'overdue' = 'ok';

    if (timing?.cook_start_at && timing?.ready_target) {
      const startMs = new Date(timing.cook_start_at).getTime();
      const endMs = new Date(timing.ready_target).getTime();
      const totalMs = endMs - startMs;
      const elapsedMs = now - startMs;
      pct = totalMs > 0 ? elapsedMs / totalMs : 0;
      remainSec = Math.floor((endMs - now) / 1000);
    } else if (order.bestellt_am && order.geschaetzte_zubereitung_min) {
      const startMs = new Date(order.bestellt_am).getTime();
      const totalMs = order.geschaetzte_zubereitung_min * 60_000;
      const elapsedMs = now - startMs;
      pct = totalMs > 0 ? elapsedMs / totalMs : 0;
      remainSec = Math.floor((startMs + totalMs - now) / 1000);
    }

    if (remainSec !== null) {
      if (remainSec < 0) urgency = 'overdue';
      else if (remainSec < 120) urgency = 'urgent';
      else if (remainSec < 300) urgency = 'tight';
    } else if (pct > 1) {
      urgency = 'overdue';
    } else if (pct > 0.85) {
      urgency = 'urgent';
    } else if (pct > 0.65) {
      urgency = 'tight';
    }

    const name = order.kunde_name.split(' ')[0];
    const nr = order.bestellnummer.replace('FF-', '').slice(-4);
    return { order, pct, remainSec, urgency, label: `${name} #${nr}` };
  });

  // Sort by urgency then remaining time
  const urgencyOrder = { overdue: 0, urgent: 1, tight: 2, ok: 3 };
  cards.sort((a, b) => {
    const uDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    if (uDiff !== 0) return uDiff;
    const aR = a.remainSec ?? 9999;
    const bR = b.remainSec ?? 9999;
    return aR - bR;
  });

  const overdueCount = cards.filter(c => c.urgency === 'overdue').length;
  const urgentCount = cards.filter(c => c.urgency === 'urgent').length;

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50/50 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-orange-200/60">
        <ChefHat className="h-3.5 w-3.5 text-orange-600 shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-widest text-orange-700">
          Kochfortschritt · {cooking.length} aktiv
        </span>
        {overdueCount > 0 && (
          <span className="ml-auto rounded-full bg-red-500 text-white text-[9px] font-black px-2 py-0.5 animate-pulse">
            {overdueCount} überfällig
          </span>
        )}
        {overdueCount === 0 && urgentCount > 0 && (
          <span className="ml-auto rounded-full bg-orange-500 text-white text-[9px] font-black px-2 py-0.5">
            {urgentCount} eilt
          </span>
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto px-3 py-3 scrollbar-none">
        {cards.map(c => (
          <PrepRing
            key={c.order.id}
            pct={c.pct}
            remainSec={c.remainSec}
            label={c.label}
            urgency={c.urgency}
          />
        ))}
      </div>
    </div>
  );
}
