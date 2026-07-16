'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, ChefHat, Clock, Loader2, MapPin, Package } from 'lucide-react';

/**
 * Phase 1871 — Dynamische-ETA-Live-Fortschrittsleiste (Storefront)
 *
 * Schlanke Fortschrittsleiste mit:
 *  - 4 Phasen-Icons (Bestätigt → Küche → Unterwegs → Geliefert)
 *  - Verbindendes Phasen-Band das sich füllt
 *  - Dynamischer ETA-Countdown in der Mitte
 *  - Subtile Puls-Animation wenn Fahrer unterwegs
 * 30-Sek-Polling via /api/delivery/orders/{orderId}/tracking
 */

type Phase = 'bestaetigt' | 'zubereitung' | 'unterwegs' | 'geliefert';

const PHASE_ORDER: Phase[] = ['bestaetigt', 'zubereitung', 'unterwegs', 'geliefert'];

const PHASE_META: Record<Phase, { label: string; icon: React.ElementType }> = {
  bestaetigt: { label: 'Bestätigt', icon: CheckCircle2 },
  zubereitung: { label: 'In Küche', icon: ChefHat },
  unterwegs: { label: 'Unterwegs', icon: Package },
  geliefert: { label: 'Geliefert', icon: MapPin },
};

interface TrackData {
  phase: Phase;
  etaMin: number | null;
  driverNearby: boolean;
}

function statusToPhase(status: string): Phase {
  if (['geliefert', 'delivered', 'completed'].includes(status)) return 'geliefert';
  if (['on_route', 'fahrer_unterwegs', 'out_for_delivery'].includes(status)) return 'unterwegs';
  if (['in_preparation', 'in_zubereitung', 'cooking'].includes(status)) return 'zubereitung';
  return 'bestaetigt';
}

interface Props {
  orderId: string;
  className?: string;
}

export function StorefrontPhase1871DynamischeEtaLiveFortschrittsleiste({ orderId, className }: Props) {
  const [data, setData] = useState<TrackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    try {
      const res = await fetch(`/api/delivery/orders/${orderId}/tracking`);
      if (!res.ok) throw new Error('not ok');
      const json = await res.json();
      const phase = statusToPhase(json.status ?? '');
      setData({
        phase,
        etaMin: json.etaMin ?? json.eta_minutes ?? null,
        driverNearby: json.driverNearby ?? false,
      });
    } catch {
      setData((prev) => prev ?? {
        phase: 'bestaetigt',
        etaMin: 30,
        driverNearby: false,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 30_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [orderId]);

  if (dismissed) return null;
  if (data?.phase === 'geliefert') return null;

  const currentIdx = data ? PHASE_ORDER.indexOf(data.phase) : 0;
  const progressPct = data ? (currentIdx / (PHASE_ORDER.length - 1)) * 100 : 0;

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden px-5 py-4', className)}>
      {loading && !data && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Lade Lieferstatus…</span>
        </div>
      )}

      {data && (
        <>
          {/* ETA center display */}
          <div className="flex items-center justify-between mb-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Live-Lieferstatus
            </div>
            {data.etaMin != null && (
              <div className={cn(
                'flex items-center gap-1.5 rounded-xl px-3 py-1.5',
                data.driverNearby
                  ? 'bg-matcha-100 dark:bg-matcha-900/40 animate-pulse'
                  : 'bg-muted',
              )}>
                <Clock className={cn('h-3.5 w-3.5', data.driverNearby ? 'text-matcha-600' : 'text-muted-foreground')} />
                <span className={cn(
                  'text-sm font-black tabular-nums',
                  data.driverNearby ? 'text-matcha-700 dark:text-matcha-300' : 'text-foreground',
                )}>
                  {data.etaMin} Min
                </span>
                {data.driverNearby && (
                  <span className="text-[9px] font-bold text-matcha-600 uppercase ml-0.5">Gleich da!</span>
                )}
              </div>
            )}
          </div>

          {/* Progress bar with phase icons */}
          <div className="relative">
            {/* Track */}
            <div className="absolute top-4 left-5 right-5 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-matcha-500 rounded-full transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* Phase nodes */}
            <div className="relative flex justify-between">
              {PHASE_ORDER.map((phase, idx) => {
                const meta = PHASE_META[phase];
                const Icon = meta.icon;
                const done = idx < currentIdx;
                const active = idx === currentIdx;
                return (
                  <div key={phase} className="flex flex-col items-center gap-1.5 w-16">
                    <div className={cn(
                      'relative z-10 w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-500',
                      done
                        ? 'bg-matcha-500 border-matcha-500 text-white'
                        : active
                        ? cn(
                            'bg-white dark:bg-card border-matcha-500 text-matcha-600',
                            data.driverNearby && phase === 'unterwegs' ? 'animate-pulse' : '',
                          )
                        : 'bg-muted border-muted-foreground/30 text-muted-foreground',
                    )}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className={cn(
                      'text-[10px] font-bold text-center leading-tight',
                      done ? 'text-matcha-600 dark:text-matcha-400'
                        : active ? 'text-foreground'
                        : 'text-muted-foreground',
                    )}>
                      {meta.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Driver nearby banner */}
          {data.driverNearby && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-matcha-100 dark:bg-matcha-900/30 border border-matcha-200 dark:border-matcha-700 px-4 py-2 animate-pulse">
              <Package className="h-4 w-4 text-matcha-600 shrink-0" />
              <span className="text-xs font-bold text-matcha-700 dark:text-matcha-300">
                Dein Fahrer ist gleich bei dir — bereit machen!
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
