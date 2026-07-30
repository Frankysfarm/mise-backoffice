'use client';

import React, { useEffect, useState } from 'react';
import { MapPin, Zap, Bike, AlertTriangle, CheckCircle2, Navigation, Package, Star, TrendingUp, Clock, RefreshCw, ChefHat } from 'lucide-react';

interface FahrerNaeherung {
  km_entfernung: number;
  eta_min: number;
  geschwindigkeit_kmh: number;
  richtung: string;
  online: boolean;
  lat: number;
  lng: number;
}

interface EtaPhase {
  phase: 'bestaetigt' | 'kueche' | 'fahrer_unterwegs' | 'nahe' | 'geliefert';
  label: string;
  icon: string;
  aktiv: boolean;
  fertig: boolean;
  dauer_min: number | null;
}

interface ApiResponse {
  order_id: string;
  bestellnummer: string;
  eta_min: number;
  eta_min_max: number;
  eta_konfidenz_pct: number;
  eta_delta_min: number | null;
  status: 'bestaetigt' | 'kueche' | 'fahrer_unterwegs' | 'nahe' | 'geliefert';
  fahrer: FahrerNaeherung | null;
  fahrer_name: string | null;
  fahrer_bewertung: number | null;
  fahrer_touren_heute: number;
  phasen: EtaPhase[];
  alert: string | null;
  verspaetung_min: number | null;
  ki_anpassung: boolean;
  wetter_warnung: string | null;
}

const MOCK: ApiResponse = {
  order_id: 'o-2024-001',
  bestellnummer: '#9923',
  eta_min: 7,
  eta_min_max: 11,
  eta_konfidenz_pct: 91,
  eta_delta_min: -4,
  status: 'fahrer_unterwegs',
  alert: null,
  verspaetung_min: null,
  ki_anpassung: true,
  wetter_warnung: null,
  fahrer_name: 'Jonas M.',
  fahrer_bewertung: 4.9,
  fahrer_touren_heute: 12,
  fahrer: {
    km_entfernung: 1.6,
    eta_min: 7,
    geschwindigkeit_kmh: 24,
    richtung: 'Nordwest',
    online: true,
    lat: 50.7753,
    lng: 6.0838,
  },
  phasen: [
    { phase: 'bestaetigt',     label: 'Bestätigt',    icon: '✅', aktiv: false, fertig: true,  dauer_min: 1 },
    { phase: 'kueche',         label: 'Zubereitung',  icon: '👨‍🍳', aktiv: false, fertig: true,  dauer_min: 14 },
    { phase: 'fahrer_unterwegs', label: 'Unterwegs',  icon: '🚴', aktiv: true,  fertig: false, dauer_min: null },
    { phase: 'nahe',           label: 'Fast da',      icon: '📍', aktiv: false, fertig: false, dauer_min: null },
    { phase: 'geliefert',      label: 'Geliefert',    icon: '🎉', aktiv: false, fertig: false, dauer_min: null },
  ],
};

interface Props {
  orderId: string;
  locationSlug: string;
}

export function StorefrontPhase4495DynamischeEtaLiveV10({ orderId, locationSlug }: Props) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  const load = async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/customer/tracking?order_id=${orderId}&slug=${locationSlug}`);
      if (r.ok) { const j = await r.json(); if (!j.error) setData(j); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const pollId = setInterval(load, 20_000);
    const tickId = setInterval(() => setTick(t => t + 1), 1000);
    return () => { clearInterval(pollId); clearInterval(tickId); };
  }, [orderId]);

  const isGeliefert = data.status === 'geliefert';

  const statusColor = isGeliefert
    ? 'from-green-600 to-emerald-600'
    : data.verspaetung_min
    ? 'from-red-700 to-orange-700'
    : 'from-matcha-800 to-matcha-700';

  return (
    <div className="rounded-2xl overflow-hidden shadow-lg border border-white/10">

      {/* Hero ETA Header */}
      <div className={`bg-gradient-to-br ${statusColor} px-5 py-5`}>
        {/* Status Line */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-white/80">Bestellung {data.bestellnummer}</span>
          <div className="flex items-center gap-1.5">
            {loading && <RefreshCw size={12} className="text-white/60 animate-spin" />}
            {data.ki_anpassung && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 text-white/80 flex items-center gap-1">
                <Zap size={9} /> KI-ETA
              </span>
            )}
          </div>
        </div>

        {/* Main ETA Display */}
        {isGeliefert ? (
          <div className="text-center py-2">
            <div className="text-5xl mb-2">🎉</div>
            <div className="text-2xl font-bold text-white">Geliefert!</div>
            <div className="text-sm text-white/70 mt-1">Guten Appetit!</div>
          </div>
        ) : (
          <div>
            <div className="text-center mb-1">
              <span className="text-[11px] text-white/60 uppercase tracking-wider">Ankunft in</span>
            </div>
            <div className="flex items-end justify-center gap-2">
              <span className="text-6xl font-bold text-white leading-none">{data.eta_min}</span>
              <div className="text-left pb-2">
                <div className="text-lg font-semibold text-white/80">– {data.eta_min_max}</div>
                <div className="text-sm text-white/60">Minuten</div>
              </div>
            </div>

            {/* Delta */}
            {data.eta_delta_min !== null && (
              <div className={`flex items-center justify-center gap-1 mt-2 text-sm ${data.eta_delta_min < 0 ? 'text-green-300' : 'text-red-300'}`}>
                <TrendingUp size={14} />
                {data.eta_delta_min < 0 ? `${Math.abs(data.eta_delta_min)} Min früher als erwartet` : `${data.eta_delta_min} Min später`}
              </div>
            )}

            {/* Confidence */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-[10px] text-white/50 mb-1">
                <span>KI-Konfidenz</span>
                <span>{data.eta_konfidenz_pct}%</span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-1">
                <div
                  className="h-1 rounded-full bg-white/80 transition-all"
                  style={{ width: `${data.eta_konfidenz_pct}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Alert */}
      {data.alert && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border-b border-red-200">
          <AlertTriangle size={14} className="text-red-500 shrink-0" />
          <span className="text-xs text-red-700">{data.alert}</span>
        </div>
      )}

      {/* Wetter-Warnung */}
      {data.wetter_warnung && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border-b border-amber-200">
          <span className="text-sm">🌧</span>
          <span className="text-xs text-amber-700">{data.wetter_warnung}</span>
        </div>
      )}

      <div className="bg-white px-5 py-4 space-y-4">
        {/* Phase Timeline */}
        <div className="flex items-center gap-0">
          {data.phasen.map((p, i) => (
            <React.Fragment key={p.phase}>
              <div className="flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  p.fertig ? 'bg-green-100 text-green-700' :
                  p.aktiv  ? 'bg-blue-500 text-white shadow-md shadow-blue-200' :
                  'bg-gray-100 text-gray-400'
                }`}>
                  {p.fertig ? '✓' : p.icon}
                </div>
                <span className={`text-[9px] text-center leading-tight max-w-[52px] ${
                  p.aktiv ? 'text-blue-600 font-medium' :
                  p.fertig ? 'text-green-600' : 'text-gray-400'
                }`}>
                  {p.label}
                  {p.dauer_min && <><br/><span className="text-[8px] text-gray-400">{p.dauer_min}m</span></>}
                </span>
              </div>
              {i < data.phasen.length - 1 && (
                <div className={`flex-1 h-0.5 mb-4 ${
                  data.phasen[i + 1]?.fertig || data.phasen[i + 1]?.aktiv ? 'bg-blue-300' : 'bg-gray-200'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Fahrer Info */}
        {data.fahrer && data.fahrer_name && (
          <div className="bg-gray-50 rounded-xl p-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-matcha-800 flex items-center justify-center text-white font-bold text-sm">
                {data.fahrer_name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-800">{data.fahrer_name}</span>
                  {data.fahrer_bewertung && (
                    <div className="flex items-center gap-0.5">
                      <Star size={11} className="text-yellow-500 fill-yellow-500" />
                      <span className="text-xs font-medium text-gray-600">{data.fahrer_bewertung}</span>
                    </div>
                  )}
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  <Bike size={10} className="inline mr-1" />
                  {data.fahrer.km_entfernung} km entfernt · {data.fahrer.geschwindigkeit_kmh} km/h
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold text-blue-600">{data.fahrer.eta_min} Min</div>
                <div className="text-[10px] text-gray-400">{data.fahrer.richtung}</div>
              </div>
            </div>

            {/* Driver Progress Bar */}
            <div className="mt-3">
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-blue-500 transition-all"
                  style={{ width: `${Math.max(5, 100 - (data.fahrer.km_entfernung / 5) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
                <span>Restaurant</span>
                <span>Du</span>
              </div>
            </div>
          </div>
        )}

        {/* Verspaetung Warning */}
        {data.verspaetung_min && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-orange-50 border border-orange-200">
            <AlertTriangle size={14} className="text-orange-500 shrink-0" />
            <span className="text-xs text-orange-700">
              Deine Bestellung ist ca. {data.verspaetung_min} Min verspätet. Wir entschuldigen uns!
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
