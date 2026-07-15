'use client';

import React, { useEffect, useState, useRef } from 'react';

interface Props {
  orderId?: string | null;
  locationId?: string | null;
}

type Phase = 'bestellt' | 'kueche' | 'unterwegs' | 'ankunft' | 'geliefert';

interface EtaState {
  phase: Phase;
  eta_min: number;
  driver_name?: string | null;
  driver_distance_m?: number | null;
  kuechen_auslastung?: 'ruhig' | 'normal' | 'viel';
  last_updated: string;
}

const PHASE_META: Record<Phase, { label: string; icon: string; color: string; bg: string }> = {
  bestellt:  { label: 'Bestellung eingegangen', icon: '📋', color: 'text-blue-700',    bg: 'bg-blue-50'    },
  kueche:    { label: 'Wird zubereitet',        icon: '👨‍🍳', color: 'text-amber-700',   bg: 'bg-amber-50'   },
  unterwegs: { label: 'Unterwegs zu dir',       icon: '🛵', color: 'text-matcha-700',  bg: 'bg-emerald-50' },
  ankunft:   { label: 'Fast da!',               icon: '📍', color: 'text-orange-700',  bg: 'bg-orange-50'  },
  geliefert: { label: 'Geliefert! Guten Appetit', icon: '✅', color: 'text-emerald-700', bg: 'bg-emerald-50' },
};

const PHASES: Phase[] = ['bestellt', 'kueche', 'unterwegs', 'ankunft', 'geliefert'];

export function Phase1631DynamischeEtaLiveUltima({ orderId, locationId }: Props) {
  const [state, setState] = useState<EtaState | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load ETA data
  useEffect(() => {
    if (!orderId && !locationId) return;

    const load = () => {
      const params = new URLSearchParams();
      if (orderId)    params.set('order_id', orderId);
      if (locationId) params.set('location_id', locationId);

      fetch(`/api/delivery/eta/live?${params}`, { cache: 'no-store' })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          if (!d) return;
          setState({
            phase: d.phase ?? 'kueche',
            eta_min: d.eta_min ?? d.remaining_min ?? 0,
            driver_name: d.driver_name ?? null,
            driver_distance_m: d.driver_distance_m ?? null,
            kuechen_auslastung: d.queue_signal === 'low' ? 'ruhig' : d.queue_signal === 'high' ? 'viel' : 'normal',
            last_updated: new Date().toISOString(),
          });
          setCountdown((d.eta_min ?? 0) * 60);
        })
        .catch(() => {});
    };

    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [orderId, locationId]);

  // Countdown tick
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  if (!state) return null;
  if (state.phase === 'geliefert') return null;

  const phaseIdx = PHASES.indexOf(state.phase);
  const meta = PHASE_META[state.phase];
  const etaMin = Math.ceil(countdown / 60);
  const etaDisplay = countdown > 0
    ? `${Math.floor(countdown / 60)}:${(countdown % 60).toString().padStart(2, '0')}`
    : `${state.eta_min} Min`;

  return (
    <div className={`rounded-2xl border-2 border-stone-200 ${meta.bg} overflow-hidden shadow-md mb-4`}>
      {/* Status-Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-2xl">{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-black uppercase tracking-wide ${meta.color}`}>{meta.label}</div>
          {state.driver_name && state.phase === 'unterwegs' && (
            <div className="text-xs text-stone-500 mt-0.5">Fahrer: {state.driver_name}</div>
          )}
          {state.driver_distance_m && state.phase === 'ankunft' && (
            <div className="text-xs text-stone-500 mt-0.5">
              Noch ~{Math.ceil(state.driver_distance_m / 100) * 100} m entfernt
            </div>
          )}
        </div>
        {/* ETA Countdown */}
        {state.phase !== 'geliefert' && (
          <div className={`text-center shrink-0 ${meta.color}`}>
            <div className="text-2xl font-black tabular-nums">{etaDisplay}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">
              {countdown > 0 ? 'verbleibend' : `~${etaMin} Min`}
            </div>
          </div>
        )}
      </div>

      {/* Phasen-Timeline */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-1">
          {PHASES.slice(0, -1).map((p, i) => {
            const done = i < phaseIdx;
            const active = i === phaseIdx;
            const pm = PHASE_META[p];
            return (
              <React.Fragment key={p}>
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div
                    className={`h-7 w-7 rounded-full flex items-center justify-center text-sm border-2 transition-all ${
                      done
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : active
                        ? `${meta.bg} border-current ${meta.color} shadow`
                        : 'bg-white border-stone-200 text-stone-300'
                    }`}
                  >
                    {done ? '✓' : pm.icon}
                  </div>
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wider hidden sm:block ${
                      done ? 'text-emerald-600' : active ? meta.color : 'text-stone-300'
                    }`}
                  >
                    {pm.label.split(' ')[0]}
                  </span>
                </div>
                {i < PHASES.length - 2 && (
                  <div className={`flex-1 h-0.5 mb-4 ${done ? 'bg-emerald-400' : 'bg-stone-200'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Küchen-Auslastung Hinweis */}
      {state.kuechen_auslastung === 'viel' && state.phase === 'kueche' && (
        <div className="px-4 pb-3">
          <div className="rounded-lg bg-amber-100 border border-amber-200 px-3 py-2 text-xs text-amber-800 font-medium">
            🔥 Unsere Küche ist gerade sehr beschäftigt — deine Bestellung wird so schnell wie möglich zubereitet!
          </div>
        </div>
      )}
    </div>
  );
}
