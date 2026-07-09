'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, ChefHat, Bike, MapPin, Clock, Package } from 'lucide-react';

type OrderPhase = 'eingegangen' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert';

type Props = {
  orderId?: string;
  status?: string;
  etaMinutes?: number | null;
  driverName?: string | null;
  estimatedAt?: string | null;
  className?: string;
};

const PHASES: Array<{
  key: OrderPhase;
  label: string;
  icon: React.ReactNode;
  statuses: string[];
}> = [
  { key: 'eingegangen',    label: 'Bestellt',       icon: <Package className="h-4 w-4" />,       statuses: ['neu', 'bestätigt', 'eingegangen'] },
  { key: 'in_zubereitung', label: 'Wird zubereitet', icon: <ChefHat className="h-4 w-4" />,       statuses: ['in_zubereitung', 'zubereitung'] },
  { key: 'fertig',         label: 'Bereit',          icon: <CheckCircle2 className="h-4 w-4" />,  statuses: ['fertig', 'abholbereit'] },
  { key: 'unterwegs',      label: 'Unterwegs',       icon: <Bike className="h-4 w-4" />,          statuses: ['abgeholt', 'unterwegs', 'in_lieferung'] },
  { key: 'geliefert',      label: 'Angekommen',      icon: <MapPin className="h-4 w-4" />,        statuses: ['geliefert', 'zugestellt'] },
];

function statusToPhase(status: string): OrderPhase {
  for (const p of PHASES) {
    if (p.statuses.includes(status)) return p.key;
  }
  return 'eingegangen';
}

function phaseIndex(phase: OrderPhase): number {
  return PHASES.findIndex(p => p.key === phase);
}

function fmtCountdown(ms: number): string {
  if (ms <= 0) return 'Jeden Moment';
  const min = Math.floor(ms / 60_000);
  const sec = Math.floor((ms % 60_000) / 1000);
  if (min > 0) return `${min}:${String(sec).padStart(2, '0')} Min`;
  return `${sec}s`;
}

export function StorefrontPhase975DynamischeEtaLiveKommando({
  orderId: _orderId,
  status = 'bestätigt',
  etaMinutes,
  driverName,
  estimatedAt,
  className,
}: Props) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const nowMs = Date.now();
  const currentPhase = statusToPhase(status);
  const currentIdx   = phaseIndex(currentPhase);
  const isDelivered  = currentPhase === 'geliefert';

  // ETA countdown
  const etaMs = estimatedAt
    ? new Date(estimatedAt).getTime()
    : etaMinutes != null
      ? nowMs + etaMinutes * 60_000
      : null;
  const remainMs = etaMs ? etaMs - nowMs : null;

  // Animated pulse dots for active phase
  const activePhaseDef = PHASES[currentIdx];

  return (
    <div className={cn('rounded-2xl border bg-card overflow-hidden shadow-sm', className)}>
      {/* ETA header */}
      <div className={cn(
        'px-4 py-3 flex items-center gap-3',
        isDelivered
          ? 'bg-matcha-600 text-white'
          : 'bg-gradient-to-r from-matcha-600 to-matcha-500 text-white',
      )}>
        <div className="flex-1">
          {isDelivered ? (
            <div>
              <div className="text-base font-black">Bestellung angekommen!</div>
              <div className="text-sm opacity-80">Guten Appetit!</div>
            </div>
          ) : (
            <div>
              <div className="text-[11px] font-semibold opacity-80 uppercase tracking-wide">
                {remainMs != null && remainMs > 0 ? 'Lieferung in' : 'Voraussichtliche Lieferzeit'}
              </div>
              <div className="text-2xl font-black tabular-nums leading-tight">
                {remainMs != null && remainMs > 0
                  ? fmtCountdown(remainMs)
                  : etaMs
                    ? new Date(etaMs).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
                    : etaMinutes != null
                      ? `ca. ${etaMinutes} Min`
                      : '—'
                }
              </div>
            </div>
          )}
        </div>
        <div className={cn(
          'shrink-0 w-12 h-12 rounded-full flex items-center justify-center',
          'bg-white/20',
        )}>
          {isDelivered
            ? <CheckCircle2 className="h-6 w-6" />
            : <Clock className="h-6 w-6" />
          }
        </div>
      </div>

      {/* Phase progress */}
      <div className="px-4 py-3">
        <div className="flex items-start gap-0">
          {PHASES.map((phase, idx) => {
            const done    = idx < currentIdx;
            const active  = idx === currentIdx;
            const future  = idx > currentIdx;
            const last    = idx === PHASES.length - 1;

            return (
              <React.Fragment key={phase.key}>
                <div className="flex flex-col items-center gap-1 flex-1">
                  {/* Step dot */}
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 relative z-10',
                    done   ? 'bg-matcha-500 text-white' : '',
                    active ? 'bg-matcha-600 text-white ring-4 ring-matcha-200' : '',
                    future ? 'bg-muted text-muted-foreground' : '',
                    active && !isDelivered ? 'animate-pulse' : '',
                  )}>
                    {done
                      ? <CheckCircle2 className="h-4 w-4" />
                      : phase.icon
                    }
                  </div>
                  {/* Label */}
                  <span className={cn(
                    'text-[9px] font-bold text-center leading-tight max-w-[52px]',
                    active ? 'text-matcha-700 dark:text-matcha-300' : done ? 'text-matcha-600' : 'text-muted-foreground',
                  )}>
                    {phase.label}
                  </span>
                </div>
                {/* Connector line */}
                {!last && (
                  <div className={cn(
                    'flex-1 h-0.5 mt-4 mx-1 rounded-full transition-all duration-700',
                    idx < currentIdx ? 'bg-matcha-500' : 'bg-muted',
                  )} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Current status label */}
      <div className="px-4 pb-3">
        <div className="rounded-xl bg-muted/30 px-3 py-2 flex items-center gap-2">
          <div className={cn(
            'w-2 h-2 rounded-full shrink-0',
            isDelivered ? 'bg-matcha-500' : 'bg-matcha-500 animate-pulse',
          )} />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-bold">
              {activePhaseDef?.label ?? 'Bearbeitung'}
            </span>
            {driverName && currentPhase === 'unterwegs' && (
              <span className="text-[10px] text-muted-foreground ml-1.5">
                · Fahrer: {driverName}
              </span>
            )}
          </div>
          <div className="text-[9px] text-muted-foreground tabular-nums shrink-0">
            {new Date(nowMs).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    </div>
  );
}
