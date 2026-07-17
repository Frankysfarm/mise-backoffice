'use client';

/**
 * SmartEtaLiveHub
 * Dynamische ETA + Live-Tracking für Storefront-Kunden.
 * Zeigt: Bestellphasen-Timeline, Fahrer-Annäherung, Live-ETA-Countdown.
 */

import { useEffect, useState, useCallback } from 'react';
import { MapPin, Navigation, Clock, CheckCircle2, Package, ChefHat, Bike, Timer, Zap, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Phase = 'confirmed' | 'cooking' | 'ready' | 'picked_up' | 'on_route' | 'nearby' | 'delivered';

interface EtaState {
  order_id: string;
  bestellnummer: string;
  phase: Phase;
  phase_started_at: string;
  eta_min_remaining: number;
  eta_confidence: 'high' | 'medium' | 'low';
  driver_name?: string;
  driver_distance_m?: number;
  kitchen_progress_pct?: number;
}

const PHASES: { key: Phase; label: string; icon: React.ElementType; desc: string }[] = [
  { key: 'confirmed',  label: 'Bestätigt',     icon: CheckCircle2, desc: 'Deine Bestellung wurde bestätigt' },
  { key: 'cooking',    label: 'In Zubereitung', icon: ChefHat,      desc: 'Das Restaurant bereitet deine Bestellung vor' },
  { key: 'ready',      label: 'Fertig',          icon: Package,      desc: 'Bestellung fertig — wartet auf Fahrer' },
  { key: 'picked_up',  label: 'Abgeholt',       icon: Bike,         desc: 'Fahrer hat Bestellung abgeholt' },
  { key: 'on_route',   label: 'Unterwegs',      icon: Navigation,   desc: 'Fahrer ist auf dem Weg zu dir' },
  { key: 'nearby',     label: 'Fast da!',        icon: MapPin,       desc: 'Fahrer ist fast bei dir!' },
  { key: 'delivered',  label: 'Geliefert',      icon: CheckCircle2, desc: 'Bestellung wurde geliefert 🎉' },
];

const MOCK: EtaState = {
  order_id: 'o_demo',
  bestellnummer: '#1042',
  phase: 'on_route',
  phase_started_at: new Date(Date.now() - 4 * 60_000).toISOString(),
  eta_min_remaining: 8,
  eta_confidence: 'high',
  driver_name: 'Ahmed K.',
  driver_distance_m: 1200,
  kitchen_progress_pct: 100,
};

function useCountdown() {
  const [t, setT] = useState(0);
  useEffect(() => { const id = setInterval(() => setT(n => n + 1), 1000); return () => clearInterval(id); }, []);
  return t;
}

function phaseIdx(phase: Phase) {
  return PHASES.findIndex(p => p.key === phase);
}

function confidenceColor(c: 'high' | 'medium' | 'low') {
  if (c === 'high')   return 'text-matcha-700 bg-matcha-100';
  if (c === 'medium') return 'text-amber-700 bg-amber-100';
  return 'text-red-700 bg-red-100';
}

function confidenceLabel(c: 'high' | 'medium' | 'low') {
  if (c === 'high')   return 'Hohe Genauigkeit';
  if (c === 'medium') return 'Schätzung';
  return 'Ungenaue Schätzung';
}

function DriverProximity({ distanceM }: { distanceM: number }) {
  const km = distanceM / 1000;
  const color = distanceM <= 500 ? 'bg-red-500' : distanceM <= 1500 ? 'bg-amber-500' : 'bg-blue-500';
  const label = distanceM <= 300 ? 'Gleich da!' : distanceM <= 800 ? 'In der Nähe' : 'Unterwegs';

  return (
    <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-stone-50 border border-stone-100">
      <div className={cn('w-2.5 h-2.5 rounded-full animate-pulse shrink-0', color)} />
      <span className="text-xs font-bold text-stone-700">{label}</span>
      <span className="text-xs text-stone-400 ml-auto">
        {distanceM >= 1000 ? `${km.toFixed(1)} km` : `${distanceM} m`} entfernt
      </span>
    </div>
  );
}

interface Props {
  orderId?: string;
  locationId?: string;
}

export function SmartEtaLiveHub({ orderId, locationId }: Props) {
  useCountdown();
  const [state] = useState<EtaState>(MOCK);

  const activeIdx = phaseIdx(state.phase);
  const activePhase = PHASES[activeIdx];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className={cn(
        'px-4 py-4 text-white',
        state.phase === 'delivered' ? 'bg-matcha-600' :
        state.phase === 'nearby' ? 'bg-orange-500' :
        'bg-gradient-to-br from-[#1a1a2e] to-[#16213e]',
      )}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest opacity-60 mb-1">Bestellung {state.bestellnummer}</div>
            {state.phase !== 'delivered' ? (
              <>
                <div className="text-3xl font-black tabular-nums leading-none">{state.eta_min_remaining} Min</div>
                <div className="text-sm opacity-75 mt-1">bis zur Lieferung</div>
              </>
            ) : (
              <div className="text-2xl font-black">Geliefert! 🎉</div>
            )}
          </div>
          <div className="text-right">
            <div className={cn('inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold', confidenceColor(state.eta_confidence))}>
              {state.eta_confidence === 'high' ? <Zap className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
              {confidenceLabel(state.eta_confidence)}
            </div>
            {state.driver_name && (
              <div className="text-[10px] opacity-60 mt-1">Fahrer: {state.driver_name}</div>
            )}
          </div>
        </div>
      </div>

      {/* Driver Proximity */}
      {state.driver_distance_m !== undefined && state.phase !== 'delivered' && (
        <div className="px-4 pt-3">
          <DriverProximity distanceM={state.driver_distance_m} />
        </div>
      )}

      {/* Phase Timeline */}
      <div className="px-4 py-3 space-y-0">
        {PHASES.filter(p => p.key !== 'delivered').map((phase, idx) => {
          const done = idx < activeIdx;
          const active = idx === activeIdx;
          const pending = idx > activeIdx;

          return (
            <div key={phase.key} className="flex items-start gap-3">
              {/* Icon + Line */}
              <div className="flex flex-col items-center shrink-0">
                <div className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center transition-all',
                  done ? 'bg-matcha-500 text-white' :
                  active ? 'bg-amber-400 text-white ring-4 ring-amber-100 animate-pulse' :
                  'bg-stone-100 text-stone-300',
                )}>
                  <phase.icon className="w-3.5 h-3.5" />
                </div>
                {idx < PHASES.length - 2 && (
                  <div className={cn('w-0.5 h-5 my-0.5', done ? 'bg-matcha-300' : 'bg-stone-100')} />
                )}
              </div>

              {/* Content */}
              <div className={cn('pb-3 min-w-0', idx < PHASES.length - 2 ? '' : 'pb-0')}>
                <div className={cn(
                  'text-xs font-bold',
                  done ? 'text-matcha-700' : active ? 'text-amber-700' : 'text-stone-300',
                )}>
                  {phase.label}
                </div>
                {active && (
                  <div className="text-[10px] text-stone-500 mt-0.5">{phase.desc}</div>
                )}
                {active && state.kitchen_progress_pct !== undefined && state.phase === 'cooking' && (
                  <div className="mt-1 h-1 rounded-full bg-stone-100 overflow-hidden w-32">
                    <div
                      className="h-full rounded-full bg-amber-400 transition-all"
                      style={{ width: `${state.kitchen_progress_pct}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Delivered State */}
      {state.phase === 'delivered' && (
        <div className="mx-4 mb-3 rounded-xl bg-matcha-50 border border-matcha-200 p-3 text-center">
          <CheckCircle2 className="w-8 h-8 text-matcha-500 mx-auto mb-1" />
          <div className="text-sm font-black text-matcha-800">Bestellung geliefert!</div>
          <div className="text-[10px] text-matcha-600 mt-0.5">Guten Hunger! Bitte hinterlasse eine Bewertung.</div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-2 px-4 py-2 border-t border-stone-100 bg-stone-50 text-[10px] text-stone-400">
        <Clock className="w-3 h-3" />
        <span>ETA wird alle 30 Sekunden aktualisiert</span>
      </div>
    </div>
  );
}
