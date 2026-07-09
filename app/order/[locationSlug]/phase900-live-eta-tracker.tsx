'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Bike, CheckCircle2, ChefHat, Clock, MapPin, Package, RefreshCw, Zap,
} from 'lucide-react';

type DeliveryPhase = 'bestellt' | 'bestaetigt' | 'in_zubereitung' | 'bereit' | 'unterwegs' | 'geliefert';

type PhaseInfo = {
  key: DeliveryPhase;
  label: string;
  icon: React.ElementType;
  color: string;
  ringColor: string;
};

const PHASES: PhaseInfo[] = [
  { key: 'bestellt',       label: 'Bestellt',          icon: Package,      color: 'text-muted-foreground', ringColor: '#94a3b8' },
  { key: 'bestaetigt',     label: 'Bestätigt',         icon: CheckCircle2, color: 'text-blue-600',          ringColor: '#3b82f6' },
  { key: 'in_zubereitung', label: 'In Zubereitung',    icon: ChefHat,      color: 'text-orange-600',        ringColor: '#f97316' },
  { key: 'bereit',         label: 'Abholbereit',       icon: Zap,          color: 'text-amber-600',         ringColor: '#f59e0b' },
  { key: 'unterwegs',      label: 'Unterwegs',         icon: Bike,         color: 'text-matcha-600',        ringColor: '#22c55e' },
  { key: 'geliefert',      label: 'Geliefert!',        icon: CheckCircle2, color: 'text-matcha-700',        ringColor: '#16a34a' },
];

function phaseIndex(status: string): number {
  const idx = PHASES.findIndex(p => p.key === status);
  return idx >= 0 ? idx : 0;
}

function CountdownDisplay({ targetMs }: { targetMs: number }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const secsLeft = Math.max(0, Math.floor((targetMs - Date.now()) / 1000));
  const mins = Math.floor(secsLeft / 60);
  const secs = secsLeft % 60;
  const isUrgent = secsLeft > 0 && secsLeft < 120;

  return (
    <div className={cn(
      'font-mono text-3xl font-black tabular-nums leading-none',
      secsLeft === 0 ? 'text-matcha-600' : isUrgent ? 'text-orange-600' : 'text-foreground',
    )}>
      {secsLeft === 0 ? 'Gleich!' : `${mins}:${String(secs).padStart(2, '0')}`}
    </div>
  );
}

export function LiveEtaTracker900({
  orderId,
  orderStatus,
  etaMin,       // expected minutes from now until delivery
  etaEarlyMin,  // optimistic ETA
  etaLateMin,   // pessimistic ETA
  driverName,
  locationName,
}: {
  orderId?: string;
  orderStatus: string;
  etaMin?: number | null;
  etaEarlyMin?: number | null;
  etaLateMin?: number | null;
  driverName?: string | null;
  locationName?: string | null;
}) {
  const [refreshedAt, setRefreshedAt] = useState(Date.now());

  const refresh = useCallback(() => {
    setRefreshedAt(Date.now());
  }, []);

  useEffect(() => {
    const t = setInterval(refresh, 60_000);
    return () => clearInterval(t);
  }, [refresh]);

  const currentPhaseIdx = phaseIndex(orderStatus);
  const isDelivered = orderStatus === 'geliefert';

  // ETA target
  const etaTargetMs = etaMin != null ? Date.now() + etaMin * 60_000 : null;
  const etaEarlyMs  = etaEarlyMin != null ? Date.now() + etaEarlyMin * 60_000 : null;
  const etaLateMs   = etaLateMin != null ? Date.now() + etaLateMin * 60_000 : null;

  const formatTime = (ms: number) =>
    new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      {/* ETA Header */}
      <div className={cn(
        'px-4 py-3 border-b',
        isDelivered ? 'bg-matcha-50' : 'bg-gradient-to-r from-matcha-50 to-emerald-50',
      )}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
              {isDelivered ? 'Erfolgreich geliefert' : 'Voraussichtliche Lieferzeit'}
            </div>
            {isDelivered ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-matcha-600" />
                <span className="text-lg font-black text-matcha-700">Ihre Bestellung ist da!</span>
              </div>
            ) : etaTargetMs ? (
              <div className="space-y-0.5">
                <CountdownDisplay targetMs={etaTargetMs} />
                {etaEarlyMs && etaLateMs && (
                  <div className="text-[11px] text-muted-foreground font-semibold">
                    Fenster: {formatTime(etaEarlyMs)} – {formatTime(etaLateMs)}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-lg font-black text-muted-foreground">Wird berechnet…</div>
            )}
          </div>
          <button
            onClick={refresh}
            className="rounded-full border p-1.5 text-muted-foreground hover:bg-muted transition-colors"
            title="Aktualisieren"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Driver info */}
        {driverName && orderStatus === 'unterwegs' && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
            <Bike className="h-3.5 w-3.5 text-matcha-600 shrink-0" />
            <span><span className="font-bold text-foreground">{driverName}</span> bringt Ihre Bestellung</span>
          </div>
        )}
        {locationName && (
          <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span>{locationName}</span>
          </div>
        )}
      </div>

      {/* Phase progress */}
      <div className="px-4 py-3">
        <div className="relative">
          {/* Connection line */}
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-muted" />
          <div
            className="absolute top-4 left-4 h-0.5 bg-matcha-500 transition-all duration-700"
            style={{ width: `${(currentPhaseIdx / (PHASES.length - 1)) * 100}%`, right: 'auto' }}
          />

          {/* Phase dots */}
          <div className="relative flex items-start justify-between">
            {PHASES.map((phase, idx) => {
              const Icon = phase.icon;
              const isDone = idx < currentPhaseIdx;
              const isCurrent = idx === currentPhaseIdx;
              const isFuture = idx > currentPhaseIdx;

              return (
                <div key={phase.key} className="flex flex-col items-center gap-1.5" style={{ flex: 1 }}>
                  <div className={cn(
                    'relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-500',
                    isDone
                      ? 'border-matcha-500 bg-matcha-500 text-white'
                      : isCurrent
                      ? 'border-matcha-500 bg-white text-matcha-600 shadow-[0_0_10px_rgba(34,197,94,0.4)]'
                      : 'border-muted-foreground/30 bg-background text-muted-foreground/40',
                    isCurrent && 'scale-110',
                  )}>
                    <Icon className="h-3.5 w-3.5" />
                    {isCurrent && (
                      <span className="absolute inset-0 rounded-full border-2 border-matcha-400 animate-ping opacity-60" />
                    )}
                  </div>
                  <span className={cn(
                    'text-[8px] font-bold text-center leading-tight max-w-[48px]',
                    isDone   ? 'text-matcha-600' :
                    isCurrent ? 'text-matcha-700 font-black' :
                               'text-muted-foreground/50',
                  )}>
                    {phase.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ETA bar */}
      {!isDelivered && etaMin != null && (
        <div className="px-4 pb-3">
          <div className="rounded-lg bg-muted/50 px-3 py-2 flex items-center gap-2 text-xs">
            <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Lieferung in</span>
            <span className="font-black text-foreground">ca. {etaMin} Minuten</span>
            {etaMin > 30 && (
              <span className="ml-auto text-[10px] text-muted-foreground">
                {etaTargetMs ? formatTime(etaTargetMs) : ''}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
