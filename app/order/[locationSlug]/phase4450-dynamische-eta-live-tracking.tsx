'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, MapPin, CheckCircle2, ChefHat, Bike, Package, AlertTriangle, Navigation, TrendingUp } from 'lucide-react';

type BestellPhase = 'bestaetigt' | 'in_zubereitung' | 'bereit' | 'unterwegs' | 'angekommen' | 'geliefert';

interface EtaData {
  order_id: string;
  bestellnummer: string;
  phase: BestellPhase;
  eta_min: number | null;
  eta_min_min: number | null;
  eta_min_max: number | null;
  fahrer_name: string | null;
  fahrer_km_entfernung: number | null;
  prep_fortschritt_pct: number;
  status_text: string;
  verzoegert: boolean;
  verzoegerung_min: number | null;
}

interface Props {
  orderId: string;
  locationSlug: string;
}

const MOCK: EtaData = {
  order_id: 'order-demo',
  bestellnummer: '0099',
  phase: 'unterwegs',
  eta_min: 8,
  eta_min_min: 6,
  eta_min_max: 11,
  fahrer_name: 'Marco R.',
  fahrer_km_entfernung: 1.4,
  prep_fortschritt_pct: 100,
  status_text: 'Deine Bestellung ist unterwegs!',
  verzoegert: false,
  verzoegerung_min: null,
};

const PHASEN: { key: BestellPhase; icon: React.ReactNode; label: string }[] = [
  { key: 'bestaetigt',    icon: <CheckCircle2 className="w-4 h-4" />, label: 'Bestätigt'  },
  { key: 'in_zubereitung', icon: <ChefHat className="w-4 h-4" />,     label: 'Küche'      },
  { key: 'bereit',        icon: <Package className="w-4 h-4" />,      label: 'Fertig'     },
  { key: 'unterwegs',    icon: <Bike className="w-4 h-4" />,          label: 'Unterwegs'  },
  { key: 'geliefert',    icon: <CheckCircle2 className="w-4 h-4" />, label: 'Geliefert' },
];

const PHASE_ORDER: Record<BestellPhase, number> = {
  bestaetigt: 0, in_zubereitung: 1, bereit: 2, unterwegs: 3, angekommen: 3, geliefert: 4,
};

export function Phase4450DynamischeEtaLiveTracking({ orderId, locationSlug }: Props) {
  const [data, setData] = useState<EtaData>(MOCK);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(false);

  void locationSlug;

  const load = useCallback(async () => {
    if (!orderId || orderId === 'order-demo') return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/kitchen/queue/${orderId}`);
      if (res.ok) { const j = await res.json(); if (!j.error && j.eta_min !== undefined) setData(j); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [orderId]);

  useEffect(() => { load(); const id = setInterval(load, 15_000); return () => clearInterval(id); }, [load]);
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 1_000); return () => clearInterval(id); }, []);

  void tick;

  const currentPhaseIdx = PHASE_ORDER[data.phase] ?? 0;
  const isGeliefert = data.phase === 'geliefert';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-4 space-y-4 max-w-sm mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Bestellung #{data.bestellnummer}</p>
          <p className="text-sm font-bold text-gray-900">{data.status_text}</p>
        </div>
        {loading && <span className="w-2.5 h-2.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
      </div>

      {/* ETA-Ring */}
      {!isGeliefert && data.eta_min !== null && (
        <div className="flex items-center justify-center">
          <div className="relative flex flex-col items-center justify-center w-28 h-28 rounded-full bg-indigo-50 border-4 border-indigo-200 shadow-inner">
            <p className="text-3xl font-black text-indigo-700 leading-none">{data.eta_min}</p>
            <p className="text-[10px] text-indigo-500 font-semibold">Minuten</p>
            {data.eta_min_min !== null && data.eta_min_max !== null && (
              <p className="text-[8px] text-gray-400 mt-0.5">{data.eta_min_min}–{data.eta_min_max} min</p>
            )}
          </div>
        </div>
      )}

      {isGeliefert && (
        <div className="flex flex-col items-center justify-center py-4">
          <CheckCircle2 className="w-12 h-12 text-green-500 mb-2" />
          <p className="text-base font-bold text-gray-900">Guten Appetit!</p>
          <p className="text-xs text-gray-500">Deine Bestellung wurde geliefert.</p>
        </div>
      )}

      {/* Phasen-Timeline */}
      <div className="flex items-center justify-between">
        {PHASEN.map((p, i) => {
          const done = currentPhaseIdx > i;
          const active = currentPhaseIdx === i;
          return (
            <div key={p.key} className="flex flex-col items-center gap-1 flex-1">
              {/* Connector */}
              <div className="flex items-center w-full">
                {i > 0 && (
                  <div className={`h-0.5 flex-1 ${done || active ? 'bg-indigo-400' : 'bg-gray-200'} transition-all`} />
                )}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all
                  ${done ? 'bg-green-500 text-white' : active ? 'bg-indigo-600 text-white ring-2 ring-indigo-300 ring-offset-1 animate-pulse' : 'bg-gray-100 text-gray-400'}`}>
                  {p.icon}
                </div>
                {i < PHASEN.length - 1 && (
                  <div className={`h-0.5 flex-1 ${done ? 'bg-indigo-400' : 'bg-gray-200'} transition-all`} />
                )}
              </div>
              <p className={`text-[8px] font-medium text-center leading-tight ${active ? 'text-indigo-600 font-bold' : done ? 'text-green-600' : 'text-gray-400'}`}>
                {p.label}
              </p>
            </div>
          );
        })}
      </div>

      {/* Fahrer-Info */}
      {data.fahrer_name && !isGeliefert && (
        <div className="flex items-center gap-2.5 rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-2.5">
          <div className="w-8 h-8 rounded-full bg-indigo-200 flex items-center justify-center flex-shrink-0">
            <Bike className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-gray-900">{data.fahrer_name}</p>
            {data.fahrer_km_entfernung !== null && (
              <p className="text-[10px] text-gray-500 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-indigo-400" />
                {data.fahrer_km_entfernung.toFixed(1)} km entfernt
              </p>
            )}
          </div>
          <Navigation className="w-4 h-4 text-indigo-400" />
        </div>
      )}

      {/* Prep-Fortschritt (wenn in Küche) */}
      {(data.phase === 'in_zubereitung' || data.phase === 'bestaetigt') && (
        <div>
          <div className="flex justify-between text-[9px] text-gray-500 mb-1">
            <span className="flex items-center gap-1"><ChefHat className="w-3 h-3" />Zubereitung</span>
            <span>{data.prep_fortschritt_pct}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-700"
              style={{ width: `${data.prep_fortschritt_pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Verzögerungs-Alert */}
      {data.verzoegert && data.verzoegerung_min !== null && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <p className="text-[10px] text-amber-700">
            Kleine Verzögerung von ca. <span className="font-bold">{data.verzoegerung_min} min</span>. Entschuldige!
          </p>
        </div>
      )}

      {/* Qualitäts-Chip */}
      {!isGeliefert && (
        <div className="flex items-center gap-1 text-[9px] text-gray-400 justify-center">
          <TrendingUp className="w-3 h-3" />
          <span>Live-ETA wird alle 15 Sek. aktualisiert</span>
        </div>
      )}
    </div>
  );
}
