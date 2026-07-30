'use client';

import { useState, useEffect } from 'react';
import { Clock, MapPin, CheckCircle2, ChefHat, Bike, AlertTriangle, Zap, TrendingDown, Star, Navigation2 } from 'lucide-react';

type OrderPhase = 'bestaetigt' | 'zubereitung' | 'abholung' | 'unterwegs' | 'geliefert';

interface TrackingData {
  order_id: string;
  order_number: string;
  phase: OrderPhase;
  eta_min: number | null;
  eta_sek: number | null;
  eta_confidence: 'hoch' | 'mittel' | 'gering';
  eta_updated_ago_sek: number;
  fahrer_name: string | null;
  fahrer_bewertung: number | null;
  fahrer_distanz_km: number | null;
  fahrer_speed_kmh: number | null;
  ziel_adresse: string;
  updated_at: string;
  verzoegerung_min: number | null;
  kuechen_auslastung: 'normal' | 'hoch' | 'kritisch';
  navi_live_url: string | null;
  error?: string;
}

const MOCK: TrackingData = {
  order_id: 'demo',
  order_number: '#1095',
  phase: 'unterwegs',
  eta_min: 7,
  eta_sek: 430,
  eta_confidence: 'hoch',
  eta_updated_ago_sek: 18,
  fahrer_name: 'Lara M.',
  fahrer_bewertung: 4.8,
  fahrer_distanz_km: 1.1,
  fahrer_speed_kmh: 22,
  ziel_adresse: 'Pontstraße 42, 52062 Aachen',
  updated_at: new Date().toISOString(),
  verzoegerung_min: null,
  kuechen_auslastung: 'normal',
  navi_live_url: null,
};

const PHASES: { id: OrderPhase; label: string; icon: React.ReactNode }[] = [
  { id: 'bestaetigt', label: 'Bestätigt', icon: <CheckCircle2 className="w-4 h-4" /> },
  { id: 'zubereitung', label: 'Zubereitung', icon: <ChefHat className="w-4 h-4" /> },
  { id: 'abholung', label: 'Abholung', icon: <Bike className="w-4 h-4" /> },
  { id: 'unterwegs', label: 'Unterwegs', icon: <Navigation2 className="w-4 h-4" /> },
  { id: 'geliefert', label: 'Geliefert', icon: <MapPin className="w-4 h-4" /> },
];

function phaseIndex(p: OrderPhase): number {
  return PHASES.findIndex(ph => ph.id === p);
}

function confidenceBadge(c: string) {
  if (c === 'hoch') return 'bg-green-900/60 text-green-300';
  if (c === 'mittel') return 'bg-yellow-900/60 text-yellow-300';
  return 'bg-slate-800/60 text-slate-400';
}

function formatSek(sek: number): string {
  if (sek <= 0) return '0:00';
  const m = Math.floor(sek / 60);
  const s = sek % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function BestDynamischeEtaV5({ orderId, locationSlug }: { orderId?: string; locationSlug?: string }) {
  const [data, setData] = useState<TrackingData>(MOCK);
  const [countdown, setCountdown] = useState<number>(MOCK.eta_sek ?? 0);

  useEffect(() => {
    const iv = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!orderId) return;
    const load = async () => {
      try {
        const params = new URLSearchParams();
        params.set('order_id', orderId);
        if (locationSlug) params.set('location_slug', locationSlug);
        const r = await fetch(`/api/delivery/customer/tracking?${params}`);
        if (r.ok) {
          const j: TrackingData = await r.json();
          if (!j.error) { setData(j); setCountdown(j.eta_sek ?? 0); }
        }
      } catch { /* mock */ }
    };
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [orderId, locationSlug]);

  const currentIdx = phaseIndex(data.phase);
  const isDelivered = data.phase === 'geliefert';

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900 overflow-hidden max-w-md mx-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 bg-indigo-950/20 flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-400">Bestellung {data.order_number}</div>
          <div className="text-sm font-semibold text-white truncate">{data.ziel_adresse}</div>
        </div>
        {!isDelivered && data.eta_min !== null && (
          <div className="text-right shrink-0">
            <div className="text-2xl font-bold text-indigo-300 tabular-nums">{data.eta_min} Min</div>
            <div className="text-xs text-slate-500 tabular-nums">{formatSek(countdown)}</div>
          </div>
        )}
        {isDelivered && (
          <div className="flex items-center gap-1.5 text-green-400">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-sm font-bold">Geliefert!</span>
          </div>
        )}
      </div>

      {/* Confidence + delay */}
      <div className="px-4 py-2 border-b border-slate-700/60 flex items-center gap-2">
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${confidenceBadge(data.eta_confidence)}`}>
          ETA {data.eta_confidence === 'hoch' ? 'genau' : data.eta_confidence === 'mittel' ? 'ca.' : 'geschätzt'}
        </span>
        {data.verzoegerung_min !== null && data.verzoegerung_min > 0 && (
          <span className="text-[10px] text-orange-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> +{data.verzoegerung_min} Min Verzögerung
          </span>
        )}
        {data.kuechen_auslastung === 'kritisch' && (
          <span className="text-[10px] text-red-400 flex items-center gap-1">
            <Zap className="w-3 h-3" /> Küche stark ausgelastet
          </span>
        )}
        <span className="ml-auto text-[10px] text-slate-600">aktualisiert vor {data.eta_updated_ago_sek}s</span>
      </div>

      {/* Phase Stepper */}
      <div className="px-4 py-3 border-b border-slate-700/60">
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 right-0 top-4 h-0.5 bg-slate-700 z-0" />
          <div
            className="absolute left-0 top-4 h-0.5 bg-indigo-500 z-0 transition-all"
            style={{ width: `${(currentIdx / (PHASES.length - 1)) * 100}%` }}
          />
          {PHASES.map((ph, i) => {
            const done = i < currentIdx;
            const active = i === currentIdx;
            return (
              <div key={ph.id} className="flex flex-col items-center gap-1 z-10">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                  done ? 'bg-indigo-600 border-indigo-600 text-white'
                    : active ? 'bg-indigo-900 border-indigo-400 text-indigo-300 animate-pulse'
                    : 'bg-slate-800 border-slate-600 text-slate-500'
                }`}>
                  {ph.icon}
                </div>
                <span className={`text-[9px] font-medium ${active ? 'text-indigo-300' : done ? 'text-slate-400' : 'text-slate-600'}`}>
                  {ph.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Driver Info (if unterwegs) */}
      {data.phase === 'unterwegs' && data.fahrer_name && (
        <div className="px-4 py-3 border-b border-slate-700/60 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-900/50 border border-indigo-700 flex items-center justify-center shrink-0">
            <Bike className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">{data.fahrer_name}</span>
              {data.fahrer_bewertung !== null && (
                <div className="flex items-center gap-0.5">
                  <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                  <span className="text-xs text-yellow-400">{data.fahrer_bewertung.toFixed(1)}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-0.5">
              {data.fahrer_distanz_km !== null && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-2.5 h-2.5" /> {data.fahrer_distanz_km.toFixed(1)} km entfernt
                </span>
              )}
              {data.fahrer_speed_kmh !== null && (
                <span className="flex items-center gap-1">
                  <TrendingDown className="w-2.5 h-2.5 text-slate-500" /> {data.fahrer_speed_kmh} km/h
                </span>
              )}
            </div>
          </div>
          {data.navi_live_url && (
            <a
              href={data.navi_live_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 bg-blue-700/60 text-blue-300 rounded-lg font-semibold shrink-0"
            >
              Live-Karte
            </a>
          )}
        </div>
      )}

      {/* Delivery success message */}
      {isDelivered && (
        <div className="px-4 py-4 text-center">
          <div className="text-2xl mb-1">🎉</div>
          <div className="text-sm font-semibold text-green-400 mb-1">Deine Bestellung ist angekommen!</div>
          <div className="text-xs text-slate-400">Guten Appetit — wir freuen uns über deine Bewertung.</div>
        </div>
      )}

      <div className="px-4 py-2 flex justify-between items-center bg-slate-800/20">
        <span className="text-[10px] text-slate-600 flex items-center gap-1.5">
          <Clock className="w-3 h-3" /> 15-Sek-Polling
        </span>
        <span className="text-[10px] text-slate-600">ETA V5</span>
      </div>
    </div>
  );
}
