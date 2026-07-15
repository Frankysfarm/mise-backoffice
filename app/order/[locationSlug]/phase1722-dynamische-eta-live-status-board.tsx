'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, ChefHat, Bike, MapPin, CheckCircle2 } from 'lucide-react';

/**
 * Phase 1722 — Dynamische-ETA-Live-Status-Board (Storefront)
 *
 * 4-Phasen-Timeline nach Bestelleingang:
 * Angenommen → In Zubereitung → Unterwegs → Geliefert
 * ETA-Countdown mit 30s-Polling. Hydration-safe.
 */

type Phase = 'accepted' | 'preparing' | 'on_route' | 'delivered';

interface Props {
  locationId: string;
  orderPlaced: boolean;
  orderId?: string | null;
  className?: string;
}

const PHASES: { key: Phase; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { key: 'accepted',  label: 'Angenommen',    Icon: ({ className }) => <CheckCircle2 className={className} /> },
  { key: 'preparing', label: 'Zubereitung',   Icon: ({ className }) => <ChefHat className={className} /> },
  { key: 'on_route',  label: 'Unterwegs',     Icon: ({ className }) => <Bike className={className} /> },
  { key: 'delivered', label: 'Geliefert',     Icon: ({ className }) => <MapPin className={className} /> },
];

const STATUS_TO_PHASE: Record<string, Phase> = {
  accepted: 'accepted', confirmed: 'accepted', bestätigt: 'accepted', angenommen: 'accepted',
  preparing: 'preparing', in_progress: 'preparing', in_zubereitung: 'preparing',
  on_route: 'on_route', unterwegs: 'on_route', dispatched: 'on_route',
  delivered: 'delivered', geliefert: 'delivered',
};

function formatEta(sec: number): string {
  if (sec <= 0) return 'gleich';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  return `${m} Min ${s > 0 ? s + 's' : ''}`.trim();
}

export function StorefrontPhase1722DynamischeEtaLiveStatusBoard({
  locationId,
  orderPlaced,
  orderId,
  className,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>('accepted');
  const [etaSec, setEtaSec] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { setMounted(true); }, []);

  // Countdown tick every second
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setEtaSec(s => (s !== null && s > 0 ? s - 1 : s));
    }, 1_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Poll order status every 30s
  useEffect(() => {
    if (!orderPlaced || !orderId) return;

    async function poll() {
      try {
        const res = await fetch(`/api/delivery/tracking?orderId=${orderId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data?.status && STATUS_TO_PHASE[data.status]) {
          setPhase(STATUS_TO_PHASE[data.status]);
        }
        if (data?.eta_sec != null) setEtaSec(data.eta_sec);
      } catch {
        // silent fail — mock fallback below
      }
    }

    poll();
    pollRef.current = setInterval(poll, 30_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [orderPlaced, orderId, tick]);

  // Mock fallback progression when no real order
  useEffect(() => {
    if (orderPlaced && !orderId) {
      setPhase('accepted');
      setEtaSec(35 * 60);
      const t1 = setTimeout(() => { setPhase('preparing'); setEtaSec(28 * 60); }, 30_000);
      const t2 = setTimeout(() => { setPhase('on_route'); setEtaSec(12 * 60); }, 90_000);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [orderPlaced, orderId]);

  if (!mounted || !orderPlaced) return null;

  const currentPhaseIdx = PHASES.findIndex(p => p.key === phase);

  return (
    <div className={cn('rounded-xl border border-matcha-200 dark:border-matcha-800 bg-white dark:bg-black/20 overflow-hidden', className)}>
      {/* ETA header */}
      <div className="flex items-center gap-2 bg-matcha-500 px-4 py-3">
        <Clock className="h-4 w-4 text-white shrink-0" />
        <span className="text-sm font-black text-white">
          {phase === 'delivered'
            ? 'Bestellung geliefert!'
            : etaSec !== null
            ? `ETA: ${formatEta(etaSec)}`
            : 'Deine Bestellung ist unterwegs'}
        </span>
        {etaSec !== null && phase !== 'delivered' && (
          <span className="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white tabular-nums">
            {formatEta(etaSec)}
          </span>
        )}
      </div>

      {/* Phase timeline */}
      <div className="flex items-start gap-0 px-4 py-4">
        {PHASES.map((p, idx) => {
          const done = idx < currentPhaseIdx;
          const active = idx === currentPhaseIdx;
          const upcoming = idx > currentPhaseIdx;

          return (
            <div key={p.key} className="flex flex-1 flex-col items-center">
              {/* Icon */}
              <div className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-500',
                done    && 'border-matcha-500 bg-matcha-500 text-white',
                active  && 'border-matcha-500 bg-white dark:bg-black/30 text-matcha-500 ring-2 ring-matcha-300 dark:ring-matcha-700 ring-offset-1',
                upcoming && 'border-muted bg-muted/30 text-muted-foreground',
              )}>
                {done
                  ? <CheckCircle2 className="h-4 w-4 text-white" />
                  : <p.Icon className="h-4 w-4" />
                }
              </div>

              {/* Connector line */}
              {idx < PHASES.length - 1 && (
                <div className="absolute" style={{ display: 'none' }} />
              )}

              {/* Label */}
              <div className={cn(
                'mt-1.5 text-center text-[9px] font-bold leading-tight',
                done    && 'text-matcha-600 dark:text-matcha-400',
                active  && 'text-matcha-700 dark:text-matcha-300',
                upcoming && 'text-muted-foreground',
              )}>
                {p.label}
              </div>

              {active && (
                <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-matcha-500 animate-pulse" />
              )}
            </div>
          );
        })}
      </div>

      {/* Connector lines between icons */}
      <div className="relative -mt-16 mb-4 flex items-start px-8">
        {PHASES.slice(0, -1).map((p, idx) => {
          const done = idx < currentPhaseIdx;
          return (
            <div key={p.key} className="flex-1 flex items-center justify-center mt-[18px]">
              <div className={cn(
                'h-0.5 w-full',
                done ? 'bg-matcha-500' : 'bg-muted',
              )} />
            </div>
          );
        })}
      </div>

      {/* Status detail */}
      <div className="px-4 pb-3 -mt-2">
        {phase === 'accepted' && (
          <p className="text-xs text-center text-muted-foreground">Deine Bestellung wurde angenommen</p>
        )}
        {phase === 'preparing' && (
          <p className="text-xs text-center text-muted-foreground">Die Küche bereitet deine Bestellung vor</p>
        )}
        {phase === 'on_route' && (
          <p className="text-xs text-center text-muted-foreground">Dein Fahrer ist auf dem Weg zu dir</p>
        )}
        {phase === 'delivered' && (
          <p className="text-xs text-center text-matcha-600 dark:text-matcha-400 font-bold">
            Guten Appetit!
          </p>
        )}
      </div>
    </div>
  );
}
