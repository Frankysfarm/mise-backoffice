'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, MapPin, CheckCircle2, ChefHat, Bike, Home } from 'lucide-react';

type OrderPhase = 'bestaetigt' | 'zubereitung' | 'abholung' | 'unterwegs' | 'geliefert';

interface TrackingData {
  order_id: string;
  order_number: string;
  phase: OrderPhase;
  eta_min: number | null;
  zubereitung_start: string | null;
  fahrer_name: string | null;
  fahrer_lat: number | null;
  fahrer_lng: number | null;
  ziel_adresse: string;
  updated_at: string;
}

const MOCK: TrackingData = {
  order_id: 'demo',
  order_number: '#1042',
  phase: 'unterwegs',
  eta_min: 8,
  zubereitung_start: new Date(Date.now() - 12 * 60_000).toISOString(),
  fahrer_name: 'Maria S.',
  fahrer_lat: 50.775,
  fahrer_lng: 6.084,
  ziel_adresse: 'Pontstraße 42, 52062 Aachen',
  updated_at: new Date().toISOString(),
};

const PHASES: { id: OrderPhase; label: string; icon: React.ReactNode }[] = [
  { id: 'bestaetigt', label: 'Bestätigt', icon: <CheckCircle2 className="w-4 h-4" /> },
  { id: 'zubereitung', label: 'Zubereitung', icon: <ChefHat className="w-4 h-4" /> },
  { id: 'abholung', label: 'Abholung', icon: <Bike className="w-4 h-4" /> },
  { id: 'unterwegs', label: 'Unterwegs', icon: <MapPin className="w-4 h-4" /> },
  { id: 'geliefert', label: 'Geliefert', icon: <Home className="w-4 h-4" /> },
];

function phaseIndex(phase: OrderPhase): number {
  return PHASES.findIndex((p) => p.id === phase);
}

interface Props {
  orderId?: string;
  initialData?: TrackingData;
  className?: string;
}

export function BestellEtaLiveTracker({ orderId, initialData, className }: Props) {
  const [data, setData] = useState<TrackingData>(initialData ?? MOCK);
  const [now, setNow] = useState(Date.now());

  // 1-second tick for ETA countdown
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/delivery/tracking/${orderId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* keep current */ }
  }, [orderId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const currentPhaseIdx = phaseIndex(data.phase);
  const isDelivered = data.phase === 'geliefert';

  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${className ?? ''}`}>
      {/* ETA Banner */}
      <div className={`px-4 py-3 ${isDelivered ? 'bg-emerald-50 border-b border-emerald-100' : 'bg-blue-50 border-b border-blue-100'}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] text-gray-500 uppercase tracking-wide font-medium">
              {isDelivered ? 'Geliefert' : 'Voraussichtliche Lieferzeit'}
            </div>
            {isDelivered ? (
              <div className="text-xl font-bold text-emerald-600 flex items-center gap-1.5">
                <CheckCircle2 className="w-5 h-5" />
                Angekommmen!
              </div>
            ) : (
              <div className="text-2xl font-bold text-blue-700 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                {data.eta_min !== null ? `~${data.eta_min} min` : 'Wird berechnet…'}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-[11px] text-gray-400">Bestellung</div>
            <div className="text-sm font-bold text-gray-700">{data.order_number}</div>
          </div>
        </div>
      </div>

      {/* Phase Progress Bar */}
      <div className="px-4 pt-4 pb-2">
        <div className="relative">
          {/* Progress line */}
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-100">
            <div
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${(currentPhaseIdx / (PHASES.length - 1)) * 100}%` }}
            />
          </div>

          {/* Phase dots */}
          <div className="relative flex justify-between">
            {PHASES.map((phase, idx) => {
              const isDone = idx < currentPhaseIdx;
              const isCurrent = idx === currentPhaseIdx;
              const isPending = idx > currentPhaseIdx;

              return (
                <div key={phase.id} className="flex flex-col items-center gap-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 transition-all
                    ${isDone ? 'bg-emerald-500 text-white' :
                      isCurrent ? 'bg-blue-500 text-white shadow-lg shadow-blue-200 scale-110' :
                      isPending ? 'bg-gray-100 text-gray-400' : ''}`}
                  >
                    {isDone ? <CheckCircle2 className="w-4 h-4" /> : phase.icon}
                  </div>
                  <span className={`text-[9px] font-medium leading-none text-center
                    ${isDone ? 'text-emerald-600' : isCurrent ? 'text-blue-600' : 'text-gray-400'}`}>
                    {phase.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Fahrer info */}
      {data.fahrer_name && !isDelivered && (
        <div className="px-4 pt-2 pb-3 flex items-center gap-2 border-t border-gray-50">
          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
            <Bike className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1">
            <div className="text-[10px] text-gray-400">Dein Fahrer</div>
            <div className="text-xs font-semibold text-gray-800">{data.fahrer_name}</div>
          </div>
          <div className="text-[10px] text-gray-400 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {data.ziel_adresse.split(',')[0]}
          </div>
        </div>
      )}

      {/* Updated at */}
      <div className="px-4 pb-2">
        <div className="text-[9px] text-gray-300 text-center">
          Aktualisiert: {new Date(data.updated_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          {' · '} Live-Tracking · 30-Sek-Polling
        </div>
      </div>
    </div>
  );
}
