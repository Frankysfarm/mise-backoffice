'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, Flame, CheckCircle2, AlertTriangle } from 'lucide-react';

interface Order {
  id: string;
  bestellnummer?: string;
  bestellt_am?: string;
  acceptedAt?: string | Date;
  estimatedTime?: number;
  status?: string;
  items?: { name?: string; menge?: number; quantity?: number }[];
}

interface KitchenTiming {
  orderId?: string;
  order_id?: string;
  prep_start?: string;
  target_ready_at?: string;
  estimated_prep_min?: number;
}

interface Props {
  orders: Order[];
  timings?: KitchenTiming[];
  onMarkDone?: (id: string) => void;
}

function useNow(intervalMs = 5000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

type Urgency = 'ok' | 'soon' | 'urgent' | 'late';

function getUrgency(elapsedMin: number, estimatedMin: number): Urgency {
  const pct = estimatedMin > 0 ? elapsedMin / estimatedMin : 0;
  if (elapsedMin > estimatedMin) return 'late';
  if (pct >= 0.8) return 'urgent';
  if (pct >= 0.55) return 'soon';
  return 'ok';
}

const URGENCY_STYLES: Record<Urgency, { bg: string; border: string; text: string; ring: string; label: string }> = {
  ok:     { bg: 'bg-matcha-50', border: 'border-matcha-200', text: 'text-matcha-700', ring: 'text-matcha-500', label: 'Gut' },
  soon:   { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  ring: 'text-amber-500',  label: 'Bald' },
  urgent: { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-700', ring: 'text-orange-500', label: 'Dringend' },
  late:   { bg: 'bg-red-50',    border: 'border-red-300',    text: 'text-red-700',    ring: 'text-red-500',    label: 'Überfällig' },
};

function CountdownRing({ pct, urgency, remainMin }: { pct: number; urgency: Urgency; remainMin: number }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const strokePct = Math.min(1, Math.max(0, pct));
  const strokeDash = strokePct * circ;
  const colors: Record<Urgency, string> = {
    ok: '#4a7c59', soon: '#d97706', urgent: '#ea580c', late: '#dc2626',
  };
  return (
    <div className="relative w-14 h-14 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 52 52">
        <circle cx="26" cy="26" r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
        <circle
          cx="26" cy="26" r={r} fill="none"
          stroke={colors[urgency]}
          strokeWidth="4"
          strokeDasharray={`${strokeDash} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-[10px] font-black tabular-nums leading-none', URGENCY_STYLES[urgency].text)}>
          {urgency === 'late' ? `+${Math.abs(Math.round(remainMin))}` : Math.round(remainMin)}
        </span>
        <span className="text-[7px] text-stone-400 leading-none">min</span>
      </div>
    </div>
  );
}

export function KitchenPhase1090LiveCountdownWall({ orders, timings = [], onMarkDone }: Props) {
  const now = useNow(5000);

  const activeOrders = orders.filter(o =>
    o.status && !['geliefert', 'abgeholt', 'abgeschlossen', 'storniert'].includes(o.status)
  );

  if (activeOrders.length === 0) return null;

  const rows = activeOrders
    .map(o => {
      const timing = timings.find(t => (t.orderId ?? t.order_id) === o.id);
      const startMs = timing?.prep_start
        ? new Date(timing.prep_start).getTime()
        : o.acceptedAt
          ? new Date(o.acceptedAt).getTime()
          : o.bestellt_am
            ? new Date(o.bestellt_am).getTime()
            : null;

      const estimatedMin = timing?.estimated_prep_min ?? o.estimatedTime ?? 20;
      const elapsedMin = startMs ? (now - startMs) / 60_000 : 0;
      const remainMin = estimatedMin - elapsedMin;
      const pct = estimatedMin > 0 ? Math.max(0, Math.min(1, elapsedMin / estimatedMin)) : 0;
      const urgency = getUrgency(elapsedMin, estimatedMin);

      return { o, elapsedMin, remainMin, pct, urgency, estimatedMin };
    })
    .sort((a, b) => b.elapsedMin - a.elapsedMin)
    .slice(0, 12);

  const lateCount = rows.filter(r => r.urgency === 'late').length;
  const urgentCount = rows.filter(r => r.urgency === 'urgent').length;

  return (
    <div className="mx-4 my-2 rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-stone-50 border-b border-stone-200">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-stone-500" />
          <span className="text-xs font-black uppercase tracking-wider text-stone-600">Live Countdown — Aktive Bestellungen</span>
        </div>
        <div className="flex items-center gap-2">
          {lateCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
              <AlertTriangle className="w-2.5 h-2.5" /> {lateCount} überfällig
            </span>
          )}
          {urgentCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5">
              <Flame className="w-2.5 h-2.5" /> {urgentCount} dringend
            </span>
          )}
          <span className="text-[10px] text-stone-400 font-medium">{rows.length} Bestellungen</span>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-px bg-stone-100">
        {rows.map(({ o, remainMin, pct, urgency, estimatedMin, elapsedMin }) => {
          const style = URGENCY_STYLES[urgency];
          const itemCount = o.items?.reduce((s, i) => s + (i.menge ?? i.quantity ?? 1), 0) ?? 0;
          return (
            <div
              key={o.id}
              className={cn(
                'flex flex-col items-center gap-2 px-3 py-3 transition-colors',
                style.bg,
                urgency === 'late' && 'animate-pulse',
              )}
            >
              <CountdownRing pct={pct} urgency={urgency} remainMin={remainMin} />

              <div className="w-full text-center">
                <div className="font-black text-[11px] text-stone-800 truncate">
                  #{o.bestellnummer ?? o.id.slice(-4)}
                </div>
                {itemCount > 0 && (
                  <div className="text-[9px] text-stone-500">{itemCount} Pos.</div>
                )}
                <div className={cn('text-[9px] font-bold mt-0.5', style.text)}>{style.label}</div>
                <div className="text-[8px] text-stone-400 tabular-nums">
                  {Math.round(elapsedMin)}/{estimatedMin} min
                </div>
              </div>

              {onMarkDone && (
                <button
                  onClick={() => onMarkDone(o.id)}
                  className="w-full flex items-center justify-center gap-1 rounded-lg bg-matcha-600 text-white text-[9px] font-bold py-1 hover:bg-matcha-700 transition-colors"
                >
                  <CheckCircle2 className="w-2.5 h-2.5" /> Fertig
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
