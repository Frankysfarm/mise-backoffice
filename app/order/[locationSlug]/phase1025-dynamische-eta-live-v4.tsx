'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, ChefHat, Bike, MapPin, CheckCircle2, AlertTriangle, Package } from 'lucide-react';

type Phase = 'bestellung_eingegangen' | 'in_zubereitung' | 'fahrer_abholung' | 'unterwegs' | 'zugestellt';

interface TrackingData {
  phase: Phase;
  eta_min: number | null;
  eta_sec_remaining: number | null;
  kuechen_fortschritt_pct: number;
  fahrer_name: string | null;
  fahrer_entfernung_min: number | null;
  verzoegerung: boolean;
  verzoegerung_min: number | null;
  zustellzeit_iso: string | null;
}

const MOCK: TrackingData = {
  phase: 'unterwegs',
  eta_min: 12,
  eta_sec_remaining: 720,
  kuechen_fortschritt_pct: 100,
  fahrer_name: 'Max M.',
  fahrer_entfernung_min: 8,
  verzoegerung: false,
  verzoegerung_min: null,
  zustellzeit_iso: null,
};

const PHASES: { id: Phase; label: string; icon: React.ReactNode }[] = [
  { id: 'bestellung_eingegangen', label: 'Eingegangen',   icon: <Package className="w-3.5 h-3.5" /> },
  { id: 'in_zubereitung',         label: 'Zubereitung',   icon: <ChefHat className="w-3.5 h-3.5" /> },
  { id: 'fahrer_abholung',        label: 'Abholung',      icon: <Bike className="w-3.5 h-3.5" /> },
  { id: 'unterwegs',              label: 'Unterwegs',     icon: <Bike className="w-3.5 h-3.5" /> },
  { id: 'zugestellt',             label: 'Zugestellt',    icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
];

const PHASE_ORDER: Phase[] = [
  'bestellung_eingegangen',
  'in_zubereitung',
  'fahrer_abholung',
  'unterwegs',
  'zugestellt',
];

function phaseIdx(p: Phase) { return PHASE_ORDER.indexOf(p); }

function fmtSec(sec: number): string {
  if (sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface Props {
  orderId: string;
  locationId: string;
}

export function StorefrontPhase1025DynamischeEtaLiveV4({ orderId, locationId }: Props) {
  const [data, setData] = useState<TrackingData>(MOCK);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!orderId || !locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/customer/tracking?order_id=${orderId}&location_id=${locationId}`);
      if (r.ok) { const j = await r.json(); if (!j.error) setData(j); }
    } catch { /* Mock-Fallback */ }
    finally { setLoading(false); }
  }, [orderId, locationId]);

  useEffect(() => { load(); const iv = setInterval(load, 20_000); return () => clearInterval(iv); }, [load]);
  useEffect(() => { const iv = setInterval(() => setTick((t) => t + 1), 1_000); return () => clearInterval(iv); }, []);

  const currentIdx = phaseIdx(data.phase);
  const isDone = data.phase === 'zugestellt';
  const secLeft = data.eta_sec_remaining != null ? Math.max(0, data.eta_sec_remaining - tick) : null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mx-4 mb-4">

      {/* Hero ETA */}
      <div className={`px-4 py-3 text-center ${isDone ? 'bg-green-500' : data.verzoegerung ? 'bg-amber-500' : 'bg-[#F4C430]'}`}>
        {isDone ? (
          <>
            <CheckCircle2 className="w-6 h-6 text-white mx-auto mb-1" />
            <p className="text-sm font-bold text-white">Zugestellt!</p>
          </>
        ) : (
          <>
            <p className="text-[10px] font-bold text-white/70 uppercase tracking-wide mb-0.5">
              {data.verzoegerung ? 'Verzögert — noch ca.' : 'Ankunft in ca.'}
            </p>
            <p className="text-3xl font-black text-white tabular-nums leading-none">
              {secLeft != null ? fmtSec(secLeft) : data.eta_min != null ? `${data.eta_min}m` : '—'}
            </p>
            {data.verzoegerung && data.verzoegerung_min != null && (
              <p className="text-[9px] text-white/80 mt-0.5 flex items-center justify-center gap-0.5">
                <AlertTriangle className="w-3 h-3" />+{data.verzoegerung_min}m Verzögerung
              </p>
            )}
            {data.fahrer_name && (
              <p className="text-[10px] text-white/80 mt-0.5">
                Fahrer: <span className="font-bold">{data.fahrer_name}</span>
                {data.fahrer_entfernung_min != null && ` · ${data.fahrer_entfernung_min}m entfernt`}
              </p>
            )}
          </>
        )}
        {loading && (
          <span className="absolute top-2 right-2 w-2 h-2 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {/* Phase Timeline */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          {PHASES.map((phase, i) => {
            const done = i < currentIdx;
            const active = i === currentIdx;
            const isLast = i === PHASES.length - 1;

            return (
              <div key={phase.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                    done ? 'bg-green-500 text-white' :
                    active ? 'bg-[#F4C430] text-white shadow-sm ring-2 ring-[#F4C430]/30' :
                    'bg-gray-100 text-gray-400'
                  }`}>
                    {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : phase.icon}
                  </div>
                  <span className={`text-[8px] font-medium text-center leading-tight ${active ? 'text-gray-900 font-bold' : done ? 'text-green-600' : 'text-gray-400'}`}>
                    {phase.label}
                  </span>
                </div>
                {!isLast && (
                  <div className={`flex-1 h-0.5 mx-1 rounded-full ${done || (active && i < PHASES.length - 1) ? 'bg-green-300' : 'bg-gray-100'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Kitchen progress bar */}
      {(data.phase === 'bestellung_eingegangen' || data.phase === 'in_zubereitung') && (
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between text-[9px] text-gray-500 mb-1">
            <span className="flex items-center gap-0.5"><ChefHat className="w-3 h-3 text-orange-400" />Küchen-Fortschritt</span>
            <span className="font-bold">{data.kuechen_fortschritt_pct}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-400 rounded-full transition-all duration-1000"
              style={{ width: `${data.kuechen_fortschritt_pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Fahrer unterwegs info */}
      {(data.phase === 'unterwegs' || data.phase === 'fahrer_abholung') && data.fahrer_entfernung_min != null && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 bg-blue-50 rounded-xl px-3 py-2">
            <Bike className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-[10px] font-semibold text-blue-800">
                {data.fahrer_name ?? 'Fahrer'} ist {data.fahrer_entfernung_min}m von dir entfernt
              </p>
              <div className="h-1 bg-blue-100 rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-blue-400 rounded-full transition-all"
                  style={{ width: `${Math.max(10, 100 - (data.fahrer_entfernung_min / Math.max(1, data.eta_min ?? 30)) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 pb-2 flex items-center justify-between text-[8px] text-gray-400">
        <span className="flex items-center gap-0.5"><Clock className="w-2 h-2" />Live-Tracking · 20s</span>
        {data.verzoegerung && <span className="text-amber-500 font-medium">Verzögerung gemeldet</span>}
      </div>
    </div>
  );
}
