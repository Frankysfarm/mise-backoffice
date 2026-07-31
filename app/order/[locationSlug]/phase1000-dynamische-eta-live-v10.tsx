'use client';

import { useEffect, useState } from 'react';
import { Clock, MapPin, CheckCircle2, Bike, AlertTriangle, Cloud, TrendingDown } from 'lucide-react';

// Phase 1000 — Dynamische ETA Live-Tracking V10
// Neu: Fahrer-Tracking-Karte (Stopp-Dot-Sequenz); SLA-Indikator (Pünktlichkeit);
// Wetter-Einfluss-Banner; Liefer-Fortschritts-Phasen; Pünktlichkeits-Badge;
// 20s-Polling; Mock-Fallback

type Phase = 'bestaetigt' | 'zubereitung' | 'bereit' | 'abgeholt' | 'unterwegs' | 'fast_da' | 'geliefert';
type WeatherImpact = 'none' | 'leicht' | 'stark';

interface EtaData {
  order_id: string;
  phase: Phase;
  eta_min: number;
  sla_pct: number;
  pünktlich: boolean;
  fahrer_name: string;
  fahrer_stops_done: number;
  fahrer_stops_total: number;
  wetter_impact: WeatherImpact;
  wetter_zusatz_min: number;
  distanz_km: number;
  prognose_min: number;
  timestamp: string;
}

const MOCK: EtaData = {
  order_id: '#1072',
  phase: 'unterwegs',
  eta_min: 8,
  sla_pct: 91,
  pünktlich: true,
  fahrer_name: 'Tim B.',
  fahrer_stops_done: 1,
  fahrer_stops_total: 3,
  wetter_impact: 'leicht',
  wetter_zusatz_min: 2,
  distanz_km: 3.4,
  prognose_min: 8,
  timestamp: new Date().toISOString(),
};

const PHASES: { key: Phase; label: string; icon: string }[] = [
  { key: 'bestaetigt',  label: 'Bestätigt',   icon: '✓'  },
  { key: 'zubereitung', label: 'Zubereitung', icon: '👨‍🍳' },
  { key: 'bereit',      label: 'Bereit',      icon: '📦'  },
  { key: 'abgeholt',   label: 'Abgeholt',    icon: '🤝'  },
  { key: 'unterwegs',  label: 'Unterwegs',   icon: '🚴'  },
  { key: 'fast_da',    label: 'Fast da!',    icon: '📍'  },
  { key: 'geliefert',  label: 'Geliefert',   icon: '🎉'  },
];

const WEATHER_LABELS: Record<WeatherImpact, string> = {
  none:   '',
  leicht: 'Leichter Regen — +2 Min ETA',
  stark:  'Starker Regen — +5 Min ETA',
};

export function StorefrontPhase1000DynamischeEtaLiveV10({ orderId }: { orderId?: string }) {
  const [data, setData] = useState<EtaData>(MOCK);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/customer/eta?order_id=${orderId ?? MOCK.order_id}`);
        if (r.ok) setData(await r.json());
      } catch { /* mock */ }
    };
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [orderId]);

  const phaseIndex = PHASES.findIndex(p => p.key === data.phase);
  const isDelivered = data.phase === 'geliefert';

  return (
    <div className="bg-gray-950 border border-green-900/40 rounded-2xl p-4 space-y-4 max-w-sm mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bike className="w-5 h-5 text-green-400" />
          <span className="font-semibold text-white text-sm">Live-Tracking {data.order_id}</span>
        </div>
        {data.pünktlich ? (
          <div className="flex items-center gap-1 text-xs text-green-400 bg-green-950/40 border border-green-800/40 px-2 py-1 rounded-full">
            <CheckCircle2 className="w-3 h-3" />
            Pünktlich
          </div>
        ) : (
          <div className="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-950/40 border border-yellow-800/40 px-2 py-1 rounded-full">
            <AlertTriangle className="w-3 h-3" />
            Leichte Verzögerung
          </div>
        )}
      </div>

      {/* ETA-Hero */}
      {!isDelivered ? (
        <div className="bg-green-950/30 border border-green-800/40 rounded-xl p-4 text-center">
          <div className="text-xs text-gray-400 mb-1">Geschätzte Lieferzeit</div>
          <div className="text-5xl font-bold text-green-300">{data.eta_min}</div>
          <div className="text-sm text-gray-400 mt-1">Minuten</div>
          <div className="flex items-center justify-center gap-4 mt-3 text-xs text-gray-500">
            <span><MapPin className="w-3 h-3 inline mr-1" />{data.distanz_km} km</span>
            <span>SLA {data.sla_pct}%</span>
          </div>
        </div>
      ) : (
        <div className="bg-green-950/30 border border-green-700/50 rounded-xl p-4 text-center">
          <div className="text-4xl mb-1">🎉</div>
          <div className="font-bold text-green-300 text-lg">Geliefert!</div>
          <div className="text-xs text-gray-400 mt-1">Guten Appetit!</div>
        </div>
      )}

      {/* Wetter-Banner */}
      {data.wetter_impact !== 'none' && (
        <div className="flex items-center gap-2 bg-blue-950/30 border border-blue-800/40 rounded-lg px-3 py-1.5">
          <Cloud className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="text-xs text-blue-300">{WEATHER_LABELS[data.wetter_impact]}</span>
          <TrendingDown className="w-3 h-3 text-blue-400 ml-auto" />
        </div>
      )}

      {/* Phasen-Leiste */}
      <div className="space-y-1">
        {PHASES.map((p, i) => {
          const done    = i < phaseIndex;
          const active  = i === phaseIndex;
          const future  = i > phaseIndex;
          return (
            <div key={p.key} className={`flex items-center gap-3 py-1.5 px-2 rounded-lg ${active ? 'bg-green-950/30' : ''}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 ${
                done   ? 'bg-green-700 text-white' :
                active ? 'bg-green-500 text-white ring-2 ring-green-400/40' :
                'bg-gray-800 text-gray-500'
              }`}>
                {done ? '✓' : p.icon}
              </div>
              <span className={`text-sm ${
                done   ? 'text-green-400 line-through' :
                active ? 'text-white font-semibold' :
                'text-gray-500'
              }`}>
                {p.label}
              </span>
              {active && !isDelivered && (
                <span className="ml-auto text-xs text-green-400 animate-pulse">●</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Fahrer-Tracker */}
      {!isDelivered && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Bike className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-white">{data.fahrer_name}</span>
            </div>
            <span className="text-xs text-gray-500">
              Stopp {data.fahrer_stops_done + 1}/{data.fahrer_stops_total}
            </span>
          </div>
          {/* Stopp-Dot-Sequenz */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: data.fahrer_stops_total }, (_, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded-full ${
                  i < data.fahrer_stops_done ? 'bg-green-500' :
                  i === data.fahrer_stops_done ? 'bg-blue-400 ring-2 ring-blue-400/40 animate-pulse' :
                  'bg-gray-700'
                }`} />
                {i < data.fahrer_stops_total - 1 && (
                  <div className={`h-0.5 flex-1 ${i < data.fahrer_stops_done ? 'bg-green-600' : 'bg-gray-700'}`} style={{ width: 24 }} />
                )}
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            Du bist Stopp {data.fahrer_stops_done + 1} von {data.fahrer_stops_total}
          </div>
        </div>
      )}

      <div className="text-xs text-gray-600 text-right">
        {new Date(data.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}
