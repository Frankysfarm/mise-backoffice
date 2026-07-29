'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, MapPin, CheckCircle2, ChefHat, Bike, Home, AlertTriangle, Zap, TrendingUp } from 'lucide-react';

type OrderPhase = 'bestaetigt' | 'zubereitung' | 'abholung' | 'unterwegs' | 'geliefert';

interface TrackingData {
  order_id: string;
  order_number: string;
  phase: OrderPhase;
  eta_min: number | null;
  eta_confidence: 'hoch' | 'mittel' | 'gering';
  eta_updated_ago_sek: number;
  zubereitung_start: string | null;
  fahrer_name: string | null;
  fahrer_bewertung: number | null;
  ziel_adresse: string;
  updated_at: string;
  verzoegerung_min: number | null;
  surge_aktiv: boolean;
}

const MOCK: TrackingData = {
  order_id: 'demo',
  order_number: '#1062',
  phase: 'unterwegs',
  eta_min: 9,
  eta_confidence: 'hoch',
  eta_updated_ago_sek: 45,
  zubereitung_start: new Date(Date.now() - 14 * 60_000).toISOString(),
  fahrer_name: 'Maria S.',
  fahrer_bewertung: 4.9,
  ziel_adresse: 'Pontstraße 42, 52062 Aachen',
  updated_at: new Date().toISOString(),
  verzoegerung_min: null,
  surge_aktiv: false,
};

const PHASES: { id: OrderPhase; label: string; icon: React.ReactNode }[] = [
  { id: 'bestaetigt', label: 'Bestätigt', icon: <CheckCircle2 className="w-4 h-4" /> },
  { id: 'zubereitung', label: 'Zubereitung', icon: <ChefHat className="w-4 h-4" /> },
  { id: 'abholung', label: 'Abholung', icon: <Bike className="w-4 h-4" /> },
  { id: 'unterwegs', label: 'Unterwegs', icon: <MapPin className="w-4 h-4" /> },
  { id: 'geliefert', label: 'Geliefert', icon: <Home className="w-4 h-4" /> },
];

function phaseIndex(phase: OrderPhase): number {
  return PHASES.findIndex(p => p.id === phase);
}

function confidenceColor(c: string) {
  if (c === 'hoch') return 'text-green-500';
  if (c === 'mittel') return 'text-yellow-500';
  return 'text-red-500';
}

function confidenceLabel(c: string) {
  if (c === 'hoch') return 'Präzise ETA';
  if (c === 'mittel') return 'Ungefähre ETA';
  return 'Unsichere ETA';
}

interface Props {
  orderId?: string;
  initialData?: TrackingData;
  className?: string;
}

export function BestellDynamischeEtaV3({ orderId, initialData, className }: Props) {
  const [data, setData] = useState<TrackingData>(initialData ?? MOCK);
  const [tick, setTick] = useState(0);
  const [etaOffset, setEtaOffset] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setEtaOffset(t => t + 1 / 60);
  }, [tick]);

  const load = useCallback(async () => {
    if (!orderId) return;
    try {
      const r = await fetch(`/api/delivery/tracking/${orderId}`);
      if (r.ok) { const j = await r.json(); if (!j.error) { setData(j); setEtaOffset(0); } }
    } catch { /* keep */ }
  }, [orderId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const currentIdx = phaseIndex(data.phase);
  const isDelivered = data.phase === 'geliefert';
  const etaMin = data.eta_min !== null ? Math.max(0, Math.round(data.eta_min - etaOffset)) : null;

  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${className ?? ''}`}>
      {/* Delay Warning */}
      {data.verzoegerung_min && data.verzoegerung_min > 0 && (
        <div className="px-4 py-2 bg-orange-50 border-b border-orange-100 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-orange-500 shrink-0" />
          <span className="text-xs text-orange-600">Verzögerung: ca. {data.verzoegerung_min} Min länger als üblich</span>
        </div>
      )}

      {/* Surge */}
      {data.surge_aktiv && (
        <div className="px-4 py-2 bg-yellow-50 border-b border-yellow-100 flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
          <span className="text-xs text-yellow-700">Hohe Nachfrage — leicht längere Lieferzeiten möglich</span>
        </div>
      )}

      {/* ETA Hero */}
      {!isDelivered && etaMin !== null && (
        <div className="px-6 py-5 text-center border-b border-gray-100 bg-gradient-to-b from-blue-50/60 to-white">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-gray-500">Ankunft in</span>
          </div>
          <div className="text-5xl font-black text-blue-600 tabular-nums">
            {etaMin}
            <span className="text-2xl ml-1 font-semibold text-blue-400">Min</span>
          </div>
          <div className="mt-2 flex items-center justify-center gap-1.5">
            <TrendingUp className={`w-3 h-3 ${confidenceColor(data.eta_confidence)}`} />
            <span className={`text-xs font-medium ${confidenceColor(data.eta_confidence)}`}>
              {confidenceLabel(data.eta_confidence)}
            </span>
            <span className="text-[10px] text-gray-400">· vor {Math.round(data.eta_updated_ago_sek + tick)}s aktualisiert</span>
          </div>
        </div>
      )}

      {/* Delivered */}
      {isDelivered && (
        <div className="px-6 py-5 text-center border-b border-gray-100 bg-green-50">
          <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
          <div className="text-xl font-bold text-green-700">Geliefert!</div>
          <div className="text-sm text-gray-500 mt-1">{data.ziel_adresse}</div>
        </div>
      )}

      {/* Phase Progress */}
      <div className="px-4 py-4">
        <div className="relative">
          {/* Track line */}
          <div className="absolute top-4 left-5 right-5 h-0.5 bg-gray-200 z-0" />
          <div
            className="absolute top-4 left-5 h-0.5 bg-blue-500 z-0 transition-all duration-500"
            style={{ width: currentIdx === 0 ? '0%' : `${(currentIdx / (PHASES.length - 1)) * (100 - 2)}%` }}
          />
          <div className="relative flex justify-between">
            {PHASES.map((p, i) => {
              const done = i < currentIdx;
              const active = i === currentIdx;
              return (
                <div key={p.id} className="flex flex-col items-center gap-1 z-10">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all
                    ${done ? 'bg-blue-500 border-blue-500 text-white' :
                    active ? 'bg-white border-blue-500 text-blue-500 shadow-md shadow-blue-100' :
                    'bg-white border-gray-200 text-gray-300'}`}>
                    {p.icon}
                  </div>
                  <span className={`text-[10px] font-medium text-center leading-tight max-w-[52px]
                    ${done || active ? 'text-blue-600' : 'text-gray-300'}`}>
                    {p.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="px-4 py-3 border-t border-gray-50 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" /> Ziel
          </span>
          <span className="text-gray-700 font-medium text-xs text-right max-w-[200px] truncate">{data.ziel_adresse}</span>
        </div>
        {data.fahrer_name && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 flex items-center gap-1.5">
              <Bike className="w-3.5 h-3.5" /> Fahrer
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-700 font-medium text-sm">{data.fahrer_name}</span>
              {data.fahrer_bewertung && (
                <span className="text-xs text-yellow-500 font-semibold">★ {data.fahrer_bewertung.toFixed(1)}</span>
              )}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Bestellung</span>
          <span className="text-gray-700 font-semibold text-sm">{data.order_number}</span>
        </div>
      </div>
    </div>
  );
}
