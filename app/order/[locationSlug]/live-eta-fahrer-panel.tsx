'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, ChefHat, CheckCircle2, Clock, MapPin, Package, Loader2 } from 'lucide-react';

export type OrderPhase =
  | 'bestätigt'
  | 'in_zubereitung'
  | 'fertig'
  | 'abgeholt'
  | 'unterwegs'
  | 'geliefert';

interface Props {
  orderId?: string | null;
  phase?: OrderPhase;
  etaMin?: number | null;
  driverName?: string | null;
  progressPct?: number; // 0–100
  onRefresh?: () => void;
}

const PHASES: { key: OrderPhase; label: string; icon: typeof ChefHat }[] = [
  { key: 'bestätigt',     label: 'Bestätigt',    icon: CheckCircle2 },
  { key: 'in_zubereitung',label: 'In Zubereitung', icon: ChefHat },
  { key: 'fertig',        label: 'Fertig',        icon: Package },
  { key: 'unterwegs',     label: 'Unterwegs',     icon: Bike },
  { key: 'geliefert',     label: 'Geliefert',     icon: MapPin },
];

const PHASE_ORDER: OrderPhase[] = ['bestätigt', 'in_zubereitung', 'fertig', 'abgeholt', 'unterwegs', 'geliefert'];

function phaseIndex(phase: OrderPhase): number {
  return PHASE_ORDER.indexOf(phase);
}

function fmtEta(min: number | null | undefined): string {
  if (min === null || min === undefined) return '--';
  if (min <= 0) return 'Gleich da!';
  if (min < 2) return '< 2 Min';
  return `~${Math.round(min)} Min`;
}

export function LiveEtaFahrerPanel({ orderId, phase = 'bestätigt', etaMin, driverName, progressPct = 0, onRefresh }: Props) {
  const [tick, setTick] = useState(0);
  const [localEta, setLocalEta] = useState(etaMin);

  // Count down every minute
  useEffect(() => {
    setLocalEta(etaMin);
  }, [etaMin]);

  useEffect(() => {
    const iv = setInterval(() => {
      setTick(t => t + 1);
      setLocalEta(prev => (prev !== null && prev !== undefined && prev > 0 ? prev - 1 : prev));
    }, 60_000);
    return () => clearInterval(iv);
  }, []);

  const currentIdx = phaseIndex(phase);
  const isDelivered = phase === 'geliefert';

  const displayedPhases = PHASES.filter(p => p.key !== 'abgeholt'); // skip internal 'abgeholt'

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Top: ETA + Phase */}
      <div className={cn(
        'flex items-center gap-3 px-5 py-4',
        isDelivered ? 'bg-matcha-600' : 'bg-foreground',
      )}>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-widest text-white/60">
            {isDelivered ? 'Zugestellt' : 'Lieferzeit'}
          </div>
          <div className="text-3xl font-black tabular-nums text-white leading-none mt-0.5">
            {isDelivered ? '✓' : fmtEta(localEta)}
          </div>
          {driverName && !isDelivered && (
            <div className="text-[11px] text-white/70 mt-1 flex items-center gap-1">
              <Bike size={11} /> {driverName} ist unterwegs
            </div>
          )}
        </div>

        {/* Progress ring */}
        <div className="relative w-16 h-16 shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="27" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="5" />
            <circle
              cx="32" cy="32" r="27" fill="none"
              stroke={isDelivered ? '#fff' : '#86efac'}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 27}`}
              strokeDashoffset={`${2 * Math.PI * 27 * (1 - (isDelivered ? 1 : progressPct / 100))}`}
              style={{ transition: 'stroke-dashoffset 1s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-black text-white tabular-nums">
              {isDelivered ? '100%' : `${Math.round(progressPct)}%`}
            </span>
          </div>
        </div>
      </div>

      {/* Phase timeline */}
      <div className="px-5 py-4">
        <div className="relative flex items-start">
          {/* Track line */}
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-muted" />
          <div
            className="absolute top-4 left-4 h-0.5 bg-matcha-500 transition-all duration-700"
            style={{ width: `${Math.min(100, currentIdx / (displayedPhases.length - 1) * 100)}%` }}
          />

          {/* Steps */}
          <div className="relative w-full flex justify-between">
            {displayedPhases.map((p, i) => {
              const pIdx = phaseIndex(p.key);
              const isDone = pIdx < currentIdx || isDelivered;
              const isCurr = pIdx === currentIdx && !isDelivered;
              const Icon = p.icon;

              return (
                <div key={p.key} className="flex flex-col items-center gap-1.5">
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all z-10',
                    isDone ? 'bg-matcha-500 border-matcha-500' :
                    isCurr ? 'bg-card border-matcha-500' :
                    'bg-card border-muted',
                  )}>
                    {isDone
                      ? <CheckCircle2 size={14} className="text-white" />
                      : <Icon size={13} className={isCurr ? 'text-matcha-600' : 'text-muted-foreground'} />
                    }
                  </div>
                  <span className={cn(
                    'text-[9px] font-bold text-center leading-tight max-w-[46px]',
                    isCurr ? 'text-matcha-700' : isDone ? 'text-muted-foreground' : 'text-muted-foreground/60',
                  )}>
                    {p.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Refresh hint */}
      {onRefresh && !isDelivered && (
        <button
          onClick={onRefresh}
          className="w-full flex items-center justify-center gap-1.5 py-2 border-t text-[10px] text-muted-foreground hover:bg-muted/30 transition"
        >
          <Loader2 size={10} /> Aktualisieren
        </button>
      )}
    </div>
  );
}
