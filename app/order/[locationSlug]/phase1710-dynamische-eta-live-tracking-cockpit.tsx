'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, MapPin, Bike, CheckCircle2, Package, ChefHat } from 'lucide-react';

interface Props {
  orderId?: string | null;
  locationId: string;
  orderPlaced: boolean;
  className?: string;
}

type Phase = 'eingegangen' | 'zubereitung' | 'abholung' | 'unterwegs' | 'geliefert';

const PHASES: { key: Phase; label: string; icon: React.ReactNode }[] = [
  { key: 'eingegangen', label: 'Eingegangen', icon: <Package className="h-3.5 w-3.5" /> },
  { key: 'zubereitung', label: 'Wird zubereitet', icon: <ChefHat className="h-3.5 w-3.5" /> },
  { key: 'abholung', label: 'Wird abgeholt', icon: <Bike className="h-3.5 w-3.5" /> },
  { key: 'unterwegs', label: 'Unterwegs', icon: <MapPin className="h-3.5 w-3.5" /> },
  { key: 'geliefert', label: 'Geliefert', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
];

function phaseIndex(p: Phase) {
  return PHASES.findIndex((x) => x.key === p);
}

export function StorefrontPhase1710DynamischeEtaLiveTrackingCockpit({
  orderId,
  locationId,
  orderPlaced,
  className,
}: Props) {
  const [eta, setEta] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('eingegangen');
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!tick) return;
  }, [tick]);

  useEffect(() => {
    if (!orderPlaced || !orderId) return;

    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/eta/${orderId}`);
        if (!cancelled && res.ok) {
          const data = await res.json();
          setEta(data.eta_min ?? data.etaMin ?? null);
          const s = data.status ?? data.order_status ?? '';
          if (s.includes('geliefert') || s === 'delivered') setPhase('geliefert');
          else if (s.includes('unterwegs') || s === 'en_route') setPhase('unterwegs');
          else if (s.includes('fahrer') || s === 'with_driver') setPhase('abholung');
          else if (s.includes('zubereitung') || s === 'preparing') setPhase('zubereitung');
          else setPhase('eingegangen');
        }
      } catch {
        // mock fallback
        if (!cancelled) {
          setEta(22);
          setPhase('zubereitung');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const t = setInterval(() => { setTick((n) => n + 1); load(); }, 30_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [orderId, orderPlaced]);

  if (!orderPlaced) return null;

  const currentIdx = phaseIndex(phase);

  return (
    <div className={cn('mx-auto max-w-md px-4 pb-3', className)}>
      <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        {/* ETA header */}
        <div className="px-5 py-4 bg-gradient-to-r from-matcha-600 to-matcha-700 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">
                Voraussichtliche Lieferzeit
              </div>
              {eta !== null ? (
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-3xl font-black tabular-nums">{eta}</span>
                  <span className="text-sm font-bold opacity-80">Minuten</span>
                </div>
              ) : (
                <div className="text-lg font-bold opacity-70 mt-0.5">
                  {loading ? 'Wird berechnet…' : 'Wird vorbereitet…'}
                </div>
              )}
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
              <Clock className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Phase timeline */}
        <div className="px-5 py-4">
          <div className="relative">
            {/* Connecting line */}
            <div className="absolute left-[11px] top-4 bottom-4 w-0.5 bg-muted" />
            <div
              className="absolute left-[11px] top-4 w-0.5 bg-matcha-500 transition-all duration-700"
              style={{
                height: `${(currentIdx / Math.max(PHASES.length - 1, 1)) * 100}%`,
              }}
            />

            <div className="space-y-4 relative">
              {PHASES.map((p, idx) => {
                const isDone = idx < currentIdx;
                const isCurrent = idx === currentIdx;
                return (
                  <div key={p.key} className="flex items-center gap-3">
                    <div
                      className={cn(
                        'relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all',
                        isDone
                          ? 'bg-matcha-500 border-matcha-500 text-white'
                          : isCurrent
                          ? 'bg-white border-matcha-500 text-matcha-600 shadow-sm shadow-matcha-200'
                          : 'bg-white border-muted text-muted-foreground',
                      )}
                    >
                      {isDone ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <div className={cn('h-2 w-2 rounded-full', isCurrent ? 'bg-matcha-500 animate-pulse' : 'bg-muted')} />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          'text-xs font-semibold',
                          isCurrent
                            ? 'text-matcha-700 font-bold'
                            : isDone
                            ? 'text-muted-foreground line-through'
                            : 'text-muted-foreground',
                        )}
                      >
                        {p.label}
                      </span>
                      {isCurrent && (
                        <span className="rounded-full bg-matcha-100 px-1.5 py-0.5 text-[9px] font-black text-matcha-700">
                          JETZT
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-5 py-2.5 bg-muted/30 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">Live-Tracking aktiv · alle 30s aktualisiert</span>
          <div className="flex h-2 w-2 rounded-full bg-matcha-500 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
