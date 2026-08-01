'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, Clock, Star, Phone, CheckCircle2, ChefHat, Bike, Package, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 5505 — Dynamische ETA Live-Tracking V17
// V16+: Animated Driver Approach pulsing dot mit Distanz-Fortschritts-Ring SVG;
// Committed ETA mit Konfidenz-Prozent-Ring dual-arc;
// Kunden-Phasen-Kacheln animiert (Bestellt→Zubereitung→Unterwegs→Geliefert);
// Spontanes Bewertungs-CTA nach Lieferung;
// Traffic-Indikator mit Ampelfarbe;
// 1s-Tick + 20s-Polling; Mock-Fallback

type Phase = 'bestellt' | 'zubereitung' | 'unterwegs' | 'geliefert';

interface TrackingState {
  phase: Phase;
  eta_min: number;
  eta_min_low: number;
  eta_min_high: number;
  confidence: number;
  driver_name: string | null;
  driver_phone: string | null;
  driver_distance_m: number | null;
  driver_distance_total_m: number | null;
  traffic: 'leicht' | 'mittel' | 'schwer';
}

const MOCK: TrackingState = {
  phase: 'unterwegs',
  eta_min: 12,
  eta_min_low: 10,
  eta_min_high: 16,
  confidence: 84,
  driver_name: 'Marco S.',
  driver_phone: '+4915112345678',
  driver_distance_m: 1200,
  driver_distance_total_m: 3500,
  traffic: 'mittel',
};

const PHASE_CONFIG: Record<Phase, { label: string; icon: React.ComponentType<{ className?: string }>; step: number }> = {
  bestellt:     { label: 'Bestellt',     icon: Package,      step: 1 },
  zubereitung:  { label: 'Zubereitung',  icon: ChefHat,      step: 2 },
  unterwegs:    { label: 'Unterwegs',    icon: Bike,         step: 3 },
  geliefert:    { label: 'Geliefert',    icon: CheckCircle2, step: 4 },
};

const TRAFFIC_CONFIG: Record<'leicht' | 'mittel' | 'schwer', { label: string; color: string }> = {
  leicht: { label: 'Leicht',  color: 'text-emerald-400' },
  mittel: { label: 'Mittel',  color: 'text-yellow-400' },
  schwer: { label: 'Schwer!', color: 'text-red-400' },
};

function ConfidenceRing({ confidence, etaMin }: { confidence: number; etaMin: number }) {
  const r = 38; const r2 = 28; const circ = 2 * Math.PI * r; const circ2 = 2 * Math.PI * r2;
  const confColor = confidence >= 80 ? '#22c55e' : confidence >= 60 ? '#eab308' : '#ef4444';
  return (
    <div className="relative flex items-center justify-center">
      <svg width="96" height="96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#27272a" strokeWidth="5" />
        <circle cx="48" cy="48" r={r} fill="none" stroke={confColor} strokeWidth="5"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - confidence / 100)}
          strokeLinecap="round" transform="rotate(-90 48 48)" opacity="0.9" />
        <circle cx="48" cy="48" r={r2} fill="none" stroke="#3f3f46" strokeWidth="3" />
        <circle cx="48" cy="48" r={r2} fill="none" stroke="#6366f1" strokeWidth="3"
          strokeDasharray={circ2} strokeDashoffset={circ2 * 0.3}
          strokeLinecap="round" transform="rotate(-90 48 48)" opacity="0.5" />
        <text x="48" y="43" textAnchor="middle" dominantBaseline="central" fontSize="18" fontWeight="bold" fill="white">{etaMin}</text>
        <text x="48" y="57" textAnchor="middle" dominantBaseline="central" fontSize="9" fill="#a1a1aa">min</text>
      </svg>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
        <span style={{ color: confColor }} className="text-[10px] font-semibold">{confidence}%</span>
      </div>
    </div>
  );
}

function DriverApproachRing({ distM, totalM }: { distM: number; totalM: number }) {
  const r = 18; const circ = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, 1 - distM / totalM));
  const kmLeft = (distM / 1000).toFixed(1);
  return (
    <svg width="44" height="44" className="animate-pulse">
      <circle cx="22" cy="22" r={r} fill="none" stroke="#27272a" strokeWidth="3" />
      <circle cx="22" cy="22" r={r} fill="none" stroke="#6366f1" strokeWidth="3"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - frac)}
        strokeLinecap="round" transform="rotate(-90 22 22)" />
      <text x="22" y="22" textAnchor="middle" dominantBaseline="central" fontSize="7" fontWeight="bold" fill="#6366f1">{kmLeft}km</text>
    </svg>
  );
}

interface Props { orderId: string | null }

export function Phase5505DynamischeEtaLiveTrackingV17({ orderId }: Props) {
  const [state, setState] = useState<TrackingState>(MOCK);
  const [tick, setTick] = useState(0);
  const [rated, setRated] = useState(false);
  const [rating, setRating] = useState(0);

  const load = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/delivery/tracking/live?order_id=${orderId}`);
      if (res.ok) {
        const json = await res.json();
        setState(prev => ({ ...prev, ...json }));
      }
    } catch { /* Mock-Fallback */ }
  }, [orderId]);

  useEffect(() => { load(); const iv = setInterval(load, 20_000); return () => clearInterval(iv); }, [load]);
  useEffect(() => { const iv = setInterval(() => setTick(t => t + 1), 1000); return () => clearInterval(iv); }, []);

  const displayEta = Math.max(0, state.eta_min * 60 - tick);
  const etaMinDisplay = Math.floor(displayEta / 60);
  const currentPhase = PHASE_CONFIG[state.phase];
  const trafficCfg = TRAFFIC_CONFIG[state.traffic];

  const PHASES: Phase[] = ['bestellt', 'zubereitung', 'unterwegs', 'geliefert'];

  return (
    <div className="bg-[#1c1c1e] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Live-Tracking</span>
          <span className={cn('text-[10px] font-medium flex items-center gap-1', trafficCfg.color)}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            Verkehr: {trafficCfg.label}
          </span>
        </div>
        <h3 className="text-sm font-semibold text-zinc-100">
          {state.phase === 'geliefert' ? 'Deine Bestellung ist da!' : 'Deine Bestellung ist unterwegs'}
        </h3>
      </div>

      {/* Phase Steps */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-1">
          {PHASES.map((p, i) => {
            const cfg = PHASE_CONFIG[p];
            const Icon = cfg.icon;
            const isActive = cfg.step === currentPhase.step;
            const isDone = cfg.step < currentPhase.step;
            return (
              <div key={p} className="flex items-center gap-1 flex-1">
                <div className={cn('flex-1 flex flex-col items-center gap-0.5', i > 0 ? 'ml-1' : '')}>
                  <div className={cn('w-7 h-7 rounded-full flex items-center justify-center transition-all',
                    isDone ? 'bg-emerald-500' : isActive ? 'bg-indigo-600 ring-2 ring-indigo-400/50 animate-pulse' : 'bg-zinc-800')}>
                    <Icon className={cn('w-3.5 h-3.5', isDone || isActive ? 'text-white' : 'text-zinc-500')} />
                  </div>
                  <span className={cn('text-[8px] text-center leading-tight', isActive ? 'text-indigo-300' : isDone ? 'text-emerald-400' : 'text-zinc-600')}>
                    {cfg.label}
                  </span>
                </div>
                {i < PHASES.length - 1 && (
                  <div className={cn('flex-none w-4 h-0.5 mb-4 rounded-full', isDone ? 'bg-emerald-500' : 'bg-zinc-700')} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main ETA + Driver */}
      {state.phase !== 'geliefert' && (
        <div className="px-4 pb-3 flex items-center gap-4">
          <ConfidenceRing confidence={state.confidence} etaMin={etaMinDisplay} />
          <div className="flex-1 space-y-1.5">
            <div>
              <p className="text-[10px] text-zinc-500">ETA-Bereich</p>
              <p className="text-xs text-zinc-300">{state.eta_min_low}–{state.eta_min_high} Minuten</p>
            </div>
            {state.driver_name && (
              <div className="flex items-center gap-2">
                {state.driver_distance_m != null && state.driver_distance_total_m != null && (
                  <DriverApproachRing distM={state.driver_distance_m} totalM={state.driver_distance_total_m} />
                )}
                <div>
                  <p className="text-xs font-medium text-zinc-100">{state.driver_name}</p>
                  {state.driver_distance_m != null && (
                    <p className="text-[10px] text-zinc-500">{(state.driver_distance_m / 1000).toFixed(1)} km entfernt</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Driver Phone */}
      {state.driver_phone && state.phase === 'unterwegs' && (
        <div className="px-4 pb-3">
          <a href={`tel:${state.driver_phone}`}
            className="flex items-center justify-center gap-2 w-full bg-zinc-800 text-zinc-200 text-xs py-2.5 rounded-xl">
            <Phone className="w-3.5 h-3.5" /> Fahrer anrufen
          </a>
        </div>
      )}

      {/* Delivered: Rating */}
      {state.phase === 'geliefert' && !rated && (
        <div className="px-4 pb-4 space-y-2">
          <div className="flex items-center justify-center gap-1">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-400">Geliefert!</span>
          </div>
          <p className="text-xs text-zinc-400 text-center">Wie war deine Lieferung?</p>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map(s => (
              <button key={s} onClick={() => { setRating(s); setRated(true); }}
                className={cn('w-9 h-9 rounded-full text-lg transition-all', s <= rating ? 'text-yellow-400 scale-110' : 'text-zinc-600 hover:text-yellow-400')}>
                ★
              </button>
            ))}
          </div>
        </div>
      )}

      {state.phase === 'geliefert' && rated && (
        <div className="px-4 pb-4 text-center">
          <p className="text-xs text-zinc-400">Danke für deine Bewertung!</p>
          <div className="flex justify-center mt-1">
            {'★'.repeat(rating).split('').map((_, i) => (
              <span key={i} className="text-yellow-400 text-lg">★</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
