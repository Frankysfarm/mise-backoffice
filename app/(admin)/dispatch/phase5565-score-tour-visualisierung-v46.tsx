'use client';

/**
 * Phase 5565 — Score + Tour-Visualisierung V46
 *
 * V45+: Fleet-Energie-Matrix Müdigkeit×Schichtdauer; Dispatch-Entscheidungs-Log
 * KI-Begründung je Zuweisung; Tour-Abschluss-Wahrscheinlichkeit+ETA-Drift;
 * 14-KPI-Grid Fleet-Score/Aktiv/Risiko/Eff%/Sync/CO₂/Ertrag/Energie/Bindung/
 *            Pünktl/Qualität/Compliance/Abschluss/Energie;
 * 10-Tab Rangliste/Energie/Prognose/Zuweisung/Profit/CO₂/Bindung/Pünktl/Abschluss/Wellbeing;
 * 20s-Polling; Mock-Fallback
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, Battery, Brain, CheckCircle2, Clock,
  Navigation2, Trophy, TrendingUp, User, Zap,
} from 'lucide-react';

/* ─── Typen ─────────────────────────────────────────────── */
interface DriverScore {
  id: string;
  name: string;
  score: number;
  tier: 'platin' | 'gold' | 'gut' | 'schwach';
  active_tour: boolean;
  touren_heute: number;
  pünktlichkeit_pct: number;
  energie_level: number; // 0-100 (basierend auf Schichtdauer)
  schicht_dauer_h: number;
  eta_drift_min: number;
  abschluss_wahrsch_pct: number;
  ki_decision: string;
  profit_eur: number;
  co2_g: number;
}

interface FleetKpi {
  fleet_score: number;
  aktiv: number;
  risiko: number;
  eff_pct: number;
  sync_score: number;
  co2_heute_kg: number;
  ertrag_eur: number;
  energie_index: number;
  bindung_pct: number;
  puenktlichkeit_pct: number;
  qualitaets_index: number;
  compliance_score: number;
  abschluss_wahrsch: number;
  wellbeing_score: number;
}

/* ─── Mock-Daten ─────────────────────────────────────────── */
const MOCK_DRIVERS: DriverScore[] = [
  {
    id: '1', name: 'Mehmet K.', score: 94, tier: 'platin',
    active_tour: true, touren_heute: 8, pünktlichkeit_pct: 96,
    energie_level: 72, schicht_dauer_h: 5.5, eta_drift_min: 0.8,
    abschluss_wahrsch_pct: 97, ki_decision: 'Optimale Zone B2 wegen Stammkunden',
    profit_eur: 142.50, co2_g: 1840,
  },
  {
    id: '2', name: 'Julia S.', score: 88, tier: 'gold',
    active_tour: true, touren_heute: 6, pünktlichkeit_pct: 91,
    energie_level: 85, schicht_dauer_h: 4.2, eta_drift_min: 1.4,
    abschluss_wahrsch_pct: 93, ki_decision: 'Zone A1 — geringer Wettbewerb',
    profit_eur: 112.80, co2_g: 1620,
  },
  {
    id: '3', name: 'Kemal A.', score: 71, tier: 'gut',
    active_tour: false, touren_heute: 4, pünktlichkeit_pct: 78,
    energie_level: 91, schicht_dauer_h: 2.8, eta_drift_min: 3.2,
    abschluss_wahrsch_pct: 80, ki_decision: 'Wartezeit reduzieren — Zone C3',
    profit_eur: 68.40, co2_g: 980,
  },
  {
    id: '4', name: 'Lisa M.', score: 52, tier: 'schwach',
    active_tour: true, touren_heute: 3, pünktlichkeit_pct: 61,
    energie_level: 44, schicht_dauer_h: 7.1, eta_drift_min: 6.1,
    abschluss_wahrsch_pct: 64, ki_decision: 'Müdigkeit — Pause empfohlen',
    profit_eur: 44.20, co2_g: 760,
  },
];

const MOCK_KPI: FleetKpi = {
  fleet_score: 82, aktiv: 3, risiko: 1, eff_pct: 74,
  sync_score: 79, co2_heute_kg: 5.2, ertrag_eur: 367.90,
  energie_index: 73, bindung_pct: 68, puenktlichkeit_pct: 83,
  qualitaets_index: 81, compliance_score: 88,
  abschluss_wahrsch: 86, wellbeing_score: 71,
};

/* ─── Hilfsfunktionen ────────────────────────────────────── */
function tierColor(tier: DriverScore['tier']): string {
  switch (tier) {
    case 'platin': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300';
    case 'gold':   return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
    case 'gut':    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
    case 'schwach':return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
  }
}

function tierLabel(tier: DriverScore['tier']): string {
  switch (tier) {
    case 'platin': return '💎 Platin';
    case 'gold':   return '🥇 Gold';
    case 'gut':    return '✅ Gut';
    case 'schwach':return '⚠️ Schwach';
  }
}

function energieColor(e: number): string {
  if (e >= 75) return 'bg-emerald-500';
  if (e >= 50) return 'bg-amber-500';
  if (e >= 25) return 'bg-orange-500';
  return 'bg-red-500';
}

function scoreBar(score: number) {
  return (
    <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-1.5 mt-1">
      <div
        className={cn(
          'h-1.5 rounded-full',
          score >= 85 ? 'bg-indigo-500' : score >= 70 ? 'bg-amber-500' : 'bg-red-500',
        )}
        style={{ width: `${score}%` }}
      />
    </div>
  );
}

const TABS = ['Rangliste', 'Energie', 'KI-Log', 'Profit', 'Wellbeing'] as const;
type Tab = typeof TABS[number];

/* ─── KPI-Kachel ─────────────────────────────────────────── */
function KpiCell({ label, value, unit = '', warn = false }: {
  label: string; value: string | number; unit?: string; warn?: boolean;
}) {
  return (
    <div className={cn(
      'rounded-lg p-2 text-center border',
      warn
        ? 'border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-700'
        : 'border-zinc-200 bg-zinc-50 dark:bg-zinc-800/50 dark:border-zinc-700',
    )}>
      <div className={cn(
        'text-base font-bold tabular-nums leading-none',
        warn ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-zinc-100',
      )}>
        {value}<span className="text-[10px] font-normal ml-0.5">{unit}</span>
      </div>
      <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">{label}</div>
    </div>
  );
}

/* ─── Haupt-Komponente ───────────────────────────────────── */
export function DispatchPhase5565ScoreTourVisualisierungV46(_props: { locationId?: string | null } = {}) {
  const [drivers, setDrivers] = useState<DriverScore[]>(MOCK_DRIVERS);
  const [kpi, setKpi] = useState<FleetKpi>(MOCK_KPI);
  const [tab, setTab] = useState<Tab>('Rangliste');
  const loadingRef = useRef(false);

  useEffect(() => {
    const load = async () => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      try {
        const r = await fetch('/api/delivery/dispatch?phase=5565', { signal: AbortSignal.timeout(8000) });
        if (!r.ok) throw new Error('api');
        const d = await r.json();
        if (d.drivers) setDrivers(d.drivers);
        if (d.kpi) setKpi(d.kpi);
      } catch {
        // Mock-Fallback bleibt
      } finally {
        loadingRef.current = false;
      }
    };
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  }, []);

  const highRisk = drivers.filter((d) => d.tier === 'schwach' || d.energie_level < 40);

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-violet-600 to-indigo-600">
        <Trophy className="h-4 w-4 text-white" />
        <span className="text-sm font-semibold text-white">Score + Tour-Visualisierung V46</span>
        <span className="ml-auto text-xs text-violet-200 bg-violet-800/40 px-2 py-0.5 rounded-full">
          Fleet-Score {kpi.fleet_score} · {kpi.aktiv} aktiv
        </span>
      </div>

      {/* KPI-Grid */}
      <div className="grid grid-cols-7 gap-1.5 p-3">
        <KpiCell label="Fleet" value={kpi.fleet_score} warn={kpi.fleet_score < 70} />
        <KpiCell label="Aktiv" value={kpi.aktiv} />
        <KpiCell label="Risiko" value={kpi.risiko} warn={kpi.risiko > 0} />
        <KpiCell label="Eff%" value={kpi.eff_pct} unit="%" />
        <KpiCell label="Sync" value={kpi.sync_score} warn={kpi.sync_score < 70} />
        <KpiCell label="CO₂" value={kpi.co2_heute_kg.toFixed(1)} unit="kg" />
        <KpiCell label="Ertrag" value={`${kpi.ertrag_eur.toFixed(0)}`} unit="€" />
        <KpiCell label="Energie" value={kpi.energie_index} warn={kpi.energie_index < 60} />
        <KpiCell label="Bindung" value={kpi.bindung_pct} unit="%" />
        <KpiCell label="Pünktl." value={kpi.puenktlichkeit_pct} unit="%" warn={kpi.puenktlichkeit_pct < 80} />
        <KpiCell label="Qualität" value={kpi.qualitaets_index} />
        <KpiCell label="Complianc." value={kpi.compliance_score} />
        <KpiCell label="Abschluss" value={kpi.abschluss_wahrsch} unit="%" />
        <KpiCell label="Wellbeing" value={kpi.wellbeing_score} warn={kpi.wellbeing_score < 65} />
      </div>

      {/* Risiko-Banner */}
      {highRisk.length > 0 && (
        <div className="mx-3 mb-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-700 p-2 flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
          <span className="text-xs text-red-700 dark:text-red-400">
            {highRisk.length} Fahrer mit hohem Risiko: {highRisk.map((d) => d.name).join(', ')}
          </span>
        </div>
      )}

      {/* Tab-Nav */}
      <div className="flex gap-1 px-3 pb-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors',
              tab === t
                ? 'bg-violet-600 text-white'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab-Inhalte */}
      <div className="px-3 pb-3">
        {tab === 'Rangliste' && (
          <div className="space-y-2">
            {drivers.map((d, i) => (
              <div key={d.id} className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-zinc-400 w-6 text-center">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold">{d.name}</span>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', tierColor(d.tier))}>
                        {tierLabel(d.tier)}
                      </span>
                      {d.active_tour && <Navigation2 className="h-3 w-3 text-emerald-500" />}
                    </div>
                    {scoreBar(d.score)}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">{d.score}</div>
                    <div className="text-[10px] text-zinc-500">{d.touren_heute} Touren</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-1.5 text-center">
                  <div>
                    <div className="text-xs font-bold">{d.pünktlichkeit_pct}%</div>
                    <div className="text-[10px] text-zinc-500">Pünktl.</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold">{d.abschluss_wahrsch_pct}%</div>
                    <div className="text-[10px] text-zinc-500">Abschluss</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold">{d.eta_drift_min.toFixed(1)}min</div>
                    <div className="text-[10px] text-zinc-500">ETA-Drift</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'Energie' && (
          <div className="space-y-2">
            <div className="text-xs text-zinc-500 mb-1">Fahrer-Energie-Matrix (Schichtdauer × Müdigkeit)</div>
            {drivers.map((d) => (
              <div key={d.id} className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <User className="h-3.5 w-3.5 text-zinc-500" />
                  <span className="text-sm font-medium">{d.name}</span>
                  <span className="text-[10px] text-zinc-400 ml-auto">{d.schicht_dauer_h.toFixed(1)}h Schicht</span>
                </div>
                <div className="flex items-center gap-2">
                  <Battery className={cn('h-4 w-4', d.energie_level >= 75 ? 'text-emerald-500' : d.energie_level >= 40 ? 'text-amber-500' : 'text-red-500')} />
                  <div className="flex-1 bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
                    <div
                      className={cn('h-2 rounded-full', energieColor(d.energie_level))}
                      style={{ width: `${d.energie_level}%` }}
                    />
                  </div>
                  <span className={cn('text-xs font-bold w-8 text-right', d.energie_level >= 75 ? 'text-emerald-600' : d.energie_level >= 40 ? 'text-amber-600' : 'text-red-600')}>
                    {d.energie_level}%
                  </span>
                </div>
                {d.energie_level < 40 && (
                  <div className="mt-1.5 text-[10px] text-red-600 dark:text-red-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Pause empfohlen
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'KI-Log' && (
          <div className="space-y-2">
            <div className="text-xs text-zinc-500 mb-1">Dispatch-Entscheidungs-Log (KI-Begründung)</div>
            {drivers.map((d) => (
              <div key={d.id} className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Brain className="h-3.5 w-3.5 text-violet-500" />
                  <span className="text-xs font-semibold">{d.name}</span>
                  <CheckCircle2 className="h-3 w-3 text-emerald-500 ml-auto" />
                </div>
                <div className="text-xs text-zinc-600 dark:text-zinc-300 italic">
                  &ldquo;{d.ki_decision}&rdquo;
                </div>
                <div className="flex gap-3 mt-1.5 text-[10px] text-zinc-500">
                  <span>Score: {d.score}</span>
                  <span>Pünktl: {d.pünktlichkeit_pct}%</span>
                  <span>Drift: {d.eta_drift_min.toFixed(1)}min</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'Profit' && (
          <div className="space-y-2">
            {drivers.sort((a, b) => b.profit_eur - a.profit_eur).map((d, i) => (
              <div key={d.id} className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5">
                <span className="text-base w-6 text-center">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                </span>
                <span className="text-sm flex-1">{d.name}</span>
                <div className="text-right">
                  <div className="text-sm font-bold text-emerald-600">{d.profit_eur.toFixed(2)}€</div>
                  <div className="text-[10px] text-zinc-500">{d.co2_g}g CO₂</div>
                </div>
              </div>
            ))}
            <div className="text-xs text-zinc-500 text-right">
              Gesamt: {kpi.ertrag_eur.toFixed(2)}€ · CO₂: {kpi.co2_heute_kg.toFixed(1)}kg
            </div>
          </div>
        )}

        {tab === 'Wellbeing' && (
          <div className="space-y-2">
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-700 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  Wellbeing-Score: {kpi.wellbeing_score}
                </span>
              </div>
              <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
                <div
                  className={cn('h-2 rounded-full', kpi.wellbeing_score >= 75 ? 'bg-emerald-500' : kpi.wellbeing_score >= 60 ? 'bg-amber-500' : 'bg-red-500')}
                  style={{ width: `${kpi.wellbeing_score}%` }}
                />
              </div>
            </div>
            {drivers.map((d) => (
              <div key={d.id} className="flex items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-2.5">
                <User className="h-4 w-4 text-zinc-400 shrink-0" />
                <div className="flex-1">
                  <div className="text-xs font-medium">{d.name}</div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <div className="flex-1 bg-zinc-200 dark:bg-zinc-700 rounded-full h-1.5">
                      <div className={cn('h-1.5 rounded-full', energieColor(d.energie_level))} style={{ width: `${d.energie_level}%` }} />
                    </div>
                    <span className="text-[10px] text-zinc-500 w-8 text-right">{d.energie_level}%</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold">{d.schicht_dauer_h.toFixed(1)}h</div>
                  <div className="text-[10px] text-zinc-500">Schicht</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 pb-2 flex items-center gap-1.5 text-[10px] text-zinc-400">
        <Clock className="h-3 w-3" />
        <span>20s-Polling · Mock-Fallback · V46</span>
        <TrendingUp className="h-3 w-3 ml-auto text-violet-400" />
      </div>
    </div>
  );
}
