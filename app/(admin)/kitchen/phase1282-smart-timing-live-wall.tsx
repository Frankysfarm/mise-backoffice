'use client';

// Phase 1282 — Smart-Timing Live Wall (Küche)
// Konsolidierte Echtzeit-Countdown-Wand: alle aktiven Bestellungen mit 5-stufiger Farbkodierung
// Props: orders (Order[]) · timings (KitchenTiming[])
// Intern: 1-Sekunden-Tick · kollabierbar · kein API-Call nötig

import { useEffect, useState } from 'react';
import { Clock, Flame, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type Item = { id: string; name: string; menge: number; einzelpreis: number; notiz: string | null; extras: unknown };
type Order = {
  id: string; bestellnummer: string; status: string; typ: string;
  kunde_name: string; bestellt_am: string | null; fertig_am: string | null;
  geschaetzte_zubereitung_min: number | null; location_id: string | null;
  items: Item[];
};
type KitchenTiming = {
  id: string; order_id: string; cook_start_at: string | null;
  ready_target: string | null; prep_min: number | null; status: string;
};

interface Props { orders: Order[]; timings: KitchenTiming[] }

type Urgency = 'done' | 'ok' | 'tight' | 'urgent' | 'critical' | 'overdue';

const URGENCY_STYLES: Record<Urgency, { bg: string; border: string; text: string; badge: string; label: string }> = {
  done:    { bg: 'bg-matcha-50',   border: 'border-matcha-200',  text: 'text-matcha-700',  badge: 'bg-matcha-100 text-matcha-700',  label: 'Fertig' },
  ok:      { bg: 'bg-emerald-50',  border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700', label: 'In Zeit' },
  tight:   { bg: 'bg-amber-50',    border: 'border-amber-200',   text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700',    label: 'Knapp' },
  urgent:  { bg: 'bg-orange-50',   border: 'border-orange-200',  text: 'text-orange-700',  badge: 'bg-orange-100 text-orange-700',  label: 'Dringend' },
  critical: { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     badge: 'bg-red-100 text-red-700',        label: 'Kritisch' },
  overdue: { bg: 'bg-red-100',     border: 'border-red-400',     text: 'text-red-800',     badge: 'bg-red-500 text-white',          label: 'Überfällig' },
};

function getUrgency(remainSec: number | null, status: string): Urgency {
  if (status === 'fertig' || status === 'unterwegs') return 'done';
  if (remainSec === null) return 'ok';
  if (remainSec < 0) return 'overdue';
  if (remainSec < 120) return 'critical';
  if (remainSec < 240) return 'urgent';
  if (remainSec < 480) return 'tight';
  return 'ok';
}

function fmtTime(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = sec < 0 ? '-' : '';
  return `${sign}${m}:${s.toString().padStart(2, '0')}`;
}

function fmtElapsed(startedAt: string | null): string {
  if (!startedAt) return '—';
  const diff = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  const m = Math.floor(diff / 60);
  return `${m} Min`;
}

export function KitchenPhase1282SmartTimingLiveWall({ orders, timings }: Props) {
  const [, setTick] = useState(0);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const timingMap = new Map(timings.map(t => [t.order_id, t]));

  const active = orders.filter(o =>
    ['in_zubereitung', 'neu', 'bestätigt', 'fertig'].includes(o.status)
  );

  if (active.length === 0) return null;

  const cells = active.map(o => {
    const timing = timingMap.get(o.id);
    const now = Date.now();
    let remainSec: number | null = null;

    if (timing?.status === 'cooking' && timing.ready_target) {
      remainSec = Math.floor((new Date(timing.ready_target).getTime() - now) / 1000);
    } else if (o.status !== 'fertig' && o.bestellt_am && o.geschaetzte_zubereitung_min) {
      const target = new Date(o.bestellt_am).getTime() + o.geschaetzte_zubereitung_min * 60_000;
      remainSec = Math.floor((target - now) / 1000);
    }

    const urgency = getUrgency(remainSec, o.status);
    return { o, timing, remainSec, urgency };
  }).sort((a, b) => {
    const order: Urgency[] = ['overdue', 'critical', 'urgent', 'tight', 'ok', 'done'];
    return order.indexOf(a.urgency) - order.indexOf(b.urgency);
  });

  const overdueCount = cells.filter(c => c.urgency === 'overdue').length;
  const criticalCount = cells.filter(c => c.urgency === 'critical').length;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-50 transition"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-matcha-100">
            <Clock className="h-3.5 w-3.5 text-matcha-700" />
          </div>
          <span className="font-display text-sm font-bold uppercase tracking-wider text-char">
            Smart-Timing Live Wall
          </span>
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-600">
            {active.length} aktiv
          </span>
          {overdueCount > 0 && (
            <span className="animate-pulse rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">
              {overdueCount} ÜBERFÄLLIG
            </span>
          )}
          {criticalCount > 0 && overdueCount === 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
              {criticalCount} kritisch
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
      </button>

      {open && (
        <div className="border-t border-stone-100 p-4">
          {/* Color Legend */}
          <div className="mb-3 flex items-center gap-3 flex-wrap">
            {(Object.entries(URGENCY_STYLES) as [Urgency, typeof URGENCY_STYLES[Urgency]][])
              .filter(([k]) => k !== 'done')
              .map(([k, s]) => (
                <div key={k} className="flex items-center gap-1">
                  <div className={cn('h-2.5 w-2.5 rounded-full', s.badge.split(' ')[0])} />
                  <span className="text-[10px] text-stone-500">{s.label}</span>
                </div>
              ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {cells.map(({ o, timing, remainSec, urgency }) => {
              const s = URGENCY_STYLES[urgency];
              const isCooking = timing?.status === 'cooking';
              const isOverdue = urgency === 'overdue';

              return (
                <div
                  key={o.id}
                  className={cn(
                    'flex flex-col gap-1 rounded-xl border p-3 transition-all duration-300',
                    s.bg, s.border,
                    isOverdue && 'animate-pulse',
                  )}
                >
                  {/* Order number + status */}
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-black text-stone-700">
                      #{o.bestellnummer.slice(-4)}
                    </span>
                    <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-black', s.badge)}>
                      {s.label}
                    </span>
                  </div>

                  {/* Customer */}
                  <div className="text-[10px] font-semibold text-stone-600 truncate leading-tight">
                    {o.kunde_name}
                  </div>

                  {/* Items count */}
                  <div className="text-[9px] text-stone-400">
                    {o.items.length} Position{o.items.length !== 1 ? 'en' : ''}
                    {o.typ === 'lieferung' ? ' · Lieferung' : o.typ === 'abholung' ? ' · Abholung' : ''}
                  </div>

                  {/* Countdown */}
                  <div className={cn('mt-1 text-center font-mono text-xl font-black tabular-nums leading-none', s.text)}>
                    {urgency === 'done' ? (
                      <span className="text-base">✓ Fertig</span>
                    ) : remainSec !== null ? (
                      fmtTime(remainSec)
                    ) : (
                      <span className="text-sm">{fmtElapsed(o.bestellt_am)}</span>
                    )}
                  </div>

                  {/* Cooking indicator */}
                  {isCooking && urgency !== 'done' && (
                    <div className="flex items-center justify-center gap-1 mt-0.5">
                      <Flame className="h-3 w-3 text-orange-500" />
                      <span className="text-[9px] font-semibold text-orange-600">kocht</span>
                    </div>
                  )}
                  {!isCooking && urgency !== 'done' && timing?.status === 'scheduled' && (
                    <div className="flex items-center justify-center gap-1 mt-0.5">
                      <Zap className="h-3 w-3 text-matcha-500" />
                      <span className="text-[9px] font-semibold text-matcha-600">geplant</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Summary bar */}
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-stone-50 px-3 py-2 text-[10px] text-stone-500 flex-wrap">
            {(Object.entries(URGENCY_STYLES) as [Urgency, typeof URGENCY_STYLES[Urgency]][]).map(([k, s]) => {
              const count = cells.filter(c => c.urgency === k).length;
              if (count === 0) return null;
              return (
                <span key={k} className={cn('font-bold', s.text)}>
                  {count}× {s.label}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
