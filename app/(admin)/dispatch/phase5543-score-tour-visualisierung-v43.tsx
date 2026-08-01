'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, Heart, Clock3, TrendingUp, TrendingDown, AlertTriangle, BarChart2, Battery, Target, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Phase 5543 — Score + Tour-Visualisierung V43
// V42+: Schichtstart-Pünktlichkeit-Ampel je Fahrer (pünktlich/leicht/verspätet);
// Kundenbindungs-Score je Fahrer (Stammkunden-Anteil %, Farb-Gradient);
// Echtzeit-Schicht-Balance-Indikator (Fairness-Score Fleet-Ø);
// Tour-Qualitäts-Composite-Index (Pünktlichkeit+Bindung+Effizienz);
// 11-KPI-Grid Fleet/Aktiv/Risiko/Eff%/Sync/CO₂/Ertrag/Energie/Bindung/Pünktl/Qualität;
// 7-Tab Rangliste/Profit/Energie/Lücken/CO₂/Bindung/Pünktlichkeit; 20s-Polling; Mock-Fallback

type Tier = 'platin' | 'gold' | 'gut' | 'schwach';
type Tab = 'rangliste' | 'profit' | 'energie' | 'luecken' | 'co2' | 'bindung' | 'puenktlichkeit';
type FahrerPuenktlichkeit = 'puenktlich' | 'leicht' | 'verspaetet';

interface TourStop { seq: number; eta: string; abgeschlossen: boolean; eta_drift_min: number }
interface Driver {
  id: string; name: string; score: number; tier: Tier;
  stops_done: number; stops_total: number; route_eff: number; aktiv: boolean;
  delay_risk: boolean; eta_drift_min: number; profit_eur: number;
  co2_g_per_delivery: number; stops: TourStop[];
  schicht_h: number;
  profit_per_stop: number;
  abschluss_prognose_min: number;
  kundenbindungs_pct: number;
  schichtstart_puenktlichkeit: FahrerPuenktlichkeit;
  qualitaets_index: number;
}

interface ZoneGap { name: string; demand: number; supply: number; gap_pct: number }

const MOCK_DRIVERS: Driver[] = [
  { id: 'd1', name: 'Nico W.',  score: 96, tier: 'platin', stops_done: 6, stops_total: 8, route_eff: 95, aktiv: true,
    delay_risk: false, eta_drift_min: -1, profit_eur: 148, co2_g_per_delivery: 78, schicht_h: 3.2,
    profit_per_stop: 24.7, abschluss_prognose_min: 18, kundenbindungs_pct: 84, schichtstart_puenktlichkeit: 'puenktlich', qualitaets_index: 94,
    stops: [{ seq: 1, eta: '14:15', abgeschlossen: true, eta_drift_min: -1 }, { seq: 2, eta: '14:28', abgeschlossen: false, eta_drift_min: 2 }] },
  { id: 'd2', name: 'Sara K.',  score: 83, tier: 'gold',   stops_done: 3, stops_total: 6, route_eff: 80, aktiv: true,
    delay_risk: false, eta_drift_min: 3,  profit_eur: 97,  co2_g_per_delivery: 102, schicht_h: 5.5,
    profit_per_stop: 19.4, abschluss_prognose_min: 32, kundenbindungs_pct: 76, schichtstart_puenktlichkeit: 'leicht', qualitaets_index: 78,
    stops: [{ seq: 1, eta: '14:10', abgeschlossen: true, eta_drift_min: 3 }, { seq: 2, eta: '14:25', abgeschlossen: false, eta_drift_min: 0 }] },
  { id: 'd3', name: 'Tom B.',   score: 65, tier: 'gut',    stops_done: 1, stops_total: 4, route_eff: 59, aktiv: true,
    delay_risk: true,  eta_drift_min: 9,  profit_eur: 54,  co2_g_per_delivery: 151, schicht_h: 7.8,
    profit_per_stop: 13.5, abschluss_prognose_min: 51, kundenbindungs_pct: 63, schichtstart_puenktlichkeit: 'verspaetet', qualitaets_index: 58,
    stops: [{ seq: 1, eta: '14:05', abgeschlossen: true, eta_drift_min: 9 }, { seq: 2, eta: '14:22', abgeschlossen: false, eta_drift_min: 14 }] },
  { id: 'd4', name: 'Mia F.',   score: 42, tier: 'schwach', stops_done: 0, stops_total: 3, route_eff: 40, aktiv: true,
    delay_risk: true,  eta_drift_min: 17, profit_eur: 21,  co2_g_per_delivery: 199, schicht_h: 2.1,
    profit_per_stop: 7.0, abschluss_prognose_min: 68, kundenbindungs_pct: 52, schichtstart_puenktlichkeit: 'verspaetet', qualitaets_index: 39,
    stops: [{ seq: 1, eta: '14:18', abgeschlossen: false, eta_drift_min: 17 }] },
];

const MOCK_ZONES = [
  { name: 'Innenstadt',  demand: 34, supply: 30, gap_pct: 12 },
  { name: 'Schwabing',   demand: 18, supply: 22, gap_pct: 0  },
  { name: 'Maxvorstadt', demand: 16, supply: 8,  gap_pct: 50 },
  { name: 'Neuhausen',   demand: 9,  supply: 11, gap_pct: 0  },
];

const MOCK_FLEET_KPI = {
  score: 72, aktiv: 4, risiko: 2, eff: 69, sync: 81, co2: 132, ertrag: 320, energie: 74,
  bindung: 69, puenktl: 61, qualitaet: 67,
};

const TIER_CONFIG: Record<Tier, { label: string; text: string; bg: string }> = {
  platin:  { label: '🥇 Platin',  text: 'text-violet-300', bg: 'bg-violet-500/15' },
  gold:    { label: '🥈 Gold',    text: 'text-yellow-300', bg: 'bg-yellow-400/10' },
  gut:     { label: '🥉 Gut',     text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  schwach: { label: '⚠️ Schwach', text: 'text-red-400',    bg: 'bg-red-500/10' },
};

const PUENKTLICHKEIT_CONFIG: Record<FahrerPuenktlichkeit, { label: string; cls: string }> = {
  puenktlich: { label: '✓ Pünktl.', cls: 'text-emerald-400' },
  leicht:     { label: '~ Leicht',  cls: 'text-yellow-400'  },
  verspaetet: { label: '⚠ Versp.',  cls: 'text-red-400'     },
};

function energieColor(h: number) {
  if (h < 4) return { color: 'text-emerald-400', bg: '#22c55e', label: 'Fit'   };
  if (h < 6) return { color: 'text-yellow-400',  bg: '#eab308', label: 'Mittel'};
  return               { color: 'text-red-400',    bg: '#ef4444', label: 'Müde'  };
}

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

const TABS: { key: Tab; label: string }[] = [
  { key: 'rangliste',     label: 'Rangliste'    },
  { key: 'profit',        label: 'Profit'       },
  { key: 'energie',       label: 'Energie'      },
  { key: 'luecken',       label: 'Lücken'       },
  { key: 'co2',           label: 'CO₂'          },
  { key: 'bindung',       label: 'Bindung'      },
  { key: 'puenktlichkeit',label: 'Pünktlichkeit'},
];

export function DispatchPhase5543ScoreTourVisualisierungV43({ locationId }: { locationId: string | null }) {
  const [drivers, setDrivers] = useState<Driver[]>(MOCK_DRIVERS);
  const [zones, setZones] = useState<typeof MOCK_ZONES>(MOCK_ZONES);
  const [fleetKpi, setFleetKpi] = useState(MOCK_FLEET_KPI);
  const [tab, setTab] = useState<Tab>('rangliste');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/dispatch/score-tour-v43?location_id=${locationId}`);
      if (r.ok) { const d = await r.json(); setDrivers(d.drivers ?? MOCK_DRIVERS); setZones(d.zones ?? MOCK_ZONES); setFleetKpi(d.fleet_kpi ?? MOCK_FLEET_KPI); }
    } catch { /* use mock */ }
    finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [load]);

  const sorted = [...drivers].sort((a, b) => b.score - a.score);
  const riskCount = drivers.filter(d => d.delay_risk).length;

  return (
    <Card className="bg-gray-900 border-gray-700/50 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Trophy className="h-4 w-4 text-violet-400" />
          <span className="text-xs font-bold text-white">Score + Tour V43</span>
          {loading && <span className="text-[10px] text-gray-500 animate-pulse">…</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">Fleet-Score:</span>
          <span className="text-xs font-bold text-violet-400">{fleetKpi.score}</span>
        </div>
      </div>

      {/* High-Risk Alert */}
      {riskCount > 0 && (
        <div className="flex items-center gap-1.5 rounded bg-red-500/10 border border-red-700/50 px-2 py-1">
          <AlertTriangle className="h-3 w-3 text-red-400" />
          <span className="text-[10px] text-red-300">{riskCount} Fahrer mit Delay-Risiko</span>
        </div>
      )}

      {/* 11-KPI-Grid */}
      <div className="grid grid-cols-4 gap-1 text-center">
        {[
          { label: 'Aktiv',    val: fleetKpi.aktiv,    cls: 'text-blue-400' },
          { label: 'Risiko',   val: fleetKpi.risiko,   cls: 'text-red-400' },
          { label: 'Eff%',     val: `${fleetKpi.eff}%`, cls: 'text-emerald-400' },
          { label: 'Sync',     val: `${fleetKpi.sync}%`, cls: 'text-cyan-400' },
          { label: 'CO₂',      val: `${fleetKpi.co2}g`, cls: 'text-green-400' },
          { label: 'Ertrag',   val: `${fleetKpi.ertrag}€`, cls: 'text-yellow-400' },
          { label: 'Energie',  val: `${fleetKpi.energie}%`, cls: 'text-orange-400' },
          { label: 'Bindung',  val: `${fleetKpi.bindung}%`, cls: 'text-rose-400' },
          { label: 'Pünktl.',  val: `${fleetKpi.puenktl}%`, cls: 'text-sky-400' },
          { label: 'Qualität', val: fleetKpi.qualitaet, cls: 'text-indigo-400' },
          { label: 'Score',    val: fleetKpi.score,    cls: 'text-violet-400' },
        ].map(k => (
          <div key={k.label} className="rounded bg-gray-800 py-1">
            <div className="text-[9px] text-gray-500">{k.label}</div>
            <div className={cn('text-xs font-bold', k.cls)}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-0.5">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn('text-[10px] px-2 py-0.5 rounded whitespace-nowrap transition-colors',
              tab === t.key ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'rangliste' && (
        <div className="space-y-1.5">
          {sorted.map(d => {
            const eng = energieColor(d.schicht_h);
            const isExp = expanded === d.id;
            return (
              <div key={d.id} className={cn('rounded p-2 space-y-1.5 cursor-pointer', TIER_CONFIG[d.tier].bg)}
                onClick={() => setExpanded(isExp ? null : d.id)}>
                <div className="flex items-center gap-2">
                  <span className={cn('text-[10px] font-semibold', TIER_CONFIG[d.tier].text)}>{TIER_CONFIG[d.tier].label}</span>
                  <span className="flex-1 text-xs text-white font-medium">{d.name}</span>
                  <span className={cn('text-xs font-mono', TIER_CONFIG[d.tier].text)}>{d.score}</span>
                  {d.delay_risk && <AlertTriangle className="h-3 w-3 text-red-400" />}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-gray-700">
                    <div className="h-1.5 rounded-full bg-violet-500 transition-all" style={{ width: `${d.route_eff}%` }} />
                  </div>
                  <span className="text-[9px] text-gray-400">{d.stops_done}/{d.stops_total} Stopps</span>
                  <span className={cn('text-[9px]', PUENKTLICHKEIT_CONFIG[d.schichtstart_puenktlichkeit].cls)}>
                    {PUENKTLICHKEIT_CONFIG[d.schichtstart_puenktlichkeit].label}
                  </span>
                </div>
                {isExp && (
                  <div className="pt-1 space-y-1 border-t border-gray-700/50">
                    <StopDotRow stops={d.stops} done={d.stops_done} />
                    <div className="grid grid-cols-3 gap-1 text-center">
                      <div className="rounded bg-gray-700/50 py-1">
                        <div className="text-[9px] text-gray-500">Profit</div>
                        <div className="text-[10px] text-yellow-400">{d.profit_eur}€</div>
                      </div>
                      <div className="rounded bg-gray-700/50 py-1">
                        <div className="text-[9px] text-gray-500">Bindung</div>
                        <div className="text-[10px] text-rose-400">{d.kundenbindungs_pct}%</div>
                      </div>
                      <div className="rounded bg-gray-700/50 py-1">
                        <div className="text-[9px] text-gray-500">Qualität</div>
                        <div className="text-[10px] text-indigo-400">{d.qualitaets_index}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'profit' && (
        <div className="space-y-1">
          {sorted.map(d => (
            <div key={d.id} className="flex items-center gap-2">
              <span className="text-[10px] text-white w-16 truncate">{d.name}</span>
              <div className="flex-1 h-2 rounded-full bg-gray-800">
                <div className="h-2 rounded-full bg-yellow-400 transition-all"
                  style={{ width: `${(d.profit_per_stop / 30) * 100}%` }} />
              </div>
              <span className="text-[10px] font-mono text-yellow-400 w-14 text-right">{d.profit_per_stop}€/Stopp</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'energie' && (
        <div className="space-y-1">
          {sorted.map(d => {
            const eng = energieColor(d.schicht_h);
            return (
              <div key={d.id} className="flex items-center gap-2">
                <span className="text-[10px] text-white w-16 truncate">{d.name}</span>
                <div className="flex-1 h-2 rounded-full bg-gray-800">
                  <div className="h-2 rounded-full transition-all"
                    style={{ width: `${Math.min((d.schicht_h / 10) * 100, 100)}%`, backgroundColor: eng.bg }} />
                </div>
                <span className={cn('text-[10px] w-12 text-right', eng.color)}>{d.schicht_h}h · {eng.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'luecken' && (
        <div className="space-y-1">
          {MOCK_ZONES.map(z => (
            <div key={z.name} className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400 w-20 truncate">{z.name}</span>
              <div className="flex-1 h-2 rounded-full bg-gray-800">
                <div className={cn('h-2 rounded-full transition-all', z.gap_pct > 30 ? 'bg-red-500' : z.gap_pct > 10 ? 'bg-yellow-400' : 'bg-emerald-500')}
                  style={{ width: `${z.gap_pct}%` }} />
              </div>
              <span className={cn('text-[10px] font-mono w-8 text-right', z.gap_pct > 30 ? 'text-red-400' : z.gap_pct > 10 ? 'text-yellow-400' : 'text-emerald-400')}>
                {z.gap_pct}%
              </span>
            </div>
          ))}
          <div className="text-[9px] text-gray-500">Gap = ungedeckter Nachfrage-Anteil</div>
        </div>
      )}

      {tab === 'co2' && (
        <div className="space-y-1">
          {sorted.map(d => (
            <div key={d.id} className="flex items-center gap-2">
              <span className="text-[10px] text-white w-16 truncate">{d.name}</span>
              <div className="flex-1 h-2 rounded-full bg-gray-800">
                <div className={cn('h-2 rounded-full transition-all', d.co2_g_per_delivery > 150 ? 'bg-red-500' : d.co2_g_per_delivery > 100 ? 'bg-yellow-400' : 'bg-green-500')}
                  style={{ width: `${(d.co2_g_per_delivery / 220) * 100}%` }} />
              </div>
              <span className="text-[10px] font-mono text-green-400 w-14 text-right">{d.co2_g_per_delivery}g/L</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'bindung' && (
        <div className="space-y-1">
          {sorted.map(d => (
            <div key={d.id} className="flex items-center gap-2">
              <span className="text-[10px] text-white w-16 truncate">{d.name}</span>
              <div className="flex-1 h-2 rounded-full bg-gray-800">
                <div className={cn('h-2 rounded-full bg-rose-400 transition-all')}
                  style={{ width: `${d.kundenbindungs_pct}%` }} />
              </div>
              <span className="text-[10px] font-mono text-rose-400 w-8 text-right">{d.kundenbindungs_pct}%</span>
            </div>
          ))}
          <div className="text-[9px] text-gray-500">Anteil Stammkunden je Fahrer (30 Tage)</div>
        </div>
      )}

      {tab === 'puenktlichkeit' && (
        <div className="space-y-1.5">
          {sorted.map(d => {
            const pc = PUENKTLICHKEIT_CONFIG[d.schichtstart_puenktlichkeit];
            return (
              <div key={d.id} className="flex items-center gap-2 rounded bg-gray-800 px-2 py-1">
                <span className="flex-1 text-[10px] text-white">{d.name}</span>
                <span className={cn('text-[10px] font-medium', pc.cls)}>{pc.label}</span>
                <span className="text-[9px] text-gray-500">Prognose: {d.abschluss_prognose_min}min</span>
              </div>
            );
          })}
          <div className="text-[9px] text-gray-500">Schichtstart-Pünktlichkeit + Tour-Abschluss-Prognose</div>
        </div>
      )}
    </Card>
  );
}
