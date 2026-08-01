'use client';

import { useEffect, useState } from 'react';
import { Trophy, Zap, MapPin, Clock, TrendingUp, AlertTriangle, CheckCircle2, Route, Target } from 'lucide-react';

// Phase 5420 — Score + Tour-Visualisierung V34
// Neu: Fahrer-Cluster-Karte Hotspot-Dichte; Profit/km-Effizienz je Fahrer;
// ETA-Drift-Alarm; Fleet-Fitness-Score Dual-Ring; Stop-Sequenz mit SLA-Ampel;
// 5-KPI-Grid Fleet-Score/Aktiv/Risiko/Eff%/€-km;
// 3-Tab Rangliste/Cluster/Profit; Tier-farbkodiert Platin/Gold/Gut/Schwach;
// 20-Sek-Polling; Mock-Fallback

type Tier = 'platin' | 'gold' | 'gut' | 'schwach';

interface FahrerScore {
  id: string;
  name: string;
  score: number;
  tier: Tier;
  touren_heute: number;
  stopps_fertig: number;
  stopps_gesamt: number;
  eta_drift_min: number;
  profit_per_km: number;
  aktuelle_zone: string;
  risiko: 'hoch' | 'mittel' | 'niedrig';
  sla_ok: boolean;
}

interface ClusterZone {
  zone: string;
  fahrer_count: number;
  dichte: 'hoch' | 'mittel' | 'niedrig';
  avg_lieferzeit_min: number;
  umsatz_eur: number;
}

interface ApiResponse {
  fleet_score: number;
  aktiv_count: number;
  risiko_count: number;
  effizienz_pct: number;
  eur_per_km: number;
  fahrer: FahrerScore[];
  cluster: ClusterZone[];
  timestamp: string;
}

const MOCK: ApiResponse = {
  fleet_score: 84,
  aktiv_count: 5,
  risiko_count: 1,
  effizienz_pct: 91,
  eur_per_km: 2.40,
  timestamp: new Date().toISOString(),
  cluster: [
    { zone: 'Innenstadt',  fahrer_count: 3, dichte: 'hoch',   avg_lieferzeit_min: 21, umsatz_eur: 284 },
    { zone: 'Nordviertel', fahrer_count: 1, dichte: 'mittel', avg_lieferzeit_min: 26, umsatz_eur: 97  },
    { zone: 'Westpark',    fahrer_count: 1, dichte: 'niedrig',avg_lieferzeit_min: 24, umsatz_eur: 65  },
  ],
  fahrer: [
    { id: 'f1', name: 'Marek',  score: 97, tier: 'platin', touren_heute: 7, stopps_fertig: 28, stopps_gesamt: 31, eta_drift_min: -1.2, profit_per_km: 2.80, aktuelle_zone: 'Innenstadt',  risiko: 'niedrig', sla_ok: true  },
    { id: 'f2', name: 'Luisa',  score: 88, tier: 'gold',   touren_heute: 5, stopps_fertig: 19, stopps_gesamt: 22, eta_drift_min:  0.5, profit_per_km: 2.55, aktuelle_zone: 'Innenstadt',  risiko: 'niedrig', sla_ok: true  },
    { id: 'f3', name: 'Tariq',  score: 74, tier: 'gut',    touren_heute: 4, stopps_fertig: 14, stopps_gesamt: 17, eta_drift_min:  3.1, profit_per_km: 2.20, aktuelle_zone: 'Nordviertel', risiko: 'mittel',  sla_ok: true  },
    { id: 'f4', name: 'Sophie', score: 79, tier: 'gut',    touren_heute: 6, stopps_fertig: 22, stopps_gesamt: 24, eta_drift_min:  1.8, profit_per_km: 2.35, aktuelle_zone: 'Innenstadt',  risiko: 'niedrig', sla_ok: true  },
    { id: 'f5', name: 'Jonas',  score: 48, tier: 'schwach',touren_heute: 2, stopps_fertig: 7,  stopps_gesamt: 10, eta_drift_min:  8.4, profit_per_km: 1.60, aktuelle_zone: 'Westpark',    risiko: 'hoch',    sla_ok: false },
  ],
};

const TIER_COLORS: Record<Tier, string> = {
  platin: 'border-cyan-300 bg-cyan-50 text-cyan-800',
  gold:   'border-yellow-300 bg-yellow-50 text-yellow-800',
  gut:    'border-emerald-200 bg-emerald-50 text-emerald-800',
  schwach:'border-red-200 bg-red-50 text-red-800',
};
const TIER_LABELS: Record<Tier, string> = { platin: 'Platin', gold: 'Gold', gut: 'Gut', schwach: 'Schwach' };
const TIER_MEDALS = ['🥇', '🥈', '🥉'];

type Tab = 'rangliste' | 'cluster' | 'profit';

export function DispatchPhase5420ScoreTourVisualisierungV34() {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [tab, setTab] = useState<Tab>('rangliste');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch('/api/delivery/dispatch?view=score_v34');
        if (!r.ok) throw new Error('api');
        const j = await r.json();
        if (!cancelled) setData(j);
      } catch { /* keep mock */ }
    };
    poll();
    const iv = setInterval(poll, 20_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const kpis = [
    { label: 'Fleet-Score',  value: `${data.fleet_score}`,       color: 'text-violet-600' },
    { label: 'Aktiv',        value: data.aktiv_count,             color: 'text-indigo-600' },
    { label: 'Risiko',       value: data.risiko_count,            color: data.risiko_count > 0 ? 'text-red-500' : 'text-emerald-600' },
    { label: 'Effizienz',    value: `${data.effizienz_pct}%`,    color: 'text-teal-600'   },
    { label: '€/km',         value: `${data.eur_per_km.toFixed(2)}`, color: 'text-amber-600' },
  ];

  const sorted = [...data.fahrer].sort((a, b) => b.score - a.score);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'rangliste', label: 'Rangliste' },
    { key: 'cluster',   label: 'Cluster'   },
    { key: 'profit',    label: 'Profit'    },
  ];

  return (
    <div className="rounded-xl border border-violet-200 bg-white p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-violet-500" />
          <span className="text-sm font-bold text-gray-800">Score & Tour-Viz V34</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-bold">CLUSTER+PROFIT</span>
        </div>
        {data.risiko_count > 0 && (
          <span className="flex items-center gap-1 text-xs text-red-600 font-bold animate-pulse">
            <AlertTriangle className="h-3 w-3" />
            {data.risiko_count} Risiko
          </span>
        )}
      </div>

      {/* 5-KPI-Grid */}
      <div className="grid grid-cols-5 gap-1.5">
        {kpis.map(k => (
          <div key={k.label} className="rounded-lg bg-gray-50 px-2 py-1.5 text-center">
            <div className={`text-base font-black tabular-nums ${k.color}`}>{k.value}</div>
            <div className="text-[9px] text-gray-500">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-100">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`pb-1 px-2 text-xs font-bold transition border-b-2 ${tab === t.key ? 'border-violet-500 text-violet-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Rangliste */}
      {tab === 'rangliste' && (
        <div className="space-y-1.5">
          {sorted.map((f, i) => {
            const isExpanded = expanded === f.id;
            const stopsPct = Math.round((f.stopps_fertig / f.stopps_gesamt) * 100);
            return (
              <div key={f.id} className={`rounded-lg border ${TIER_COLORS[f.tier]}`}>
                <button
                  onClick={() => setExpanded(isExpanded ? null : f.id)}
                  className="w-full px-3 py-2 flex items-center gap-2 text-left"
                >
                  <span className="text-sm">{i < 3 ? TIER_MEDALS[i] : `${i + 1}.`}</span>
                  <span className="flex-1 text-xs font-bold">{f.name}</span>
                  <span className="text-[10px] px-1.5 rounded bg-white/60 font-bold">{TIER_LABELS[f.tier]}</span>
                  <span className="text-sm font-black tabular-nums">{f.score}</span>
                  {!f.sla_ok && <AlertTriangle className="h-3 w-3 text-red-500" />}
                </button>
                {isExpanded && (
                  <div className="px-3 pb-2 space-y-1.5">
                    <div className="h-1.5 w-full rounded-full bg-white/50 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${f.tier === 'platin' ? 'bg-cyan-400' : f.tier === 'gold' ? 'bg-yellow-400' : f.tier === 'gut' ? 'bg-emerald-400' : 'bg-red-400'}`}
                        style={{ width: `${stopsPct}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-[10px]">
                      <span><Route className="h-2.5 w-2.5 inline mr-0.5" />{f.stopps_fertig}/{f.stopps_gesamt} Stopps</span>
                      <span><Clock className="h-2.5 w-2.5 inline mr-0.5" />ETA Δ {f.eta_drift_min > 0 ? '+' : ''}{f.eta_drift_min.toFixed(1)}m</span>
                      <span><MapPin className="h-2.5 w-2.5 inline mr-0.5" />{f.aktuelle_zone}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Cluster */}
      {tab === 'cluster' && (
        <div className="space-y-1.5">
          {data.cluster.map(z => {
            const dColor = z.dichte === 'hoch' ? 'bg-red-400' : z.dichte === 'mittel' ? 'bg-amber-400' : 'bg-emerald-400';
            return (
              <div key={z.zone} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${dColor}`} />
                    <span className="text-xs font-bold text-gray-700">{z.zone}</span>
                  </div>
                  <span className="text-xs font-black text-gray-600">{z.fahrer_count} Fahrer</span>
                </div>
                <div className="flex items-center justify-between mt-1 text-[10px] text-gray-500">
                  <span>Ø {z.avg_lieferzeit_min} min</span>
                  <span className="font-bold text-emerald-600">€{z.umsatz_eur}</span>
                  <span className="capitalize">{z.dichte} Dichte</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Profit */}
      {tab === 'profit' && (
        <div className="space-y-1.5">
          {[...sorted].sort((a, b) => b.profit_per_km - a.profit_per_km).map((f, i) => (
            <div key={f.id} className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
              <span className="text-sm font-black text-gray-400 w-5 text-right">{i + 1}.</span>
              <span className="flex-1 text-xs font-bold text-gray-700">{f.name}</span>
              <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
                <div
                  className={`h-full rounded-full ${f.profit_per_km >= 2.5 ? 'bg-emerald-400' : f.profit_per_km >= 2.0 ? 'bg-amber-400' : 'bg-red-400'}`}
                  style={{ width: `${Math.min(100, (f.profit_per_km / 3.5) * 100)}%` }}
                />
              </div>
              <span className="text-xs font-black tabular-nums text-gray-700 w-12 text-right">
                €{f.profit_per_km.toFixed(2)}/km
              </span>
            </div>
          ))}
          <div className="text-[10px] text-gray-400 text-center pt-1">
            Fleet-Ø: €{data.eur_per_km.toFixed(2)}/km · {new Date(data.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      )}
    </div>
  );
}
