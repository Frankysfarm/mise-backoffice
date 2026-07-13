'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bike, CheckCircle2, ChefHat, Package, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1179 — Echtzeit-Bestellstatus-Karte (Storefront)
// Animierte Schritt-Karte: Bestätigt → Zubereitung → Unterwegs → Geliefert

interface Props {
  orderId: string;
  className?: string;
}

type StepKey = 'bestaetigt' | 'zubereitung' | 'unterwegs' | 'geliefert';

interface StatusData {
  schritt: StepKey;
  eta_min: number | null;
  fahrer_name: string | null;
}

const STEPS: { key: StepKey; label: string; sub: string; icon: React.ComponentType<{ size?: string | number; className?: string }> }[] = [
  { key: 'bestaetigt',  label: 'Bestätigt',   sub: 'Bestellung eingegangen',    icon: Package   },
  { key: 'zubereitung', label: 'Zubereitung',  sub: 'Küche bereitet vor',        icon: ChefHat   },
  { key: 'unterwegs',   label: 'Unterwegs',    sub: 'Fahrer ist auf dem Weg',    icon: Bike      },
  { key: 'geliefert',   label: 'Geliefert',    sub: 'Guten Appetit!',            icon: CheckCircle2 },
];

const STEP_IDX: Record<StepKey, number> = { bestaetigt: 0, zubereitung: 1, unterwegs: 2, geliefert: 3 };

function phaseFromApi(phase: string): StepKey {
  if (phase === 'delivered') return 'geliefert';
  if (phase === 'on_route' || phase === 'pickup') return 'unterwegs';
  if (phase === 'cooking' || phase === 'ready') return 'zubereitung';
  return 'bestaetigt';
}

export function Phase1179BestellstatusKarte({ orderId, className }: Props) {
  const [data, setData] = useState<StatusData>({ schritt: 'bestaetigt', eta_min: null, fahrer_name: null });

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/delivery/public/tracking?order_id=${orderId}`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      setData({
        schritt: phaseFromApi(d.phase ?? 'received'),
        eta_min: d.eta_min ?? d.remaining_min ?? null,
        fahrer_name: d.fahrer_name ?? null,
      });
    } catch {
      // keep current state
    }
  }, [orderId]);

  useEffect(() => { load(); const iv = setInterval(load, 30_000); return () => clearInterval(iv); }, [load]);

  const currentIdx = STEP_IDX[data.schritt];
  const isDone = data.schritt === 'geliefert';

  return (
    <div className={cn('rounded-2xl border border-matcha-200 bg-white overflow-hidden', className)}>
      {/* Top bar */}
      <div className={cn('px-4 py-3 flex items-center gap-3 border-b', isDone ? 'bg-matcha-500' : 'bg-matcha-50 border-matcha-200')}>
        <Truck size={16} className={isDone ? 'text-white' : 'text-matcha-600'} />
        <span className={cn('font-bold text-sm', isDone ? 'text-white' : 'text-matcha-700')}>
          {isDone ? 'Geliefert — Guten Appetit!' : 'Deine Bestellung'}
        </span>
        {data.eta_min !== null && !isDone && (
          <span className="ml-auto rounded-full bg-matcha-600 text-white text-[10px] font-black px-2.5 py-1">
            {data.eta_min} Min
          </span>
        )}
      </div>

      {/* Steps */}
      <div className="px-4 py-4">
        <div className="relative">
          {/* Connector line */}
          <div className="absolute left-5 top-5 bottom-5 w-0.5 bg-muted z-0" />
          <div
            className="absolute left-5 top-5 w-0.5 bg-matcha-500 z-0 transition-all duration-700"
            style={{ height: `calc(${(currentIdx / (STEPS.length - 1)) * 100}% - 0px)` }}
          />

          <div className="space-y-4 relative z-10">
            {STEPS.map((step, idx) => {
              const done = idx < currentIdx;
              const active = idx === currentIdx;
              const upcoming = idx > currentIdx;
              const Icon = step.icon;

              return (
                <div key={step.key} className="flex items-center gap-3">
                  {/* Icon circle */}
                  <div
                    className={cn(
                      'h-10 w-10 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-500',
                      done    ? 'bg-matcha-500 border-matcha-500' :
                      active  ? 'bg-white border-matcha-500 ring-4 ring-matcha-200' :
                                'bg-muted/40 border-muted',
                    )}
                  >
                    <Icon
                      size={18}
                      className={cn(
                        done   ? 'text-white' :
                        active ? 'text-matcha-600' :
                                 'text-muted-foreground',
                        active && 'animate-pulse',
                      )}
                    />
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <div
                      className={cn(
                        'font-bold text-sm',
                        done   ? 'text-matcha-600' :
                        active ? 'text-foreground' :
                                 'text-muted-foreground',
                      )}
                    >
                      {step.label}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {active && step.key === 'unterwegs' && data.fahrer_name
                        ? `${data.fahrer_name} ist auf dem Weg`
                        : active && step.key === 'unterwegs' && data.eta_min !== null
                        ? `Noch ca. ${data.eta_min} Min`
                        : step.sub}
                    </div>
                  </div>

                  {/* Status badge */}
                  {done && (
                    <span className="text-[9px] font-bold text-matcha-600 bg-matcha-100 rounded-full px-2 py-0.5 shrink-0">
                      ✓ Erledigt
                    </span>
                  )}
                  {active && !isDone && (
                    <span className="text-[9px] font-bold text-white bg-matcha-500 rounded-full px-2 py-0.5 shrink-0 animate-pulse">
                      Aktiv
                    </span>
                  )}
                  {upcoming && (
                    <span className="text-[9px] text-muted-foreground shrink-0">Ausstehend</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
