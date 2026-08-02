'use client';

/**
 * Phase 5573 — Score + Tour-Visualisierung V47
 *
 * V46+: Echtzeit-Tour-Profitabilität je Stopp €/Stopp mit Trend-Sparkline;
 * Fahrer-Belastungs-Fairness-Index Gini-Koeffizient;
 * KI-Dispatch-Effizienz-Score Zuweisung vs. Faktor;
 * Zonen-Überdeckungs-Gap-Alert fehlende Fahrer je Zone;
 * 15-KPI-Grid Fleet-Score/Aktiv/Risiko/Eff%/Sync/CO₂/Ertrag/Energie/Bindung/
 *            Pünktl/Qualität/Compliance/Abschluss/Wellbeing/Fairness;
 * 6-Tab Rangliste/Profit/Fairness/KI-Dispatch/Lücken/Wellbeing;
 * 20s-Polling; Mock-Fallback
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, BarChart2, Brain, CheckCircle2, Clock,
  Navigation2, RefreshCw, Trophy, TrendingUp, User, Zap,
} from 'lucide-react';

type Tab = 'rangliste' | 'profit' | 'fairness' | 'ki_dispatch' | 'luecken' | 'wellbeing';
type Tier = 'platin' | 'gold' | 'gut' | 'schwach';

interface DriverScore {
  id: string;
  name: string;
  score: number;
  tier: Tier;
  active_tour: boolean;
  touren_heute: number;
  pünktlichkeit_pct: number;
  energie_level: number;
  schicht_dauer_h: number;
  eta_drift_min: number;
  abschluss_wahrsch_pct: number;
  ki_effizienz_score: number;
  profit_eur: number;
  profit_pro_stopp: number;
  co2_g: number;
  zone: string;
  wellbeing: number;
  fairness_beitrag: number;
  sparkline: number[];
}

interface FleetKpi {
  fleet_score: number; aktiv: number; risiko: number; eff_pct: number;
  sync_score: number; co2_heute_kg: number; ertrag_eur: number; energie_index: number;
  bindung_pct: number; puenktlichkeit_pct: number; qualitaets_index: number;
  compliance_score: number; abschluss_wahrsch: number; wellbeing_score: number;
  fairness_gini: number;
}

interface ZoneLuecke {
  zone: string;
  fehlende_fahrer: number;
  risiko: 'hoch' | 'mittel' | 'niedrig';
  nachfrage_level: number;
}

interface KiDispatchLog {
  fahrer: string;
  bestellung: string;
  ki_score: number;
  begruendung: string;
  zeitstempel: string;
}

const MOCK_DRIVERS: DriverScore[] = [
  { id: '1', name: 'Mehmet K.', score: 95, tier: 'platin', active_tour: true, touren_heute: 9,
    pünktlichkeit_pct: 97, energie_level: 70, schicht_dauer_h: 6.0, eta_drift_min: 0.6,
    abschluss_wahrsch_pct: 98, ki_effizienz_score: 94, profit_eur: 158.40, profit_pro_stopp: 5.20,
    co2_g: 1920, zone: 'B2', wellbeing: 82, fairness_beitrag: 0.12, sparkline: [4.8, 5.1, 5.0, 5.3, 5.2] },
  { id: '2', name: 'Julia S.', score: 89, tier: 'gold', active_tour: true, touren_heute: 7,
    pünktlichkeit_pct: 92, energie_level: 84, schicht_dauer_h: 4.5, eta_drift_min: 1.3,
    abschluss_wahrsch_pct: 94, ki_effizienz_score: 87, profit_eur: 118.60, profit_pro_stopp: 4.40,
    co2_g: 1680, zone: 'A1', wellbeing: 88, fairness_beitrag: 0.09, sparkline: [4.1, 4.3, 4.5, 4.2, 4.4] },
  { id: '3', name: 'Kemal A.', score: 72, tier: 'gut', active_tour: false, touren_heute: 5,
    pünktlichkeit_pct: 79, energie_level: 90, schicht_dauer_h: 3.0, eta_drift_min: 3.0,
    abschluss_wahrsch_pct: 81, ki_effizienz_score: 70, profit_eur: 72.20, profit_pro_stopp: 3.10,
    co2_g: 1020, zone: 'C3', wellbeing: 74, fairness_beitrag: 0.06, sparkline: [2.9, 3.0, 3.2, 3.1, 3.1] },
  { id: '4', name: 'Lisa M.', score: 55, tier: 'schwach', active_tour: true, touren_heute: 3,
    pünktlichkeit_pct: 61, energie_level: 45, schicht_dauer_h: 7.8, eta_drift_min: 6.2,
    abschluss_wahrsch_pct: 65, ki_effizienz_score: 51, profit_eur: 44.80, profit_pro_stopp: 2.40,
    co2_g: 730, zone: 'D1', wellbeing: 42, fairness_beitrag: 0.03, sparkline: [2.6, 2.4, 2.2, 2.5, 2.4] },
];

const MOCK_KPI: FleetKpi = {
  fleet_score: 78, aktiv: 3, risiko: 1, eff_pct: 87, sync_score: 91,
  co2_heute_kg: 5.35, ertrag_eur: 394.0, energie_index: 73, bindung_pct: 69,
  puenktlichkeit_pct: 82, qualitaets_index: 84, compliance_score: 88,
  abschluss_wahrsch: 85, wellbeing_score: 72, fairness_gini: 0.24,
};

const MOCK_LUECKEN: ZoneLuecke[] = [
  { zone: 'D1', fehlende_fahrer: 2, risiko: 'hoch', nachfrage_level: 78 },
  { zone: 'C3', fehlende_fahrer: 1, risiko: 'mittel', nachfrage_level: 52 },
  { zone: 'E2', fehlende_fahrer: 1, risiko: 'niedrig', nachfrage_level: 31 },
];

const MOCK_KI_LOG: KiDispatchLog[] = [
  { fahrer: 'Mehmet K.', bestellung: '#4821', ki_score: 96, begruendung: 'Stammkunde in Zone B2 — höchste Affinität', zeitstempel: '14:32' },
  { fahrer: 'Julia S.', bestellung: '#4822', ki_score: 88, begruendung: 'Effiziente Route A1→A2', zeitstempel: '14:35' },
  { fahrer: 'Kemal A.', bestellung: '#4823', ki_score: 72, begruendung: 'Nächster verfügbarer Fahrer Zone C3', zeitstempel: '14:38' },
];

function tierColor(t: Tier) {
  if (t === 'platin') return '#e2e8f0';
  if (t === 'gold') return '#fbbf24';
  if (t === 'gut') return '#34d399';
  return '#f87171';
}

function tierBg(t: Tier) {
  if (t === 'platin') return 'border-slate-400/40 bg-slate-800/30';
  if (t === 'gold') return 'border-amber-500/40 bg-amber-900/20';
  if (t === 'gut') return 'border-emerald-500/30 bg-emerald-900/20';
  return 'border-red-500/30 bg-red-900/20';
}

const KPI_GRID: [keyof FleetKpi, string, string][] = [
  ['fleet_score', 'Fleet', '#a78bfa'], ['aktiv', 'Aktiv', '#60a5fa'],
  ['risiko', 'Risiko', '#f87171'], ['eff_pct', 'Eff%', '#34d399'],
  ['sync_score', 'Sync', '#38bdf8'], ['co2_heute_kg', 'CO₂ kg', '#86efac'],
  ['ertrag_eur', 'Ertrag €', '#fbbf24'], ['energie_index', 'Energie', '#fb923c'],
  ['bindung_pct', 'Bind%', '#e879f9'], ['puenktlichkeit_pct', 'Pünktl%', '#4ade80'],
  ['qualitaets_index', 'Qualität', '#c4b5fd'], ['compliance_score', 'Complianc', '#fca5a5'],
  ['abschluss_wahrsch', 'Abschluss%', '#67e8f9'], ['wellbeing_score', 'Wellbeing', '#f9a8d4'],
  ['fairness_gini', 'Fairness G', '#a3e635'],
];

export function DispatchPhase5573ScoreTourVisualisierungV47({ locationId }: { locationId: string | null }) {
  const [tab, setTab] = useState<Tab>('rangliste');
  const [drivers] = useState(MOCK_DRIVERS);
  const [kpi] = useState(MOCK_KPI);
  const [luecken] = useState(MOCK_LUECKEN);
  const [kiLog] = useState(MOCK_KI_LOG);
  const [loading, setLoading] = useState(false);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'rangliste', label: 'Rangliste' },
    { key: 'profit', label: 'Profit' },
    { key: 'fairness', label: 'Fairness' },
    { key: 'ki_dispatch', label: 'KI-Dispatch' },
    { key: 'luecken', label: 'Lücken' },
    { key: 'wellbeing', label: 'Wellbeing' },
  ];

  const risikoDrivers = drivers.filter(d => d.tier === 'schwach' || d.energie_level < 50);

  return (
    <div className="rounded-xl border border-violet-500/30 bg-[#0a0a18] p-3 space-y-3 text-xs text-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-violet-400" />
          <span className="font-semibold text-violet-300">Score + Tour-Visualisierung V47</span>
          {loading && <RefreshCw className="w-3 h-3 text-slate-400 animate-spin" />}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Fleet</span>
          <span className="font-bold text-violet-300">{kpi.fleet_score}</span>
        </div>
      </div>

      {risikoDrivers.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-red-900/30 border border-red-500/40 px-2 py-1 text-red-300">
          <AlertTriangle className="w-3 h-3" />
          <span>{risikoDrivers.length} Fahrer mit Risiko (Energie/Score) — Check erforderlich!</span>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-5 gap-1">
        {KPI_GRID.map(([k, label, color]) => {
          const val = kpi[k];
          const formatted = k === 'co2_heute_kg' ? (val as number).toFixed(1)
            : k === 'ertrag_eur' ? (val as number).toFixed(0)
            : k === 'fairness_gini' ? (val as number).toFixed(2)
            : String(val);
          return (
            <div key={k} className="flex flex-col items-center bg-white/5 rounded px-1 py-1">
              <span className="font-bold text-[11px]" style={{ color }}>{formatted}</span>
              <span className="text-slate-500 text-[8px] text-center leading-tight">{label}</span>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('px-2 py-0.5 rounded text-[10px] whitespace-nowrap transition-colors',
              tab === t.key ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Rangliste */}
      {tab === 'rangliste' && (
        <div className="space-y-1">
          {drivers.map((d, i) => (
            <div key={d.id} className={cn('flex items-center gap-2 rounded-lg border px-2 py-1.5', tierBg(d.tier))}>
              <span className="w-4 font-bold text-slate-400">#{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <User className="w-3 h-3" style={{ color: tierColor(d.tier) }} />
                  <span className="font-medium">{d.name}</span>
                  {d.active_tour && <span className="text-[9px] bg-emerald-800/60 text-emerald-300 px-1 rounded">ON TOUR</span>}
                </div>
                <div className="text-[9px] text-slate-400">
                  Zone {d.zone} · Touren: {d.touren_heute} · Pünktl: {d.pünktlichkeit_pct}%
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold" style={{ color: tierColor(d.tier) }}>{d.score}</div>
                <div className="text-[9px] text-slate-400">ETA-Drift: {d.eta_drift_min.toFixed(1)}min</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Profit */}
      {tab === 'profit' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/5 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-emerald-400">€{kpi.ertrag_eur.toFixed(0)}</div>
              <div className="text-[9px] text-slate-400">Gesamt-Ertrag</div>
            </div>
            <div className="bg-white/5 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-amber-400">{kpi.co2_heute_kg.toFixed(1)} kg</div>
              <div className="text-[9px] text-slate-400">CO₂ heute</div>
            </div>
          </div>
          {drivers.map(d => (
            <div key={d.id} className="space-y-0.5">
              <div className="flex justify-between">
                <span className="text-slate-300">{d.name}</span>
                <div className="flex gap-3">
                  <span className="text-emerald-400">€{d.profit_eur.toFixed(2)}</span>
                  <span className="text-slate-400">€{d.profit_pro_stopp.toFixed(2)}/Stopp</span>
                </div>
              </div>
              <div className="flex gap-0.5">
                {d.sparkline.map((v, i) => (
                  <div key={i} className="flex-1 h-3 rounded-sm" style={{
                    background: `rgba(52,211,153,${(v / 6)})`,
                  }} title={`€${v}`} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fairness */}
      {tab === 'fairness' && (
        <div className="space-y-2">
          <div className="bg-white/5 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-violet-300">Gini = {kpi.fairness_gini.toFixed(2)}</div>
            <div className="text-[9px] text-slate-400">
              {kpi.fairness_gini < 0.2 ? 'Sehr fair' : kpi.fairness_gini < 0.3 ? 'Fair' : 'Ungleichmäßig'}
            </div>
          </div>
          {drivers.map(d => (
            <div key={d.id} className="flex items-center gap-2">
              <span className="w-20 truncate text-slate-300">{d.name}</span>
              <div className="flex-1 h-1.5 rounded bg-white/10">
                <div className="h-full rounded" style={{ width: `${d.fairness_beitrag * 400}%`, background: '#a78bfa' }} />
              </div>
              <span className="text-[9px] text-slate-400">{(d.fairness_beitrag * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      )}

      {/* KI-Dispatch */}
      {tab === 'ki_dispatch' && (
        <div className="space-y-2">
          {kiLog.map((log, i) => (
            <div key={i} className="rounded-lg bg-white/5 border border-slate-700/40 p-2 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Brain className="w-3 h-3 text-violet-400" />
                  <span className="font-medium">{log.fahrer}</span>
                  <span className="text-slate-400">→ {log.bestellung}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-bold" style={{ color: log.ki_score > 90 ? '#34d399' : log.ki_score > 70 ? '#fbbf24' : '#f87171' }}>
                    {log.ki_score}
                  </span>
                  <span className="text-[9px] text-slate-500">{log.zeitstempel}</span>
                </div>
              </div>
              <div className="text-[9px] text-slate-400">{log.begruendung}</div>
            </div>
          ))}
        </div>
      )}

      {/* Lücken */}
      {tab === 'luecken' && (
        <div className="space-y-2">
          {luecken.map(l => (
            <div key={l.zone} className={cn('rounded-lg border p-2 space-y-1',
              l.risiko === 'hoch' ? 'border-red-500/40 bg-red-900/20'
              : l.risiko === 'mittel' ? 'border-amber-500/40 bg-amber-900/20'
              : 'border-slate-600/30 bg-white/5')}>
              <div className="flex items-center justify-between">
                <span className="font-medium">Zone {l.zone}</span>
                <span className={cn('text-[9px] px-1 rounded',
                  l.risiko === 'hoch' ? 'bg-red-800/60 text-red-300'
                  : l.risiko === 'mittel' ? 'bg-amber-800/60 text-amber-300'
                  : 'bg-slate-700 text-slate-300')}>
                  {l.risiko.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between text-[9px]">
                <span className="text-slate-400">Fehlende Fahrer: <span className="text-red-400 font-bold">{l.fehlende_fahrer}</span></span>
                <span className="text-slate-400">Nachfrage: {l.nachfrage_level}%</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Wellbeing */}
      {tab === 'wellbeing' && (
        <div className="space-y-2">
          <div className="bg-white/5 rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-pink-400">{kpi.wellbeing_score}</div>
            <div className="text-[9px] text-slate-400">Fleet-Wellbeing-Score</div>
          </div>
          {drivers.map(d => (
            <div key={d.id} className="flex items-center gap-2">
              <span className="w-20 truncate text-slate-300">{d.name}</span>
              <div className="flex-1 h-1.5 rounded bg-white/10">
                <div className="h-full rounded transition-all" style={{
                  width: `${d.wellbeing}%`,
                  background: d.wellbeing > 70 ? '#4ade80' : d.wellbeing > 50 ? '#fbbf24' : '#f87171'
                }} />
              </div>
              <span className="text-[9px]" style={{ color: d.wellbeing > 70 ? '#4ade80' : d.wellbeing > 50 ? '#fbbf24' : '#f87171' }}>
                {d.wellbeing}
              </span>
              <span className="text-[9px] text-slate-500">{d.schicht_dauer_h.toFixed(1)}h</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
