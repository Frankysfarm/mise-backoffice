'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Clock, ChefHat, Bike, CheckCircle2, MapPin, Package, Loader2, ShoppingBag } from 'lucide-react';

interface Props {
  orderId: string;
  initialStatus: string;
  bestelltAm: string | null;
  etaMin?: number | null;
  etaEarliest?: string | null;
  etaLatest?: string | null;
  driverName?: string | null;
  kundeAdresse?: string | null;
  geschaetzteZubereitungMin?: number | null;
}

type OrderStatus = 'neu' | 'bestätigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert' | 'storniert';

interface Phase {
  key: string;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  doneStatuses: OrderStatus[];
  activeStatuses: OrderStatus[];
}

const PHASES: Phase[] = [
  {
    key: 'bestellt',
    label: 'Bestellt',
    sublabel: 'Bestellung eingegangen',
    icon: ShoppingBag,
    doneStatuses: ['bestätigt', 'in_zubereitung', 'fertig', 'unterwegs', 'geliefert'],
    activeStatuses: ['neu'],
  },
  {
    key: 'kueche',
    label: 'In der Küche',
    sublabel: 'Wird zubereitet',
    icon: ChefHat,
    doneStatuses: ['fertig', 'unterwegs', 'geliefert'],
    activeStatuses: ['bestätigt', 'in_zubereitung'],
  },
  {
    key: 'unterwegs',
    label: 'Unterwegs',
    sublabel: 'Fahrer ist auf dem Weg',
    icon: Bike,
    doneStatuses: ['geliefert'],
    activeStatuses: ['fertig', 'unterwegs'],
  },
  {
    key: 'geliefert',
    label: 'Geliefert!',
    sublabel: 'Guten Appetit 🎉',
    icon: CheckCircle2,
    doneStatuses: ['geliefert'],
    activeStatuses: [],
  },
];

function getPhaseState(phase: Phase, status: OrderStatus): 'done' | 'active' | 'pending' {
  if ((phase.doneStatuses as string[]).includes(status)) return 'done';
  if ((phase.activeStatuses as string[]).includes(status)) return 'active';
  return 'pending';
}

function useOrderStatus(orderId: string, initial: string) {
  const [status, setStatus] = useState<OrderStatus>(initial as OrderStatus);
  const [loading, setLoading] = useState(false);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/order/${orderId}/status`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data?.status) setStatus(data.status as OrderStatus);
      }
    } catch { /* silent */ }
  }, [orderId]);

  useEffect(() => {
    const iv = setInterval(poll, 15_000);
    return () => clearInterval(iv);
  }, [poll]);

  return { status };
}

function EtaCountdown({ isoOrMin, prefix = '' }: { isoOrMin: string | number; prefix?: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  let secs: number;
  if (typeof isoOrMin === 'number') {
    secs = isoOrMin * 60;
  } else {
    secs = Math.round((new Date(isoOrMin).getTime() - Date.now()) / 1000);
  }

  if (secs <= 0) return <span className="font-bold text-matcha-600">In Kürze</span>;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return (
    <span className="font-mono font-black tabular-nums text-matcha-700">
      {prefix}{m}:{String(s).padStart(2, '0')}
    </span>
  );
}

export function BestellungPhase1448LiveEtaTrackingCockpit({
  orderId,
  initialStatus,
  bestelltAm,
  etaMin,
  etaEarliest,
  etaLatest,
  driverName,
  kundeAdresse,
  geschaetzteZubereitungMin,
}: Props) {
  const { status } = useOrderStatus(orderId, initialStatus);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const activePhase = PHASES.find(p => (p.activeStatuses as string[]).includes(status));
  const isDelivered = status === 'geliefert';
  const isCancelled = status === 'storniert';

  if (isCancelled) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center">
        <div className="text-2xl mb-1">😞</div>
        <div className="font-bold text-red-700">Bestellung storniert</div>
        <div className="text-sm text-red-500 mt-1">Diese Bestellung wurde leider storniert.</div>
      </div>
    );
  }

  if (isDelivered) {
    return (
      <div className="rounded-2xl border-2 border-matcha-400 bg-matcha-50 p-5 text-center">
        <div className="text-3xl mb-2">🎉</div>
        <div className="font-display text-xl font-black text-matcha-800 mb-1">Geliefert!</div>
        <div className="text-sm text-matcha-600">Guten Appetit — wir freuen uns auf deine Bewertung!</div>
      </div>
    );
  }

  // Compute elapsed since order
  const elapsedMin = bestelltAm ? Math.floor((now - new Date(bestelltAm).getTime()) / 60_000) : null;
  const totalEstMin = (geschaetzteZubereitungMin ?? 15) + (etaMin ?? 20);
  const progressPct = elapsedMin !== null ? Math.min(100, Math.round((elapsedMin / totalEstMin) * 100)) : 0;

  return (
    <div className="rounded-2xl border border-matcha-200 bg-white overflow-hidden shadow-sm">
      {/* Top progress band */}
      <div className="h-1.5 bg-muted">
        <div
          className="h-full bg-matcha-500 rounded-full transition-all duration-1000"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="p-4">
        {/* Phase steps */}
        <div className="flex items-start justify-between mb-5 relative">
          {/* Connection line */}
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-muted z-0" />
          <div
            className="absolute top-4 left-4 h-0.5 bg-matcha-500 z-0 transition-all duration-700"
            style={{
              width: `${Math.min(100, (PHASES.filter(p => getPhaseState(p, status as OrderStatus) === 'done').length / (PHASES.length - 1)) * 100)}%`,
            }}
          />

          {PHASES.map(phase => {
            const state = getPhaseState(phase, status as OrderStatus);
            const Icon = phase.icon;
            return (
              <div key={phase.key} className="flex flex-col items-center gap-1.5 z-10 relative flex-1">
                <div className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-500',
                  state === 'done' ? 'bg-matcha-500 border-matcha-500 text-white' :
                  state === 'active' ? 'bg-white border-matcha-500 text-matcha-600 shadow-md shadow-matcha-200 animate-pulse' :
                  'bg-white border-muted text-muted-foreground',
                )}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span className={cn(
                  'text-center text-[10px] font-bold leading-tight',
                  state === 'done' ? 'text-matcha-700' :
                  state === 'active' ? 'text-matcha-600' : 'text-muted-foreground',
                )}>
                  {phase.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Current phase info */}
        {activePhase && (
          <div className="rounded-xl bg-matcha-50 border border-matcha-200 p-3 mb-3">
            <div className="flex items-center gap-2 mb-1">
              <activePhase.icon className="h-4 w-4 text-matcha-600 shrink-0" />
              <span className="font-bold text-sm text-matcha-800">{activePhase.sublabel}</span>
              <div className="ml-auto flex items-center gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-matcha-500 animate-pulse" />
                <span className="text-[10px] text-matcha-600 font-bold">Live</span>
              </div>
            </div>

            {/* ETA display */}
            {(etaEarliest || etaLatest || etaMin) && (
              <div className="flex items-center gap-1.5 mt-1">
                <Clock className="h-3.5 w-3.5 text-matcha-500 shrink-0" />
                <span className="text-xs text-matcha-600">Ankunft in </span>
                {etaEarliest ? (
                  <EtaCountdown isoOrMin={etaEarliest} />
                ) : etaMin ? (
                  <EtaCountdown isoOrMin={etaMin} />
                ) : null}
                {etaLatest && etaEarliest && (
                  <>
                    <span className="text-xs text-muted-foreground">–</span>
                    <EtaCountdown isoOrMin={etaLatest} />
                  </>
                )}
              </div>
            )}

            {/* Driver */}
            {driverName && (status === 'unterwegs' || status === 'fertig') && (
              <div className="flex items-center gap-1.5 mt-1">
                <Bike className="h-3.5 w-3.5 text-matcha-500 shrink-0" />
                <span className="text-xs text-matcha-600">Fahrer: <strong>{driverName}</strong></span>
              </div>
            )}
          </div>
        )}

        {/* Address + elapsed */}
        <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
          {kundeAdresse && (
            <div className="flex items-center gap-1 min-w-0">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{kundeAdresse}</span>
            </div>
          )}
          {elapsedMin !== null && (
            <div className="shrink-0 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Warte seit {elapsedMin} Min</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
