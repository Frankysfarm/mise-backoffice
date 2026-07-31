'use client';

import { useEffect, useState } from 'react';
import {
  Trophy, Route, Clock, AlertTriangle, TrendingUp, TrendingDown,
  MapPin, Zap, CheckCircle2, Euro, Target, Users,
} from 'lucide-react';

// Phase 5307 — Score + Tour-Visualisierung V30
// Neu: Profit-per-km je Fahrer; Cluster-Analyse (Zonen-Gruppen);
// Live-Risikograd-Ampel; Stopp-Dichte-Visualisierung;
// 5-KPI-Grid Fleet-Score/Aktiv/Risiko/€/km-Ertrag;
// 3-Tab-Nav Rangliste/Cluster/Zonen; 20s-Polling; Mock-Fallback

type DriverTier = 'platin' | 'gold' | 'gut' | 'schwach';
type StopStatus = 'ausstehend' | 'unterwegs' | 'abgeliefert';
type RiskLevel  = 'low' | 'medium' | 'high';
type ZoneHealth = 'ok' | 'warn' | 'critical';

interface TourStop {
  id: string;
  reihenfolge: number;
  adresse: string;
  status: StopStatus;
  eta_min: number | null;
  betrag: number | null;
  risk: RiskLevel;
}

interface DriverRow {
  id: string;
  name: string;
  score: number;
  score_delta: number;
  tier: DriverTier;
  risiko: boolean;
  stops_done: number;
  stops_total: number;
  km_heute: number;
  umsatz: number;
  profit_per_km: number;
  zone: string;
  cluster: string;
  stops: TourStop[];
}

interface ClusterItem {
  name: string;
  fahrer: number;
  avg_profit_km: number;
  bestellungen: number;
  health: ZoneHealth;
}

interface ZoneItem {
  name: string;
  health: ZoneHealth;
  fahrer: number;
  avg_min: number;
  sla_pct: number;
  umsatz: number;
}

interface ApiResponse {
  fleet_score: number;
  fleet_score_delta: number;
  aktiv: number;
  risiko: number;
  umsatz_gesamt: number;
  avg_profit_per_km: number;
  drivers: DriverRow[];
  clusters: ClusterItem[];
  zonen: ZoneItem[];
  timestamp: string;
}

const MOCK: ApiResponse = {
  fleet_score: 87,
  fleet_score_delta: 2.1,
  aktiv: 7,
  risiko: 1,
  umsatz_gesamt: 1840,
  avg_profit_per_km: 3.20,
  timestamp: new Date().toISOString(),
  clusters: [
    { name: 'Innenstadt', fahrer: 3, avg_profit_km: 4.10, bestellungen: 22, health: 'ok'       },
    { name: 'Nordring',   fahrer: 2, avg_profit_km: 2.80, bestellungen: 11, health: 'warn'     },
    { name: 'Sued-West',  fahrer: 2, avg_profit_km: 1.90, bestellungen:  8, health: 'critical' },
  ],
  zonen: [
    { name: 'Mitte',    health: 'ok',       fahrer: 3, avg_min: 21, sla_pct: 94, umsatz: 920  },
    { name: 'Nord',     health: 'warn',     fahrer: 2, avg_min: 28, sla_pct: 78, umsatz: 540  },
    { name: 'Sued',     health: 'critical', fahrer: 2, avg_min: 34, sla_pct: 66, umsatz: 380  },
  ],
  drivers: [
    {
      id: 'd1', name: 'Tim B.',    score: 95, score_delta: 3,  tier: 'platin', risiko: false, stops_done: 6, stops_total: 8,  km_heute: 28, umsatz: 420, profit_per_km: 5.10, zone: 'Mitte',  cluster: 'Innenstadt',
      stops: [
        { id: 's1', reihenfolge: 1, adresse: 'Kapuzinerstr. 12',  status: 'abgeliefert', eta_min: null, betrag: 42.80, risk: 'low'    },
        { id: 's2', reihenfolge: 2, adresse: 'Theaterplatz 5',    status: 'unterwegs',   eta_min: 4,    betrag: 38.50, risk: 'low'    },
        { id: 's3', reihenfolge: 3, adresse: 'Büchel 7',          status: 'ausstehend',  eta_min: 18,   betrag: 55.00, risk: 'medium' },
      ],
    },
    {
      id: 'd2', name: 'Sara M.',  score: 82, score_delta: -1, tier: 'gold',   risiko: false, stops_done: 4, stops_total: 6,  km_heute: 22, umsatz: 310, profit_per_km: 3.80, zone: 'Nord',   cluster: 'Nordring',
      stops: [
        { id: 's4', reihenfolge: 1, adresse: 'Nordfriedhof 2',    status: 'abgeliefert', eta_min: null, betrag: 29.90, risk: 'low'  },
        { id: 's5', reihenfolge: 2, adresse: 'Eupener Str. 44',   status: 'ausstehend',  eta_min: 11,   betrag: 34.00, risk: 'low'  },
      ],
    },
    {
      id: 'd3', name: 'Kemal A.', score: 61, score_delta: -4, tier: 'schwach', risiko: true, stops_done: 2, stops_total: 5,  km_heute: 31, umsatz: 210, profit_per_km: 1.50, zone: 'Sued',   cluster: 'Sued-West',
      stops: [
        { id: 's6', reihenfolge: 1, adresse: 'Vaalser Str. 18',   status: 'abgeliefert', eta_min: null, betrag: 22.00, risk: 'low'    },
        { id: 's7', reihenfolge: 2, adresse: 'Drimbornweg 9',     status: 'unterwegs',   eta_min: 8,    betrag: 41.50, risk: 'high'   },
        { id: 's8', reihenfolge: 3, adresse: 'Schlieffenstr. 3',  status: 'ausstehend',  eta_min: 24,   betrag: 33.00, risk: 'medium' },
      ],
    },
  ],
};

type Tab = 'rangliste' | 'cluster' | 'zonen';

const TIER_STYLES: Record<DriverTier, { badge: string; bar: string }> = {
  platin: { badge: 'bg-cyan-900/50 text-cyan-300 border-cyan-700',   bar: 'bg-cyan-500'   },
  gold:   { badge: 'bg-yellow-900/50 text-yellow-300 border-yellow-700', bar: 'bg-yellow-500' },
  gut:    { badge: 'bg-green-900/50 text-green-300 border-green-700',  bar: 'bg-green-500'  },
  schwach:{ badge: 'bg-red-900/50 text-red-300 border-red-700',        bar: 'bg-red-500'    },
};

const ZONE_COLORS: Record<ZoneHealth, { bg: string; badge: string; text: string }> = {
  ok:       { bg: 'bg-green-950/30',  badge: 'bg-green-800/60 text-green-300',  text: 'text-green-400'  },
  warn:     { bg: 'bg-yellow-950/30', badge: 'bg-yellow-800/60 text-yellow-300',text: 'text-yellow-400' },
  critical: { bg: 'bg-red-950/40',    badge: 'bg-red-800/60 text-red-300',      text: 'text-red-400'    },
};

const RISK_DOT: Record<RiskLevel, string> = {
  low: 'bg-green-500', medium: 'bg-yellow-500', high: 'bg-red-500',
};

const STOP_STATUS_LABEL: Record<StopStatus, string> = {
  ausstehend: 'Ausstehend', unterwegs: 'Unterwegs', abgeliefert: 'Abgeliefert',
};

export function DispatchPhase5307ScoreTourVisualisierungV30() {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [tab, setTab] = useState<Tab>('rangliste');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('/api/delivery/dispatch/score-tour');
        if (r.ok) setData(await r.json());
      } catch { /* mock */ }
    };
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, []);

  const hasCriticalRisk = data.drivers.some(d => d.risiko);

  return (
    <div className="bg-gray-950 border border-violet-900/40 rounded-2xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-violet-400" />
          <span className="font-semibold text-white text-sm">Tour-Score V30</span>
          <span className="text-xs text-gray-500">Profit/km · Cluster</span>
        </div>
        <div className="flex items-center gap-1.5">
          {data.fleet_score_delta > 0
            ? <TrendingUp className="w-4 h-4 text-green-400" />
            : <TrendingDown className="w-4 h-4 text-red-400" />}
          <span className="text-xl font-bold text-violet-300">{data.fleet_score}</span>
          <span className="text-xs text-gray-500">Fleet</span>
        </div>
      </div>

      {/* Risiko-Alert */}
      {hasCriticalRisk && (
        <div className="flex items-center gap-2 bg-red-950/40 border border-red-700/50 rounded-lg px-3 py-1.5">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-xs text-red-200">
            <strong>{data.risiko}</strong> Fahrer mit hohem Risikograd — sofort prüfen
          </span>
        </div>
      )}

      {/* 5-KPI-Grid */}
      <div className="grid grid-cols-5 gap-1.5 text-center">
        {[
          { label: 'Score',       value: data.fleet_score,                         color: 'text-violet-300' },
          { label: 'Aktiv',       value: data.aktiv,                               color: 'text-white'      },
          { label: 'Risiko',      value: data.risiko,                              color: 'text-red-400'    },
          { label: 'Umsatz',      value: `€${(data.umsatz_gesamt/1000).toFixed(1)}k`, color: 'text-green-300' },
          { label: '€/km',        value: `€${data.avg_profit_per_km.toFixed(2)}`,  color: 'text-yellow-300' },
        ].map(k => (
          <div key={k.label} className="bg-gray-900/60 rounded-lg p-2">
            <div className={`text-base font-bold ${k.color}`}>{k.value}</div>
            <div className="text-xs text-gray-500">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tab-Nav */}
      <div className="flex gap-1">
        {(['rangliste', 'cluster', 'zonen'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              tab === t ? 'bg-violet-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {t === 'rangliste' ? 'Rangliste' : t === 'cluster' ? 'Cluster' : 'Zonen'}
          </button>
        ))}
      </div>

      {/* Tab: Rangliste */}
      {tab === 'rangliste' && (
        <div className="space-y-2">
          {data.drivers.map((d, i) => {
            const t = TIER_STYLES[d.tier];
            const isOpen = expanded === d.id;
            return (
              <div key={d.id} className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
                <button
                  className="w-full p-3 flex items-center gap-3 text-left"
                  onClick={() => setExpanded(isOpen ? null : d.id)}
                >
                  <span className="text-gray-500 text-xs w-4">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white text-sm">{d.name}</span>
                      <span className={`text-xs border rounded px-1.5 ${t.badge}`}>{d.tier}</span>
                      {d.risiko && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                    </div>
                    {/* Score-Balken */}
                    <div className="mt-1.5 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className={`h-full ${t.bar} rounded-full`} style={{ width: `${d.score}%` }} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-white font-bold text-sm">{d.score}</div>
                    <div className="text-xs text-gray-500">{d.stops_done}/{d.stops_total} Stopps</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-yellow-300 font-bold text-sm">€{d.profit_per_km.toFixed(2)}</div>
                    <div className="text-xs text-gray-500">/km</div>
                  </div>
                </button>

                {/* Aufklappbare Stopp-Timeline */}
                {isOpen && (
                  <div className="border-t border-gray-800 px-3 pb-3 pt-2 space-y-1.5">
                    <div className="flex gap-4 text-xs text-gray-500 mb-2">
                      <span>{d.km_heute} km heute</span>
                      <span>€{d.umsatz} Umsatz</span>
                      <span className="text-xs text-gray-500">{d.cluster}</span>
                    </div>
                    {d.stops.map(s => (
                      <div key={s.id} className="flex items-center gap-2 text-xs">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${RISK_DOT[s.risk]}`} />
                        <span className="text-gray-400 w-4">{s.reihenfolge}.</span>
                        <span className="text-gray-300 flex-1 truncate">{s.adresse}</span>
                        <span className={`${s.status === 'abgeliefert' ? 'text-green-400' : s.status === 'unterwegs' ? 'text-blue-400' : 'text-gray-500'}`}>
                          {STOP_STATUS_LABEL[s.status]}
                        </span>
                        {s.eta_min !== null && <span className="text-gray-500">{s.eta_min} Min</span>}
                        {s.betrag !== null && <span className="text-green-300">€{s.betrag.toFixed(2)}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tab: Cluster */}
      {tab === 'cluster' && (
        <div className="space-y-2">
          {data.clusters.map(c => {
            const zc = ZONE_COLORS[c.health];
            return (
              <div key={c.name} className={`${zc.bg} border border-gray-800 rounded-xl p-3`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span className="font-semibold text-white text-sm">{c.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${zc.badge}`}>{c.health}</span>
                  </div>
                  <div className="text-right">
                    <div className={`text-base font-bold ${zc.text}`}>€{c.avg_profit_km.toFixed(2)}/km</div>
                    <div className="text-xs text-gray-500">Ø Profit</div>
                  </div>
                </div>
                <div className="flex gap-4 text-xs text-gray-400">
                  <span><Users className="w-3 h-3 inline mr-1" />{c.fahrer} Fahrer</span>
                  <span><Route className="w-3 h-3 inline mr-1" />{c.bestellungen} Bestellungen</span>
                </div>
                {/* Profit-Balken */}
                <div className="mt-2 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${c.health === 'ok' ? 'bg-green-500' : c.health === 'warn' ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(100, (c.avg_profit_km / 5) * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab: Zonen */}
      {tab === 'zonen' && (
        <div className="space-y-2">
          {data.zonen.map(z => {
            const zc = ZONE_COLORS[z.health];
            return (
              <div key={z.name} className={`${zc.bg} border border-gray-800 rounded-xl p-3`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white text-sm">{z.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${zc.badge}`}>{z.health.toUpperCase()}</span>
                  </div>
                  <span className={`font-bold text-sm ${zc.text}`}>{z.sla_pct}% SLA</span>
                </div>
                <div className="mt-2 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${zc.text.replace('text-', 'bg-').replace('-400', '-500').replace('-300', '-500')}`}
                    style={{ width: `${z.sla_pct}%` }}
                  />
                </div>
                <div className="mt-2 flex gap-4 text-xs text-gray-400">
                  <span>{z.fahrer} Fahrer</span>
                  <span>Ø {z.avg_min} Min</span>
                  <span>€{z.umsatz} Umsatz</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="text-xs text-gray-600 text-right">
        {new Date(data.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}
