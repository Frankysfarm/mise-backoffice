'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, MapPin, CheckCircle2, Bike, ChefHat, Package, Loader2, Zap, Star } from 'lucide-react';

type OrderStatus =
  | 'neu' | 'bestätigt' | 'in_zubereitung' | 'fertig'
  | 'pickup' | 'unterwegs' | 'geliefert' | 'storniert';

type TrackingPhase = {
  key: OrderStatus | string;
  label: string;
  icon: React.ElementType;
  doneStatuses: string[];
};

const PHASES: TrackingPhase[] = [
  { key: 'bestätigt',      label: 'Bestätigt',      icon: CheckCircle2, doneStatuses: ['bestätigt', 'in_zubereitung', 'fertig', 'pickup', 'unterwegs', 'geliefert'] },
  { key: 'in_zubereitung', label: 'Zubereitung',     icon: ChefHat,      doneStatuses: ['in_zubereitung', 'fertig', 'pickup', 'unterwegs', 'geliefert'] },
  { key: 'pickup',         label: 'Unterwegs',       icon: Bike,         doneStatuses: ['pickup', 'unterwegs', 'geliefert'] },
  { key: 'geliefert',      label: 'Geliefert',       icon: Package,      doneStatuses: ['geliefert'] },
];

function formatCountdown(targetIso: string): string {
  const diffMs = new Date(targetIso).getTime() - Date.now();
  if (diffMs <= 0) return 'gleich';
  const totalSec = Math.round(diffMs / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min >= 60) return `${Math.floor(min / 60)}h ${min % 60}m`;
  if (min > 0) return `${min} Min ${sec}s`;
  return `${sec}s`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function EtaRing({ pct, urgent }: { pct: number; urgent: boolean }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width="88" height="88" viewBox="0 0 88 88">
      <circle cx="44" cy="44" r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-border" />
      <circle
        cx="44" cy="44" r={r} fill="none"
        stroke={urgent ? '#ef4444' : '#3d7a4f'}
        strokeWidth="5" strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset={circ / 4}
        transform="rotate(-90 44 44)"
        style={{ transition: 'stroke-dasharray 1s ease' }}
      />
    </svg>
  );
}

export function StorefrontPhase694LiveEtaTracking({
  orderId,
  status,
  etaEarliest,
  etaLatest,
  driverName,
}: {
  orderId: string;
  status: string;
  etaEarliest?: string | null;
  etaLatest?: string | null;
  driverName?: string | null;
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (status === 'storniert' || status === 'neu') return null;

  const etaMs = etaLatest ? new Date(etaLatest).getTime() : etaEarliest ? new Date(etaEarliest).getTime() : null;
  const nowMs = Date.now();
  const totalWindowMs = etaMs ? etaMs - (etaEarliest ? new Date(etaEarliest).getTime() : etaMs - 30 * 60_000) : null;
  const usedMs = etaEarliest ? nowMs - new Date(etaEarliest).getTime() : null;
  const pct = totalWindowMs && usedMs !== null
    ? Math.min(100, Math.max(0, (usedMs / totalWindowMs) * 100))
    : 50;

  const urgent = etaMs !== null && etaMs - nowMs < 5 * 60_000;
  const countdown = etaLatest ? formatCountdown(etaLatest) : etaEarliest ? formatCountdown(etaEarliest) : null;

  const currentPhaseIndex = PHASES.findIndex(p => p.doneStatuses.includes(status) && !PHASES.slice(PHASES.indexOf(p) + 1).some(pp => pp.doneStatuses.includes(status)));
  const activePhaseIndex = PHASES.findIndex(p => {
    const nextPhase = PHASES[PHASES.indexOf(p) + 1];
    return p.doneStatuses.includes(status) && (!nextPhase || !nextPhase.doneStatuses.includes(status));
  });

  const isDelivered = status === 'geliefert';

  return (
    <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
      {/* ETA Header */}
      <div className={cn(
        'px-5 py-4 flex items-center gap-4',
        isDelivered ? 'bg-matcha-50' : 'bg-card',
      )}>
        {isDelivered ? (
          <>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-matcha-100">
              <CheckCircle2 className="h-7 w-7 text-matcha-600" />
            </div>
            <div>
              <div className="text-base font-black text-matcha-700">Geliefert!</div>
              <div className="text-sm text-muted-foreground">Deine Bestellung ist angekommen.</div>
            </div>
          </>
        ) : (
          <>
            <div className="relative shrink-0">
              <EtaRing pct={pct} urgent={urgent} />
              {urgent ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Zap className="h-4 w-4 text-red-500" />
                  <span className="text-[9px] font-bold text-red-500">gleich</span>
                </div>
              ) : countdown ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-sm font-black tabular-nums leading-tight">{countdown}</span>
                  <span className="text-[8px] text-muted-foreground">verbleibend</span>
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                Voraussichtliche Lieferzeit
              </div>
              {etaEarliest && etaLatest ? (
                <div className="text-base font-black">
                  {formatTime(etaEarliest)} – {formatTime(etaLatest)} Uhr
                </div>
              ) : etaEarliest ? (
                <div className="text-base font-black">{formatTime(etaEarliest)} Uhr</div>
              ) : (
                <div className="text-sm text-muted-foreground">Wird berechnet…</div>
              )}
              {driverName && ['pickup', 'unterwegs'].includes(status) && (
                <div className="text-[11px] text-matcha-700 font-semibold mt-0.5 flex items-center gap-1">
                  <Bike className="h-3 w-3" /> {driverName} ist unterwegs
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Phase Timeline */}
      {!isDelivered && (
        <div className="border-t px-5 py-4">
          <div className="flex items-start justify-between gap-1">
            {PHASES.map((phase, i) => {
              const isDone = phase.doneStatuses.includes(status) &&
                (i < PHASES.length - 1 ? PHASES[i + 1].doneStatuses.includes(status) : status === 'geliefert');
              const isActive = phase.doneStatuses.includes(status) && !isDone;
              const isUpcoming = !phase.doneStatuses.includes(status);
              const Icon = phase.icon;

              return (
                <div key={phase.key} className="flex flex-col items-center gap-1 flex-1">
                  {/* Circle */}
                  <div className={cn(
                    'h-8 w-8 rounded-full border-2 flex items-center justify-center transition-all',
                    isDone ? 'bg-matcha-500 border-matcha-600' :
                    isActive ? 'bg-foreground border-foreground animate-pulse' :
                    'bg-muted border-muted-foreground/20',
                  )}>
                    <Icon className={cn(
                      'h-3.5 w-3.5',
                      isDone || isActive ? 'text-white' : 'text-muted-foreground',
                    )} />
                  </div>

                  {/* Connector */}
                  {i < PHASES.length - 1 && (
                    <div className="absolute" />
                  )}

                  <span className={cn(
                    'text-[9px] text-center font-semibold leading-tight',
                    isDone ? 'text-matcha-600' :
                    isActive ? 'text-foreground font-bold' :
                    'text-muted-foreground',
                  )}>
                    {phase.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Connection line behind circles */}
          <div className="relative -mt-[3.25rem] flex items-center px-4 mb-8 pointer-events-none">
            {PHASES.slice(0, -1).map((phase, i) => {
              const isDone = PHASES[i + 1].doneStatuses.includes(status);
              return (
                <div key={i} className={cn(
                  'flex-1 h-0.5 rounded-full transition-all',
                  isDone ? 'bg-matcha-500' : 'bg-border',
                )} />
              );
            })}
          </div>
        </div>
      )}

      {/* Live indicator */}
      {!isDelivered && (
        <div className="border-t px-5 py-2.5 flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-matcha-500 animate-pulse" />
          <span className="text-[10px] text-muted-foreground">Live-Tracking aktiv</span>
          {etaLatest && urgent && (
            <span className="ml-auto text-[10px] font-bold text-red-500">Fahrer fast da!</span>
          )}
        </div>
      )}
    </div>
  );
}
