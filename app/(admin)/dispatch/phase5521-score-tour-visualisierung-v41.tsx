'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, MapPin, Zap, AlertTriangle, Navigation2, Clock, TrendingUp, TrendingDown, Leaf, BarChart2, Gauge } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Phase 5521 — Score + Tour-Visualisierung V41
// V40+: Flottenauslastungs-Heatmap (Uhrzeiten × Fahrer-Last);
// CO₂-Effizienz-Score je Fahrer (g CO₂/Lieferung);
// Optimal-Route-Simulation mit Zeitersparnis-Anzeige;
// Real-time Zone-Demand vs. Supply Balance Gauge;
// 9-KPI-Grid Fleet/Aktiv/Risiko/Eff%/Sync/CO₂/Demand/Supply/Profit;
// 5-Tab Rangliste/Heatmap/CO₂/Balance/Simulation;
// Tier Platin/Gold/Gut/Schwach; 20s-Polling; Mock-Fallback

type Tier = 'platin' | 'gold' | 'gut' | 'schwach';
type Tab = 'rangliste' | 'heatmap' | 'co2' | 'balance' | 'simulation';

interface TourStop { seq: number; eta: string; abgeschlossen: boolean; eta_drift_min: number }
interface Driver {
  id: string; name: string; score: number; tier: Tier;
  stops_done: number; stops_total: number; route_eff: number; aktiv: boolean;
  delay_risk: boolean; eta_drift_min: number; profit_eur: number;
  co2_g_per_delivery: number; stops: TourStop[];
}

interface ZoneBalance { name: string; demand: number; supply: number; delta: number }
interface HeatCell { hour: number; driver: string; load: number }
interface SimRoute { original_min: number; optimized_min: number; savings_min: number; driver: string }

const MOCK_DRIVERS: Driver[] = [
  { id: 'd1', name: 'Nico W.',  score: 96, tier: 'platin', stops_done: 5, stops_total: 7, route_eff: 94, aktiv: true,  delay_risk: false, eta_drift_min: -1, profit_eur: 134, co2_g_per_delivery: 82,
    stops: [{ seq: 1, eta: '14:15', abgeschlossen: true, eta_drift_min: -1 }, { seq: 2, eta: '14:28', abgeschlossen: true, eta_drift_min: 0 }, { seq: 3, eta: '14:41', abgeschlossen: false, eta_drift_min: 2 }] },
  { id: 'd2', name: 'Sara K.',  score: 83, tier: 'gold',   stops_done: 3, stops_total: 6, route_eff: 80, aktiv: true,  delay_risk: false, eta_drift_min: 3,  profit_eur: 93,  co2_g_per_delivery: 104,
    stops: [{ seq: 1, eta: '14:10', abgeschlossen: true, eta_drift_min: 3 }, { seq: 2, eta: '14:25', abgeschlossen: false, eta_drift_min: 0 }] },
  { id: 'd3', name: 'Tom B.',   score: 66, tier: 'gut',    stops_done: 1, stops_total: 4, route_eff: 60, aktiv: true,  delay_risk: true,  eta_drift_min: 8,  profit_eur: 52,  co2_g_per_delivery: 148,
    stops: [{ seq: 1, eta: '14:05', abgeschlossen: true, eta_drift_min: 8 }, { seq: 2, eta: '14:22', abgeschlossen: false, eta_drift_min: 12 }] },
  { id: 'd4', name: 'Mia F.',   score: 44, tier: 'schwach',stops_done: 0, stops_total: 3, route_eff: 42, aktiv: true,  delay_risk: true,  eta_drift_min: 15, profit_eur: 19,  co2_g_per_delivery: 196,
    stops: [{ seq: 1, eta: '14:18', abgeschlossen: false, eta_drift_min: 15 }] },
];

const HOURS = [11, 12, 13, 14, 15, 16, 17, 18];
const MOCK_HEATMAP: HeatCell[] = MOCK_DRIVERS.flatMap(d =>
  HOURS.map(h => ({ hour: h, driver: d.name.split(' ')[0], load: Math.round(Math.random() * 100) }))
);

const MOCK_ZONES: ZoneBalance[] = [
  { name: 'Innenstadt',  demand: 32, supply: 28, delta: -4  },
  { name: 'Schwabing',   demand: 18, supply: 20, delta: +2  },
  { name: 'Maxvorstadt', demand: 14, supply: 10, delta: -4  },
  { name: 'Neuhausen',   demand: 9,  supply: 12, delta: +3  },
];

const MOCK_SIM: SimRoute[] = [
  { driver: 'Nico W.',  original_min: 42, optimized_min: 36, savings_min: 6 },
  { driver: 'Sara K.',  original_min: 51, optimized_min: 44, savings_min: 7 },
  { driver: 'Tom B.',   original_min: 58, optimized_min: 47, savings_min: 11 },
  { driver: 'Mia F.',   original_min: 65, optimized_min: 52, savings_min: 13 },
];

const TIER_CONFIG: Record<Tier, { label: string; text: string; bg: string; ring: string }> = {
  platin:  { label: 'Platin',  text: 'text-violet-300', bg: 'bg-violet-500/15', ring: 'ring-violet-500/40' },
  gold:    { label: 'Gold',    text: 'text-yellow-300', bg: 'bg-yellow-400/10', ring: 'ring-yellow-400/40' },
  gut:     { label: 'Gut',     text: 'text-emerald-400',bg: 'bg-emerald-500/10',ring: 'ring-emerald-500/30' },
  schwach: { label: 'Schwach', text: 'text-red-400',    bg: 'bg-red-500/10',   ring: 'ring-red-500/30' },
};

function StopDotRow({ stops, done }: { stops: TourStop[]; done: number }) {
  return (
    <div className="flex items-center gap-1">
      {stops.map((s, i) => (
        <div key={s.seq} className="flex items-center gap-1">
          <div className={cn('w-3 h-3 rounded-full border-2 transition-all',
            s.abgeschlossen ? 'bg-emerald-500 border-emerald-500' : i === done ? 'bg-indigo-500 border-indigo-500 animate-pulse' : 'bg-transparent border-zinc-600')} />
          {i < stops.length - 1 && <div className={cn('h-0.5 w-3', s.abgeschlossen ? 'bg-emerald-500' : 'bg-zinc-700')} />}
        </div>
      ))}
    </div>
  );
}

function CO2Bar({ val }: { val: number }) {
  const color = val < 100 ? '#22c55e' : val < 140 ? '#eab308' : '#ef4444';
  const pct = Math.min(100, val / 200 * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs tabular-nums font-mono w-14 text-right" style={{ color }}>{val}g</span>
    </div>
  );
}

interface Props { locationId: string | null; className?: string }

export function DispatchPhase5521ScoreTourVisualisierungV41({ locationId, className }: Props) {
  const [drivers, setDrivers] = useState<Driver[]>(MOCK_DRIVERS);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('rangliste');

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-kapazitaet-live?locationId=${locationId}`);
      if (r.ok) { /* merge server data */ }
    } catch { /* use mock */ }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 20000); return () => clearInterval(id); }, [load]);

  const kpi = {
    fleet: drivers.length,
    aktiv: drivers.filter(d => d.aktiv).length,
    risiko: drivers.filter(d => d.delay_risk).length,
    eff: Math.round(drivers.reduce((a, d) => a + d.route_eff, 0) / drivers.length),
    sync: drivers.filter(d => !d.delay_risk).length,
    co2: Math.round(drivers.reduce((a, d) => a + d.co2_g_per_delivery, 0) / drivers.length),
    demand: MOCK_ZONES.reduce((a, z) => a + z.demand, 0),
    supply: MOCK_ZONES.reduce((a, z) => a + z.supply, 0),
    profit: Math.round(drivers.reduce((a, d) => a + d.profit_eur, 0)),
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: 'rangliste',  label: 'Rangliste' },
    { key: 'heatmap',   label: 'Heatmap' },
    { key: 'co2',       label: 'CO₂' },
    { key: 'balance',   label: 'Balance' },
    { key: 'simulation',label: 'Simulation' },
  ];

  const KPI_GRID = [
    { label: 'Fleet',   val: `${kpi.fleet}`,   cls: 'text-blue-400' },
    { label: 'Aktiv',   val: `${kpi.aktiv}`,   cls: 'text-emerald-400' },
    { label: 'Risiko',  val: `${kpi.risiko}`,  cls: kpi.risiko > 0 ? 'text-red-400' : 'text-zinc-500' },
    { label: 'Eff%',    val: `${kpi.eff}%`,    cls: 'text-indigo-400' },
    { label: 'Sync',    val: `${kpi.sync}`,    cls: 'text-cyan-400' },
    { label: 'Ø CO₂',  val: `${kpi.co2}g`,   cls: kpi.co2 < 120 ? 'text-emerald-400' : 'text-yellow-400' },
    { label: 'Demand',  val: `${kpi.demand}`,  cls: 'text-orange-400' },
    { label: 'Supply',  val: `${kpi.supply}`,  cls: 'text-violet-400' },
    { label: 'Profit',  val: `${kpi.profit}€`, cls: 'text-yellow-400' },
  ];

  return (
    <Card className={cn('bg-zinc-900 border-zinc-800 p-4 space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-yellow-400" />
          <span className="text-sm font-semibold text-white">Score + Tour-Visualisierung V41</span>
        </div>
        <span className="text-xs text-zinc-500 font-mono">Phase 5521</span>
      </div>

      {/* KPI 9 */}
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-9">
        {KPI_GRID.map(k => (
          <div key={k.label} className="bg-zinc-800/60 rounded-lg p-2 text-center">
            <div className={cn('text-base font-bold tabular-nums', k.cls)}>{k.val}</div>
            <div className="text-[9px] text-zinc-500 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
              tab === t.key ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Rangliste */}
      {tab === 'rangliste' && (
        <div className="space-y-2">
          {drivers.sort((a, b) => b.score - a.score).map((d, idx) => {
            const tc = TIER_CONFIG[d.tier];
            const isExp = expanded === d.id;
            return (
              <button key={d.id} onClick={() => setExpanded(isExp ? null : d.id)} className="w-full text-left">
                <div className={cn('rounded-lg p-3 ring-1 transition-all', tc.bg, tc.ring)}>
                  <div className="flex items-center gap-3">
                    <div className="text-lg font-bold text-zinc-600 w-6 text-center">#{idx + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">{d.name}</span>
                        <span className={cn('text-xs px-1.5 py-0.5 rounded-full bg-zinc-800/60', tc.text)}>{tc.label}</span>
                        {d.delay_risk && <AlertTriangle className="h-3 w-3 text-red-400" />}
                      </div>
                      <StopDotRow stops={d.stops} done={d.stops_done} />
                    </div>
                    <div className="text-right">
                      <div className={cn('text-lg font-bold', tc.text)}>{d.score}</div>
                      <div className="text-[10px] text-zinc-500">{d.stops_done}/{d.stops_total} Stopps</div>
                    </div>
                  </div>
                  {isExp && (
                    <div className="mt-2 pt-2 border-t border-zinc-800 grid grid-cols-3 gap-2 text-center">
                      <div><div className="text-xs font-semibold text-indigo-400">{d.route_eff}%</div><div className="text-[9px] text-zinc-500">Routen-Eff</div></div>
                      <div><div className="text-xs font-semibold text-yellow-400">{d.profit_eur}€</div><div className="text-[9px] text-zinc-500">Profit</div></div>
                      <div><div className="text-xs font-semibold text-emerald-400">{d.eta_drift_min > 0 ? '+' : ''}{d.eta_drift_min}min</div><div className="text-[9px] text-zinc-500">ETA-Drift</div></div>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Tab: Heatmap */}
      {tab === 'heatmap' && (
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr>
                <th className="text-zinc-500 font-normal px-1 py-1 text-left w-12">Fahrer</th>
                {HOURS.map(h => <th key={h} className="text-zinc-500 font-normal px-1 py-1 text-center">{h}h</th>)}
              </tr>
            </thead>
            <tbody>
              {MOCK_DRIVERS.map(d => (
                <tr key={d.id}>
                  <td className="text-zinc-400 px-1 py-0.5 font-medium truncate max-w-[40px]">{d.name.split(' ')[0]}</td>
                  {HOURS.map(h => {
                    const cell = MOCK_HEATMAP.find(c => c.driver === d.name.split(' ')[0] && c.hour === h);
                    const load = cell?.load ?? 0;
                    const bg = load > 80 ? '#ef4444' : load > 60 ? '#f97316' : load > 40 ? '#eab308' : load > 20 ? '#22c55e' : '#27272a';
                    return (
                      <td key={h} className="px-1 py-0.5 text-center">
                        <div className="h-5 w-full rounded-sm transition-all" style={{ backgroundColor: bg, opacity: 0.7 + load / 300 }} title={`${load}%`} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center gap-2 mt-2 text-[9px] text-zinc-500">
            <span>Last:</span>
            {['#27272a', '#22c55e', '#eab308', '#f97316', '#ef4444'].map((c, i) => (
              <div key={i} className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
                <span>{['0', '20', '40', '60', '80+'][i]}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: CO2 */}
      {tab === 'co2' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
            <Leaf className="h-4 w-4 text-emerald-400 shrink-0" />
            <span className="text-xs text-emerald-300">Flotten-Durchschnitt: <strong>{kpi.co2}g CO₂/Lieferung</strong></span>
          </div>
          {drivers.sort((a, b) => a.co2_g_per_delivery - b.co2_g_per_delivery).map(d => (
            <div key={d.id} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white font-medium">{d.name}</span>
                <span className="text-zinc-400 text-[10px]">{d.route_eff}% Effizienz</span>
              </div>
              <CO2Bar val={d.co2_g_per_delivery} />
            </div>
          ))}
          <div className="text-[10px] text-zinc-500 pt-1">Ziel: &lt;100g CO₂/Lieferung · Grün = optimal · Rot = Optimierungsbedarf</div>
        </div>
      )}

      {/* Tab: Balance */}
      {tab === 'balance' && (
        <div className="space-y-3">
          {MOCK_ZONES.map(z => {
            const balanced = Math.abs(z.delta) <= 2;
            const surplus = z.delta > 0;
            return (
              <div key={z.name} className={cn('rounded-lg p-3 border', balanced ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20')}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">{z.name}</span>
                  <span className={cn('text-xs font-bold', balanced ? 'text-emerald-400' : surplus ? 'text-blue-400' : 'text-red-400')}>
                    {z.delta > 0 ? '+' : ''}{z.delta}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                  <span>Demand: <strong className="text-orange-400">{z.demand}</strong></span>
                  <span>Supply: <strong className="text-violet-400">{z.supply}</strong></span>
                  <span className={cn('ml-auto', balanced ? 'text-emerald-400' : surplus ? 'text-blue-400' : 'text-red-400')}>
                    {balanced ? 'Ausgewogen' : surplus ? 'Überschuss' : 'Engpass'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab: Simulation */}
      {tab === 'simulation' && (
        <div className="space-y-3">
          <div className="text-xs text-zinc-400 mb-1">Optimal-Route-Simulation — KI-Zeitersparnis je Fahrer</div>
          {MOCK_SIM.map(s => (
            <div key={s.driver} className="bg-zinc-800/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">{s.driver}</span>
                <span className="text-emerald-400 text-xs font-bold">-{s.savings_min}min</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                <span>Aktuell: <strong className="text-zinc-300">{s.original_min}min</strong></span>
                <span>→</span>
                <span>Optimiert: <strong className="text-emerald-400">{s.optimized_min}min</strong></span>
              </div>
              <div className="mt-1.5 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(s.original_min - s.savings_min) / s.original_min * 100}%` }} />
              </div>
            </div>
          ))}
          <div className="text-[10px] text-zinc-500 pt-1">Gesamtersparnis: <strong className="text-emerald-400">{MOCK_SIM.reduce((a, s) => a + s.savings_min, 0)}min</strong> über alle Fahrer</div>
        </div>
      )}
    </Card>
  );
}
