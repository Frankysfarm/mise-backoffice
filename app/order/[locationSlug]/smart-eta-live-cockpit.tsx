'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Bike, CheckCircle2, ChefHat, Clock, MapPin, Navigation, Package, Zap,
} from 'lucide-react';

export type OrderPhase =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'picked_up'
  | 'on_the_way'
  | 'near'
  | 'delivered';

interface Props {
  bestellnummer?: string | null;
  phase?: OrderPhase;
  etaMin?: number | null;
  driverName?: string | null;
  driverDistanceKm?: number | null;
  prepTimeMin?: number | null;
  prepStartedAt?: string | null;
  onRefresh?: () => void;
}

const PHASES: { key: OrderPhase; label: string; icon: React.ReactNode }[] = [
  { key: 'confirmed', label: 'Bestätigt', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  { key: 'preparing', label: 'Zubereitung', icon: <ChefHat className="h-3.5 w-3.5" /> },
  { key: 'on_the_way', label: 'Unterwegs', icon: <Bike className="h-3.5 w-3.5" /> },
  { key: 'delivered', label: 'Geliefert', icon: <Package className="h-3.5 w-3.5" /> },
];

const PHASE_ORDER: Record<OrderPhase, number> = {
  pending: 0,
  confirmed: 1,
  preparing: 2,
  ready: 3,
  picked_up: 3,
  on_the_way: 3,
  near: 3,
  delivered: 4,
};

function PhaseIcon({ phase }: { phase: OrderPhase }) {
  const p = PHASE_ORDER[phase] ?? 0;
  if (p >= 4) return <CheckCircle2 className="h-6 w-6 text-matcha-600" />;
  if (p >= 3) return <Bike className="h-6 w-6 text-saffron animate-bounce" />;
  if (p >= 2) return <ChefHat className="h-6 w-6 text-matcha-600 animate-pulse" />;
  return <Clock className="h-6 w-6 text-stone-400" />;
}

function phaseLabel(p: OrderPhase): string {
  const labels: Record<OrderPhase, string> = {
    pending: 'Wird bearbeitet…',
    confirmed: 'Bestätigt',
    preparing: 'Wird zubereitet',
    ready: 'Fertig — Abholung',
    picked_up: 'Abgeholt',
    on_the_way: 'Unterwegs zu dir',
    near: 'Fast da!',
    delivered: 'Geliefert ✓',
  };
  return labels[p] ?? 'Verarbeitung…';
}

function phaseColor(p: OrderPhase): string {
  if (p === 'delivered') return 'text-matcha-600';
  if (p === 'near') return 'text-red-600';
  if (p === 'on_the_way' || p === 'picked_up') return 'text-saffron';
  if (p === 'preparing' || p === 'ready') return 'text-matcha-600';
  return 'text-stone-500';
}

export function SmartEtaLiveCockpit({
  bestellnummer,
  phase = 'preparing',
  etaMin,
  driverName,
  driverDistanceKm,
  prepTimeMin,
  prepStartedAt,
  onRefresh,
}: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(iv);
  }, []);

  const phaseIdx = PHASE_ORDER[phase] ?? 0;

  let prepProgress = 0;
  if (prepStartedAt && prepTimeMin) {
    const elapsed = (now - new Date(prepStartedAt).getTime()) / 1000 / 60;
    prepProgress = Math.min(1, elapsed / prepTimeMin);
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-stone-200 bg-white shadow-sm">
      {/* ETA Banner */}
      <div
        className={cn(
          'flex items-center justify-between px-5 py-4',
          phase === 'delivered'
            ? 'bg-matcha-600 text-white'
            : phase === 'near'
            ? 'bg-red-50 border-b border-red-100'
            : phase === 'on_the_way' || phase === 'picked_up'
            ? 'bg-saffron/10 border-b border-saffron/20'
            : 'bg-matcha-50 border-b border-matcha-100',
        )}
      >
        <div className="flex items-center gap-3">
          <PhaseIcon phase={phase} />
          <div>
            <div className={cn('text-base font-bold', phase === 'delivered' ? 'text-white' : phaseColor(phase))}>
              {phaseLabel(phase)}
            </div>
            {bestellnummer && (
              <div className={cn('text-xs', phase === 'delivered' ? 'text-white/70' : 'text-stone-500')}>
                Bestellung #{bestellnummer}
              </div>
            )}
          </div>
        </div>

        {etaMin !== null && etaMin !== undefined && phase !== 'delivered' && (
          <div className="text-right">
            <div className="text-2xl font-black tabular-nums text-saffron">{etaMin}'</div>
            <div className="text-[10px] font-bold uppercase text-stone-400">Min ETA</div>
          </div>
        )}
      </div>

      {/* Phase tracker */}
      <div className="px-5 py-4">
        <div className="flex items-center">
          {PHASES.map((p, i) => {
            const done = phaseIdx > i + 1;
            const active = phaseIdx === i + 1;
            const pending = phaseIdx < i + 1;

            return (
              <div key={p.key} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-1 flex-1">
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all',
                      done
                        ? 'border-matcha-500 bg-matcha-500 text-white'
                        : active
                        ? 'border-saffron bg-saffron/10 text-saffron scale-110'
                        : 'border-stone-200 bg-stone-50 text-stone-400',
                    )}
                  >
                    {done ? <CheckCircle2 className="h-4 w-4" /> : p.icon}
                  </div>
                  <span
                    className={cn(
                      'text-[9px] font-bold text-center leading-tight',
                      done ? 'text-matcha-600' : active ? 'text-saffron' : 'text-stone-400',
                    )}
                  >
                    {p.label}
                  </span>
                </div>
                {i < PHASES.length - 1 && (
                  <div
                    className={cn(
                      'h-0.5 flex-1 mb-4 rounded-full transition-colors',
                      done ? 'bg-matcha-400' : 'bg-stone-200',
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Prep progress (during preparation) */}
      {phase === 'preparing' && prepProgress > 0 && (
        <div className="border-t border-stone-100 px-5 py-3">
          <div className="flex items-center justify-between mb-1 text-[10px] font-bold text-stone-400 uppercase tracking-wide">
            <span>Zubereitungs-Fortschritt</span>
            <span>{Math.round(prepProgress * 100)}%</span>
          </div>
          <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-matcha-500 transition-all duration-1000"
              style={{ width: `${prepProgress * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Driver info */}
      {(phase === 'on_the_way' || phase === 'near' || phase === 'picked_up') && (
        <div className="border-t border-stone-100 flex items-center gap-3 px-5 py-3">
          <Bike className="h-4 w-4 text-saffron shrink-0" />
          <div className="text-sm">
            {driverName && <span className="font-semibold text-char">{driverName}</span>}
            {driverDistanceKm !== null && driverDistanceKm !== undefined && (
              <span className="text-stone-500">
                {driverName ? ' · ' : ''}
                <MapPin className="h-3 w-3 inline" /> {driverDistanceKm.toFixed(1)} km entfernt
              </span>
            )}
          </div>
        </div>
      )}

      {/* Delivered state */}
      {phase === 'delivered' && (
        <div className="border-t border-matcha-200 bg-matcha-50 flex items-center justify-center gap-2 px-5 py-4 text-sm font-bold text-matcha-700">
          <CheckCircle2 className="h-5 w-5" />
          Deine Bestellung wurde geliefert. Guten Appetit! 🍽
        </div>
      )}

      {onRefresh && phase !== 'delivered' && (
        <div className="border-t border-stone-100 px-5 py-2.5 text-center">
          <button
            onClick={onRefresh}
            className="text-[11px] font-semibold text-stone-400 hover:text-stone-600 transition"
          >
            Status aktualisieren
          </button>
        </div>
      )}
    </div>
  );
}
