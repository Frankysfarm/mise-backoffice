'use client';

/**
 * Phase 576 — Storefront: Bestellstatus-Fortschritts-Ring
 *
 * Animierter Fortschritts-Ring mit Phasen-Beschriftung.
 * Zeigt Prozent-Fortschritt vom Auftragseingang bis Lieferung.
 *
 * Phasen und Fortschritt:
 *   bestätigt       →  15%
 *   in_zubereitung  →  35%
 *   fertig          →  60%
 *   unterwegs       →  80%
 *   geliefert       → 100%
 *
 * Ticker: lokal + 30s-Poll (wenn orderId gegeben)
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Package } from 'lucide-react';

type OrderStatus = 'bestätigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert';

interface Props {
  orderStatus?: OrderStatus | string;
  etaMin?: number | null;
  orderedAt?: string | null;
}

const PHASES: { status: OrderStatus; label: string; pct: number }[] = [
  { status: 'bestätigt',      label: 'Bestätigt',      pct: 15 },
  { status: 'in_zubereitung', label: 'In Küche',        pct: 35 },
  { status: 'fertig',         label: 'Fertig',          pct: 60 },
  { status: 'unterwegs',      label: 'Unterwegs',       pct: 80 },
  { status: 'geliefert',      label: 'Geliefert',       pct: 100 },
];

const STATUS_PCT: Record<string, number> = Object.fromEntries(PHASES.map(p => [p.status, p.pct]));

const RADIUS = 48;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function getPct(status: string): number {
  return STATUS_PCT[status] ?? 10;
}

export function Phase576BestellFortschrittsRing({ orderStatus = 'bestätigt', etaMin, orderedAt }: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!orderedAt) return;
    const update = () => {
      const ms = Date.now() - new Date(orderedAt).getTime();
      setElapsed(Math.floor(ms / 60_000));
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [orderedAt]);

  const pct = getPct(orderStatus);
  const isDelivered = orderStatus === 'geliefert';
  const strokeDash = (pct / 100) * CIRCUMFERENCE;
  const currentPhaseIdx = PHASES.findIndex(p => p.status === orderStatus);

  const remaining = etaMin != null ? Math.max(0, etaMin - elapsed) : null;

  return (
    <div className="rounded-2xl border border-matcha-200 bg-white p-4 text-center">
      {/* SVG Ring */}
      <div className="relative mx-auto" style={{ width: 128, height: 128 }}>
        <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90">
          {/* Background track */}
          <circle
            cx="64" cy="64" r={RADIUS}
            fill="none"
            strokeWidth="10"
            stroke="#e5e7eb"
          />
          {/* Progress arc */}
          <circle
            cx="64" cy="64" r={RADIUS}
            fill="none"
            strokeWidth="10"
            stroke={isDelivered ? '#16a34a' : '#4d7c5f'}
            strokeLinecap="round"
            strokeDasharray={`${strokeDash} ${CIRCUMFERENCE}`}
            style={{ transition: 'stroke-dasharray 0.8s ease' }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isDelivered ? (
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          ) : (
            <>
              <div className="text-2xl font-black tabular-nums text-matcha-700">{pct}%</div>
              {remaining != null && (
                <div className="text-[10px] text-muted-foreground tabular-nums">~{remaining} Min</div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Status label */}
      <div className={cn('mt-2 text-sm font-bold', isDelivered ? 'text-emerald-600' : 'text-matcha-700')}>
        {PHASES.find(p => p.status === orderStatus)?.label ?? 'Verarbeitung'}
      </div>

      {/* Phase dots */}
      <div className="flex items-center justify-center gap-1 mt-3">
        {PHASES.map((p, i) => {
          const done = i < currentPhaseIdx;
          const active = i === currentPhaseIdx;
          return (
            <div key={p.status} className="flex items-center gap-1">
              <div className={cn(
                'h-2 w-2 rounded-full transition-all duration-500',
                done ? 'bg-matcha-500' : active ? 'bg-matcha-700 scale-125' : 'bg-slate-200',
              )} />
              {i < PHASES.length - 1 && (
                <div className={cn('h-0.5 w-4 rounded-full', done ? 'bg-matcha-400' : 'bg-slate-200')} />
              )}
            </div>
          );
        })}
      </div>

      {/* Phase labels row */}
      <div className="flex justify-between mt-1 px-1">
        {PHASES.map((p, i) => {
          const active = i === currentPhaseIdx;
          return (
            <span key={p.status} className={cn(
              'text-[8px] font-medium',
              active ? 'text-matcha-700 font-bold' : 'text-slate-400',
            )}>
              {p.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
