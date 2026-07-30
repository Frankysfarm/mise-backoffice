'use client';

import React, { useEffect, useState } from 'react';
import { MapPin, Zap, Bike, AlertTriangle, CheckCircle2, Navigation, Package, Star, TrendingUp } from 'lucide-react';

interface FahrerNaeherung {
  km_entfernung: number;
  eta_min: number;
  geschwindigkeit_kmh: number;
  richtung: string;
  online: boolean;
}

interface EtaPhase {
  phase: 'bestaetigt' | 'kueche' | 'fahrer_unterwegs' | 'nahe' | 'geliefert';
  label: string;
  aktiv: boolean;
  fertig: boolean;
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
  phasen: EtaPhase[];
  alert: string | null;
  verspaetung_min: number | null;
  ki_anpassung: boolean;
}

const MOCK: ApiResponse = {
  order_id: 'o-9922',
  bestellnummer: '#9922',
  eta_min: 8,
  eta_min_max: 12,
  eta_konfidenz_pct: 88,
  eta_delta_min: -3,
  status: 'fahrer_unterwegs',
  alert: null,
  verspaetung_min: null,
  ki_anpassung: true,
  fahrer_name: 'Jonas M.',
  fahrer_bewertung: 4.9,
  fahrer: {
    km_entfernung: 1.8,
    eta_min: 8,
    geschwindigkeit_kmh: 28,
    richtung: 'Nordwest',
    online: true,
  },
  phasen: [
    { phase: 'bestaetigt',       label: 'Bestätigt',    aktiv: false, fertig: true },
    { phase: 'kueche',           label: 'Zubereitung',  aktiv: false, fertig: true },
    { phase: 'fahrer_unterwegs', label: 'Unterwegs',    aktiv: true,  fertig: false },
    { phase: 'nahe',             label: 'Fast da',      aktiv: false, fertig: false },
    { phase: 'geliefert',        label: 'Geliefert',    aktiv: false, fertig: false },
  ],
};

const PHASE_ICONS: Record<string, React.ReactNode> = {
  bestaetigt:       <CheckCircle2 className="w-4 h-4" />,
  kueche:           <Package className="w-4 h-4" />,
  fahrer_unterwegs: <Bike className="w-4 h-4" />,
  nahe:             <MapPin className="w-4 h-4" />,
  geliefert:        <CheckCircle2 className="w-4 h-4" />,
};

const STATUS_COLOR: Record<string, string> = {
  bestaetigt:       'text-blue-400',
  kueche:           'text-amber-400',
  fahrer_unterwegs: 'text-indigo-400',
  nahe:             'text-green-400',
  geliefert:        'text-green-500',
};

export function StorefrontPhase4490DynamischeEtaLiveV9({ orderId }: { orderId?: string }) {
  const [data, setData] = useState<ApiResponse>(MOCK);

  useEffect(() => {
    async function load() {
      try {
        const url = orderId
          ? `/api/order/${orderId}/eta?v=9`
          : '/api/delivery/customer/tracking?v=9';
        const r = await fetch(url, { cache: 'no-store' });
        if (r.ok) setData(await r.json());
      } catch {}
    }
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [orderId]);

  const naeherungPct = data.fahrer
    ? Math.max(0, Math.min(100, Math.round((1 - (data.fahrer.km_entfernung / 5)) * 100)))
    : 0;

  const isGeliefert = data.status === 'geliefert';
  const isNahe = data.status === 'nahe' || (data.fahrer && data.fahrer.km_entfernung < 0.5);

  return (
    <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 space-y-4 text-white">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation className="w-5 h-5 text-indigo-400" />
          <span className="font-bold text-white">Live-Tracking</span>
          <span className="text-xs text-slate-500">{data.bestellnummer}</span>
        </div>
        {data.ki_anpassung && (
          <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-900/20 border border-emerald-700/40 rounded-full px-2 py-0.5">
            <Zap className="w-3 h-3" />KI-angepasst
          </span>
        )}
      </div>

      {/* Alert */}
      {data.alert && (
        <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2 text-xs text-red-300 animate-pulse">
          <AlertTriangle className="w-3 h-3 shrink-0" />{data.alert}
        </div>
      )}

      {/* Verspätung */}
      {data.verspaetung_min !== null && data.verspaetung_min > 0 && (
        <div className="flex items-center gap-2 bg-amber-900/30 border border-amber-700/50 rounded-lg px-3 py-2 text-xs text-amber-300">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          Verspätung: +{data.verspaetung_min} min — wir entschuldigen uns
        </div>
      )}

      {/* ETA Hero */}
      <div className="text-center py-2">
        {isGeliefert ? (
          <div className="flex flex-col items-center gap-2">
            <CheckCircle2 className="w-12 h-12 text-green-400" />
            <span className="text-xl font-bold text-green-300">Geliefert!</span>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center gap-2 mb-1">
              {data.eta_delta_min !== null && data.eta_delta_min < 0 && (
                <span className="text-sm text-green-400 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />{Math.abs(data.eta_delta_min)} min früher
                </span>
              )}
            </div>
            <div className="text-5xl font-bold tabular-nums text-white">{data.eta_min}</div>
            <div className="text-slate-400 text-sm mt-1">
              {data.eta_min_max > data.eta_min ? `bis ${data.eta_min_max} min` : 'Minuten'}
            </div>
            <div className="flex items-center justify-center gap-1 mt-2">
              <div className={`w-2 h-2 rounded-full ${data.eta_konfidenz_pct >= 80 ? 'bg-green-400' : 'bg-yellow-400'}`} />
              <span className="text-xs text-slate-500">{data.eta_konfidenz_pct}% Konfidenz</span>
            </div>
          </>
        )}
      </div>

      {/* Fahrer-Annäherung */}
      {data.fahrer && !isGeliefert && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bike className="w-4 h-4 text-indigo-400" />
              <div>
                <div className="text-sm font-medium text-white">{data.fahrer_name ?? 'Fahrer'}</div>
                {data.fahrer_bewertung !== null && (
                  <div className="flex items-center gap-0.5 text-xs text-yellow-400">
                    <Star className="w-3 h-3" />{data.fahrer_bewertung.toFixed(1)}
                  </div>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-white">{data.fahrer.km_entfernung.toFixed(1)} km</div>
              <div className="text-xs text-slate-500">{data.fahrer.geschwindigkeit_kmh} km/h · {data.fahrer.richtung}</div>
            </div>
          </div>

          {/* Annäherungsbalken */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>Restaurant</span>
              <span>{isNahe ? '🚴 Fast da!' : 'Unterwegs'}</span>
              <span>Du</span>
            </div>
            <div className="relative h-3 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-full transition-all duration-1000"
                style={{ width: `${naeherungPct}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-1000"
                style={{ left: `${naeherungPct}%` }}
              >
                <Bike className="w-4 h-4 text-white" />
              </div>
            </div>
          </div>

          {isNahe && (
            <div className="flex items-center gap-2 bg-green-900/20 border border-green-700/40 rounded-lg px-2 py-1.5 text-xs text-green-300 animate-pulse">
              <MapPin className="w-3 h-3 shrink-0" />
              Fahrer ist fast bei dir! Bitte bereit sein.
            </div>
          )}
        </div>
      )}

      {/* Phasen-Timeline */}
      <div className="flex items-center gap-1">
        {data.phasen.map((phase, i) => (
          <div key={phase.phase} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div className={`p-1.5 rounded-full border transition-all ${
                phase.fertig
                  ? 'bg-green-900/40 border-green-600/60 text-green-400'
                  : phase.aktiv
                  ? 'bg-indigo-900/40 border-indigo-600/60 text-indigo-400 animate-pulse'
                  : 'bg-slate-900/40 border-slate-700/40 text-slate-600'
              }`}>
                {PHASE_ICONS[phase.phase]}
              </div>
              <span className={`text-xs mt-1 text-center leading-tight ${
                phase.fertig ? 'text-green-400' : phase.aktiv ? 'text-indigo-300' : 'text-slate-600'
              }`}>
                {phase.label}
              </span>
            </div>
            {i < data.phasen.length - 1 && (
              <div className={`h-0.5 w-4 mx-1 rounded-full ${phase.fertig ? 'bg-green-600' : 'bg-slate-700'}`} />
            )}
          </div>
        ))}
      </div>

      <div className="text-xs text-slate-600 text-right">30s Polling · KI-ETA · Mock-Fallback</div>
    </div>
  );
}
