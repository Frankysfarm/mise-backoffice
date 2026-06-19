'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, Bike, CheckCircle2, ChefHat, Package } from 'lucide-react';

type OrderStatus = 'neu' | 'bestätigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert';

interface Props {
  status: OrderStatus | string;
  etaIso: string | null;
  driverName?: string | null;
  className?: string;
}

const STATUS_STEPS = [
  { key: 'bestätigt', label: 'Bestätigt', icon: CheckCircle2 },
  { key: 'in_zubereitung', label: 'Wird zubereitet', icon: ChefHat },
  { key: 'fertig', label: 'Fertig', icon: Package },
  { key: 'unterwegs', label: 'Unterwegs', icon: Bike },
  { key: 'geliefert', label: 'Geliefert', icon: CheckCircle2 },
] as const;

function getStepIndex(status: string): number {
  const idx = STATUS_STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : 0;
}

function CountdownDisplay({ etaIso }: { etaIso: string }) {
  const [secs, setSecs] = useState(() => Math.max(0, Math.floor((new Date(etaIso).getTime() - Date.now()) / 1000)));

  useEffect(() => {
    const iv = setInterval(() => {
      setSecs(Math.max(0, Math.floor((new Date(etaIso).getTime() - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(iv);
  }, [etaIso]);

  const min = Math.floor(secs / 60);
  const sec = secs % 60;
  const isUrgent = secs < 300;
  const isArriving = secs < 60;

  if (secs <= 0) {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className="text-4xl font-black text-matcha-400 animate-pulse">Gleich!</span>
        <span className="text-xs text-muted-foreground">Fahrer ist fast da</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={cn('font-mono font-black tabular-nums', isArriving ? 'text-5xl text-matcha-400 animate-pulse' : isUrgent ? 'text-5xl text-amber-400' : 'text-5xl text-white')}>
        {min}:{String(sec).padStart(2, '0')}
      </div>
      <span className="text-xs text-muted-foreground">Minuten bis zur Lieferung</span>
    </div>
  );
}

function ProgressRing({ pct, size = 96 }: { pct: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={8} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke={pct > 70 ? '#5ba560' : pct > 40 ? '#f59e0b' : '#ef4444'}
        strokeWidth={8}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-1000"
      />
    </svg>
  );
}

export function BestellungEchtzeitCountdown({ status, etaIso, driverName, className }: Props) {
  if (status === 'geliefert') {
    return (
      <div className={cn('rounded-2xl border border-matcha-700/40 bg-matcha-900/30 p-5 text-center', className)}>
        <CheckCircle2 className="h-10 w-10 text-matcha-400 mx-auto mb-2" />
        <div className="text-lg font-black text-white">Geliefert!</div>
        <div className="text-xs text-muted-foreground mt-0.5">Guten Appetit 🍽️</div>
      </div>
    );
  }

  const currentStep = getStepIndex(status);
  const totalSteps = STATUS_STEPS.length;

  const etaMs = etaIso ? new Date(etaIso).getTime() : null;
  const orderMs = etaMs ? etaMs - 40 * 60_000 : null; // assume order placed ~40min before eta
  const totalMs = etaMs && orderMs ? etaMs - orderMs : null;
  const elapsedMs = orderMs ? Date.now() - orderMs : null;
  const progressPct = totalMs && elapsedMs ? Math.min(99, Math.max(5, (elapsedMs / totalMs) * 100)) : (currentStep / totalSteps) * 100;

  return (
    <div className={cn('rounded-2xl border border-border/40 bg-card/80 overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Lieferung Live-Status
        </span>
      </div>

      {/* Main countdown */}
      {etaIso && status === 'unterwegs' && (
        <div className="flex items-center justify-center gap-6 px-6 py-5">
          <div className="relative flex items-center justify-center">
            <ProgressRing pct={progressPct} size={110} />
            <Bike className="absolute h-8 w-8 text-white/80" />
          </div>
          <div className="flex-1">
            <CountdownDisplay etaIso={etaIso} />
            {driverName && (
              <div className="mt-2 text-[11px] text-muted-foreground text-center">
                🛵 {driverName} ist unterwegs
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status bar */}
      {status !== 'unterwegs' && (
        <div className="px-5 py-5 text-center space-y-2">
          {STATUS_STEPS[currentStep] && (
            <>
              {(() => { const Icon = STATUS_STEPS[currentStep].icon; return <Icon className="h-10 w-10 text-matcha-400 mx-auto" />; })()}
              <div className="text-base font-bold text-white">{STATUS_STEPS[currentStep].label}</div>
            </>
          )}
          {etaIso && (
            <div className="text-xs text-muted-foreground">
              Erwartete Lieferung: {new Date(etaIso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
            </div>
          )}
        </div>
      )}

      {/* Step rail */}
      <div className="flex items-center px-4 pb-4 gap-1">
        {STATUS_STEPS.map((step, idx) => {
          const done = idx < currentStep;
          const active = idx === currentStep;
          return (
            <div key={step.key} className="flex items-center gap-1 flex-1">
              <div className={cn(
                'flex-1 h-1 rounded-full transition-all duration-500',
                idx === 0 ? 'hidden' : '',
                done || active ? 'bg-matcha-500' : 'bg-muted',
              )} />
              <div className={cn(
                'h-2 w-2 rounded-full shrink-0 transition-all duration-300',
                done ? 'bg-matcha-500' : active ? 'bg-matcha-400 scale-125 ring-2 ring-matcha-300/40' : 'bg-muted',
              )} />
              {idx < STATUS_STEPS.length - 1 && (
                <div className={cn(
                  'flex-1 h-1 rounded-full transition-all duration-500',
                  done ? 'bg-matcha-500' : 'bg-muted',
                )} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
