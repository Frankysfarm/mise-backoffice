'use client';

import { useEffect, useState } from 'react';
import {
  Trophy, Route, Clock, AlertTriangle, TrendingUp, TrendingDown,
  MapPin, Zap, CheckCircle2, ChevronDown, ChevronRight, Euro,
} from 'lucide-react';

// Phase 5306 — Score + Tour-Visualisierung V29
// Neu: Zonen-Heatmap-Overlay; Warte-Prognose je Stopp; Effizienz-Delta;
// Stopp-Status-Chips farbkodiert; ETA-Abweichungs-Ampel; 20s-Polling; Mock-Fallback

type DriverTier = 'platin' | 'gold' | 'gut' | 'schwach';
type StopStatus = 'ausstehend' | 'unterwegs' | 'angekommen' | 'abgeliefert';
type DelayRisk  = 'low' | 'medium' | 'high';
type ZoneHealth = 'ok' | 'warn' | 'critical';

interface TourStop {
  id: string;
  reihenfolge: number;
  adresse: string;
  status: StopStatus;
  eta_min: number | null;
  betrag: number | null;
  delay_risk: DelayRisk;
  warte_prognose_min: number | null;
}

interface DriverRow {
  id: string;
  name: string;
  score: number;
  score_delta: number;
  route_effizienz: number;
  tier: DriverTier;
  delay_risiko: boolean;
  stops_done: number;
  stops_total: number;
  eta_abweichung_min: number;
  stops: TourStop[];
  zone: string;
  umsatz: number;
}

interface ZoneItem {
  name: string;
  health: ZoneHealth;
  fahrer: number;
  avg_min: number;
  sla_pct: number;
}

interface ApiResponse {
  fleet_score: number;
  fleet_score_delta: number;
  aktiv: number;
  risiko: number;
  route_effizienz_avg: number;
  umsatz: number;
  drivers: DriverRow[];
  zonen: ZoneItem[];
  timestamp: string;
}

const MOCK: ApiResponse = {
  fleet_score: 83,
  fleet_score_delta: 2,
  aktiv: 5,
  risiko: 1,
  route_effizienz_avg: 88,
  umsatz: 1840,
  drivers: [
    {
      id: 'd1', name: 'Julia F.',   score: 96, score_delta: 3,  route_effizienz: 95, tier: 'platin',  delay_risiko: false, stops_done: 4, stops_total: 6, eta_abweichung_min: -1, zone: 'Nord',  umsatz: 640,
      stops: [
        { id: 's1', reihenfolge: 1, adresse: 'Pontstraße 3',      status: 'abgeliefert', eta_min: 0,  betrag: 24.90, delay_risk: 'low',    warte_prognose_min: 0  },
        { id: 's2', reihenfolge: 2, adresse: 'Jülicher Str. 7',   status: 'abgeliefert', eta_min: 0,  betrag: 18.50, delay_risk: 'low',    warte_prognose_min: 1  },
        { id: 's3', reihenfolge: 3, adresse: 'Berliner Ring 12',  status: 'unterwegs',   eta_min: 5,  betrag: 31.20, delay_risk: 'low',    warte_prognose_min: 2  },
        { id: 's4', reihenfolge: 4, adresse: 'Roermonder Str. 1', status: 'ausstehend',  eta_min: 15, betrag: 22.80, delay_risk: 'low',    warte_prognose_min: 3  },
      ],
    },
    {
      id: 'd2', name: 'Kemal A.',   score: 88, score_delta: 1,  route_effizienz: 87, tier: 'gold',   delay_risiko: false, stops_done: 2, stops_total: 4, eta_abweichung_min: 2, zone: 'Mitte', umsatz: 510,
      stops: [
        { id: 's5', reihenfolge: 1, adresse: 'Adalbertstr. 5',   status: 'abgeliefert', eta_min: 0,  betrag: 19.50, delay_risk: 'low',    warte_prognose_min: 0  },
        { id: 's6', reihenfolge: 2, adresse: 'Elsassstr. 11',    status: 'unterwegs',   eta_min: 8,  betrag: 27.30, delay_risk: 'medium', warte_prognose_min: 4  },
        { id: 's7', reihenfolge: 3, adresse: 'Theaterplatz 4',   status: 'ausstehend',  eta_min: 18, betrag: 21.10, delay_risk: 'low',    warte_prognose_min: 3  },
      ],
    },
    {
      id: 'd3', name: 'Sara M.',    score: 74, score_delta: -4, route_effizienz: 74, tier: 'schwach', delay_risiko: true, stops_done: 1, stops_total: 3, eta_abweichung_min: 9, zone: 'Süd',   umsatz: 290,
      stops: [
        { id: 's8', reihenfolge: 1, adresse: 'Luisenstr. 2',    status: 'abgeliefert', eta_min: 0,  betrag: 16.90, delay_risk: 'low',  warte_prognose_min: 0   },
        { id: 's9', reihenfolge: 2, adresse: 'Vaalser Str. 8',  status: 'angekommen',  eta_min: 0,  betrag: 23.40, delay_risk: 'high', warte_prognose_min: 12  },
        { id: 's10',reihenfolge: 3, adresse: 'Hügelstr. 14',   status: 'ausstehend',  eta_min: 25, betrag: 28.60, delay_risk: 'high', warte_prognose_min: 8   },
      ],
    },
  ],
  zonen: [
    { name: 'Nord',  health: 'ok',       fahrer: 2, avg_min: 22, sla_pct: 95 },
    { name: 'Mitte', health: 'ok',       fahrer: 2, avg_min: 24, sla_pct: 91 },
    { name: 'Süd',   health: 'critical', fahrer: 1, avg_min: 33, sla_pct: 66 },
    { name: 'Ost',   health: 'warn',     fahrer: 1, avg_min: 27, sla_pct: 82 },
  ],
  timestamp: new Date().toISOString(),
};

const TIER_STYLE: Record<DriverTier, { label: string; bg: string; text: string; border: string }> = {
  platin:  { label: 'Platin',  bg: 'bg-cyan-950/40',    text: 'text-cyan-300',   border: 'border-cyan-700/40'   },
  gold:    { label: 'Gold',    bg: 'bg-yellow-950/40',  text: 'text-yellow-300', border: 'border-yellow-700/40' },
  gut:     { label: 'Gut',     bg: 'bg-green-950/40',   text: 'text-green-400',  border: 'border-green-800/40'  },
  schwach: { label: 'Schwach', bg: 'bg-red-950/40',     text: 'text-red-400',    border: 'border-red-800/40'    },
};

const STOP_STATUS_STYLE: Record<StopStatus, { dot: string; label: string }> = {
  abgeliefert: { dot: 'bg-green-500',  label: '✓'        },
  angekommen:  { dot: 'bg-yellow-400', label: 'Da'       },
  unterwegs:   { dot: 'bg-blue-400',   label: '→'        },
  ausstehend:  { dot: 'bg-gray-600',   label: '○'        },
};

const ZONE_COLORS: Record<ZoneHealth, { bg: string; text: string; border: string }> = {
  ok:       { bg: 'bg-green-900/30',  text: 'text-green-400',  border: 'border-green-800/40'  },
  warn:     { bg: 'bg-yellow-900/30', text: 'text-yellow-400', border: 'border-yellow-800/40' },
  critical: { bg: 'bg-red-900/40',    text: 'text-red-400',    border: 'border-red-800/50'    },
};

const DELAY_COLORS: Record<DelayRisk, string> = {
  low: 'bg-green-500', medium: 'bg-yellow-400', high: 'bg-red-500 animate-pulse',
};

export function DispatchPhase5306ScoreTourVisualisierungV29({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<'rangliste' | 'zonen'>('rangliste');

  async function load() {
    const params = new URLSearchParams({ v: '29' });
    if (locationId) params.set('location_id', locationId);
    const res = await fetch(`/api/delivery/dispatch/tour-score?${params}`).catch(() => null);
    if (res?.ok) {
      const j = await res.json();
      setData(j);
      setError(false);
    } else {
      setData(MOCK);
      setError(true);
    }
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const d = data ?? MOCK;

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 text-white text-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Trophy size={15} className="text-violet-400" />
          <span className="font-semibold">Score + Tour V29</span>
          {error && <span className="text-xs text-yellow-500 border border-yellow-700 rounded px-1">Mock</span>}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>Fleet <strong className="text-violet-300">{d.fleet_score}</strong></span>
          {d.fleet_score_delta >= 0
            ? <TrendingUp size={12} className="text-green-400" />
            : <TrendingDown size={12} className="text-red-400" />}
          <span className="text-gray-600">|</span>
          <span>€ {d.umsatz.toLocaleString('de')}</span>
        </div>
      </div>

      {/* 5-KPI-Grid */}
      <div className="grid grid-cols-5 gap-1.5 px-3 pt-3">
        {[
          { label: 'Score',     value: d.fleet_score,          color: 'text-violet-300' },
          { label: 'Aktiv',     value: d.aktiv,                color: 'text-white'      },
          { label: 'Risiko',    value: d.risiko,               color: d.risiko > 0 ? 'text-red-400' : 'text-gray-500' },
          { label: 'Eff.%',     value: `${d.route_effizienz_avg}%`, color: 'text-green-400' },
          { label: '€ Ges.',    value: `€${(d.umsatz / 1000).toFixed(1)}k`, color: 'text-yellow-300' },
        ].map(k => (
          <div key={k.label} className="rounded-lg border border-gray-800 bg-gray-800/40 p-1.5 text-center">
            <p className={`font-bold text-base ${k.color}`}>{k.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* High-Risk-Alert */}
      {d.risiko > 0 && (
        <div className="mx-3 mt-2 flex items-center gap-2 rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-1.5">
          <AlertTriangle size={12} className="text-red-400 flex-shrink-0" />
          <span className="text-xs text-red-300">{d.risiko} Fahrer mit Delay-Risiko — sofortige Maßnahme empfohlen</span>
        </div>
      )}

      {/* Tab Nav */}
      <div className="px-3 pt-3 flex gap-1">
        {(['rangliste', 'zonen'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${tab === t ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
          >
            {t === 'rangliste' ? 'Rangliste' : 'Zonen'}
          </button>
        ))}
      </div>

      {tab === 'rangliste' && (
        <div className="px-3 pt-2 pb-3 space-y-2">
          {d.drivers.map((dr, idx) => {
            const ts = TIER_STYLE[dr.tier];
            const open = expanded.has(dr.id);
            return (
              <div key={dr.id} className={`rounded-lg border ${ts.border} ${ts.bg}`}>
                {/* Driver Row */}
                <button className="w-full px-3 py-2.5 flex items-center gap-2 text-left" onClick={() => toggleExpand(dr.id)}>
                  <span className="text-gray-500 text-xs w-4">{idx + 1}</span>
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded border ${ts.bg} ${ts.text} ${ts.border}`}>{ts.label}</span>
                  <span className="font-medium text-white flex-1">{dr.name}</span>
                  {dr.delay_risiko && <AlertTriangle size={12} className="text-red-400" />}
                  <div className="text-right text-xs">
                    <p className={`font-bold ${ts.text}`}>{dr.score}</p>
                    <p className={dr.score_delta >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {dr.score_delta >= 0 ? '+' : ''}{dr.score_delta}
                    </p>
                  </div>
                  {open ? <ChevronDown size={13} className="text-gray-500" /> : <ChevronRight size={13} className="text-gray-500" />}
                </button>

                {/* Route-Effizienz */}
                <div className="px-3 pb-2">
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                    <span>Route-Effizienz</span>
                    <span>{dr.route_effizienz}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-700">
                    <div
                      className={`h-1.5 rounded-full ${dr.route_effizienz >= 90 ? 'bg-green-500' : dr.route_effizienz >= 75 ? 'bg-yellow-400' : 'bg-red-500'}`}
                      style={{ width: `${dr.route_effizienz}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                    <span><MapPin size={10} className="inline mr-0.5" />{dr.stops_done}/{dr.stops_total} Stopps</span>
                    <span className={dr.eta_abweichung_min > 0 ? 'text-red-400' : 'text-green-400'}>
                      ETA {dr.eta_abweichung_min > 0 ? `+${dr.eta_abweichung_min}` : dr.eta_abweichung_min} Min
                    </span>
                    <span><Euro size={10} className="inline mr-0.5" />€ {dr.umsatz}</span>
                  </div>

                  {/* Stopp-Dot-Sequenz */}
                  <div className="flex items-center gap-1 mt-1.5">
                    {dr.stops.map(s => (
                      <div key={s.id} className="relative group">
                        <div className={`w-4 h-4 rounded-full ${STOP_STATUS_STYLE[s.status].dot} flex items-center justify-center text-white text-xs font-bold`}>
                          <span style={{ fontSize: 9 }}>{STOP_STATUS_STYLE[s.status].label}</span>
                        </div>
                        {s.delay_risk !== 'low' && (
                          <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${DELAY_COLORS[s.delay_risk]}`} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stopp-Timeline (expandierbar) */}
                {open && (
                  <div className="border-t border-gray-700/50 mx-3 pt-2 pb-2 space-y-1.5">
                    {dr.stops.map(s => (
                      <div key={s.id} className="flex items-center gap-2 text-xs">
                        <span className={`w-3 h-3 rounded-full flex-shrink-0 ${STOP_STATUS_STYLE[s.status].dot}`} />
                        <span className="text-gray-300 flex-1 truncate">{s.adresse}</span>
                        {s.warte_prognose_min !== null && s.warte_prognose_min > 0 && (
                          <span className="text-orange-400 text-xs flex-shrink-0">+{s.warte_prognose_min}min Warte</span>
                        )}
                        {s.eta_min !== null && s.eta_min > 0 && (
                          <span className="text-gray-400 flex-shrink-0">{s.eta_min}min</span>
                        )}
                        {s.betrag !== null && (
                          <span className="text-gray-500 flex-shrink-0">€{s.betrag.toFixed(2)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'zonen' && (
        <div className="px-3 pt-2 pb-3 grid grid-cols-2 gap-2">
          {d.zonen.map(z => {
            const zc = ZONE_COLORS[z.health];
            return (
              <div key={z.name} className={`rounded-lg border p-3 ${zc.bg} ${zc.border}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-white">Zone {z.name}</span>
                  <span className={`text-xs font-bold ${zc.text}`}>{z.health.toUpperCase()}</span>
                </div>
                <div className="text-xs text-gray-400 space-y-0.5">
                  <div className="flex justify-between"><span>SLA</span><span className={zc.text}>{z.sla_pct}%</span></div>
                  <div className="flex justify-between"><span>Ø Zeit</span><span>{z.avg_min} Min</span></div>
                  <div className="flex justify-between"><span>Fahrer</span><span>{z.fahrer}</span></div>
                </div>
                <div className="mt-1.5 h-1 rounded-full bg-gray-700">
                  <div className={`h-1 rounded-full ${z.sla_pct >= 90 ? 'bg-green-500' : z.sla_pct >= 78 ? 'bg-yellow-400' : 'bg-red-500'}`} style={{ width: `${z.sla_pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
