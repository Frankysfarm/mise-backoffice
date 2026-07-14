'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

// Phase 1485 — Bestellstatus-Progress-Ring (Storefront)
// Kompakter SVG-Ring (0–4 Schritte) statt Leiste.
// Puls-Animation auf aktivem Schritt. Hydration-safe.
// Nach Phase 1480.

type Schritt = 0 | 1 | 2 | 3 | 4;

interface Props {
  orderStatus: 'neu' | 'bestaetigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert' | null;
  locationId: string;
}

const SCHRITTE: { label: string; kurz: string }[] = [
  { label: 'Bestellt', kurz: 'B' },
  { label: 'Zubereitung', kurz: 'Z' },
  { label: 'Fertig', kurz: 'F' },
  { label: 'Unterwegs', kurz: 'U' },
  { label: 'Geliefert', kurz: 'G' },
];

function statusToSchritt(status: Props['orderStatus']): Schritt {
  switch (status) {
    case 'neu':
    case 'bestaetigt':
      return 0;
    case 'in_zubereitung':
      return 1;
    case 'fertig':
      return 2;
    case 'unterwegs':
      return 3;
    case 'geliefert':
      return 4;
    default:
      return 0;
  }
}

const TOTAL = 4;
const SIZE = 100;
const STROKE = 9;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

const RING_COLORS: Record<Schritt, string> = {
  0: 'stroke-slate-400',
  1: 'stroke-amber-400',
  2: 'stroke-sky-400',
  3: 'stroke-indigo-400',
  4: 'stroke-emerald-400',
};

const TEXT_COLORS: Record<Schritt, string> = {
  0: 'text-slate-500',
  1: 'text-amber-500',
  2: 'text-sky-500',
  3: 'text-indigo-500',
  4: 'text-emerald-500',
};

export function StorefrontPhase1485BestellstatusProgressRing({ orderStatus, locationId: _locationId }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted || !orderStatus) return null;

  const aktiv = statusToSchritt(orderStatus);
  const fill = aktiv / TOTAL;
  const dashOffset = CIRC * (1 - fill);
  const ringCls = RING_COLORS[aktiv];
  const textCls = TEXT_COLORS[aktiv];
  const isDone = aktiv === 4;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm p-4">
      <div className="flex items-center gap-4">
        {/* SVG Ring */}
        <div className="relative shrink-0">
          <svg width={SIZE} height={SIZE} className="-rotate-90">
            <circle
              cx={SIZE / 2} cy={SIZE / 2} r={R}
              fill="none" stroke="currentColor" strokeWidth={STROKE}
              className="text-muted/20"
            />
            <circle
              cx={SIZE / 2} cy={SIZE / 2} r={R}
              fill="none" strokeWidth={STROKE} strokeLinecap="round"
              strokeDasharray={CIRC} strokeDashoffset={dashOffset}
              className={cn(ringCls, 'transition-all duration-700')}
            />
          </svg>
          {/* Puls-Dot auf aktivem Schritt */}
          {!isDone && (
            <span className={cn(
              'absolute inset-0 flex items-center justify-center',
            )}>
              <span className={cn(
                'relative flex h-4 w-4',
              )}>
                <span className={cn(
                  'animate-ping absolute inline-flex h-full w-full rounded-full opacity-50',
                  aktiv === 1 ? 'bg-amber-400' : aktiv === 2 ? 'bg-sky-400' : aktiv === 3 ? 'bg-indigo-400' : 'bg-slate-400',
                )} />
                <span className={cn(
                  'relative inline-flex rounded-full h-4 w-4',
                  aktiv === 1 ? 'bg-amber-500' : aktiv === 2 ? 'bg-sky-500' : aktiv === 3 ? 'bg-indigo-500' : 'bg-slate-500',
                )} />
              </span>
            </span>
          )}
          {isDone && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-emerald-500 text-lg font-black">✓</span>
            </div>
          )}
        </div>

        {/* Schritt-Liste */}
        <div className="flex-1 space-y-1">
          {SCHRITTE.map((s, i) => {
            const done = i < aktiv;
            const current = i === aktiv;
            return (
              <div key={i} className="flex items-center gap-2">
                <div className={cn(
                  'h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-black shrink-0 transition-colors',
                  done
                    ? 'bg-emerald-500 text-white'
                    : current
                    ? cn('text-white', aktiv === 1 ? 'bg-amber-500' : aktiv === 2 ? 'bg-sky-500' : aktiv === 3 ? 'bg-indigo-500' : 'bg-slate-500')
                    : 'bg-muted text-muted-foreground',
                )}>
                  {done ? '✓' : s.kurz}
                </div>
                <span className={cn(
                  'text-xs transition-colors',
                  done ? 'text-muted-foreground line-through' : current ? cn('font-bold', textCls) : 'text-muted-foreground',
                )}>
                  {s.label}
                </span>
                {current && !isDone && (
                  <span className={cn('ml-auto text-[9px] font-semibold animate-pulse', textCls)}>
                    ● Aktiv
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {isDone && (
        <div className="mt-3 text-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg py-2 border border-emerald-200 dark:border-emerald-800">
          ✓ Bestellung geliefert — Guten Appetit!
        </div>
      )}
    </div>
  );
}
