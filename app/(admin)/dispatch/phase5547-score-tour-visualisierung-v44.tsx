'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, Heart, Clock3, TrendingUp, TrendingDown, AlertTriangle, BarChart2, Target, Users, RefreshCw, Smile } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Phase 5547 — Score + Tour-Visualisierung V44
// V43+: Tour-Abschluss-Zeitfenster je Fahrer (prognostizierte Fertigstellung ±min);
// Schicht-Wellbeing-Score (Müdigkeits-Indikator Schichtdauer+Pausen+Bewertung, 0–100);
// Zonen-Fairness-Index (Verteilungs-Gleichheit der Aufträge über Zonen, 0–100);
// Übergabe-Erfolgsquote Fleet-Ø (pünktliche Übergaben / gesamt);
// 12-KPI-Grid Fleet/Aktiv/Risiko/Eff%/Sync/CO₂/Ertrag/Energie/Bindung/Pünktl/Wellb/Fairness;
// 8-Tab Rangliste/Profit/Energie/Lücken/CO₂/Bindung/Abschluss/Wellbeing; 20s-Polling; Mock-Fallback

type Tier = 'platin' | 'gold' | 'gut' | 'schwach';
type Tab = 'rangliste' | 'profit' | 'energie' | 'luecken' | 'co2' | 'bindung' | 'abschluss' | 'wellbeing';

interface TourStop { seq: number; eta: string; abgeschlossen: boolean; eta_drift_min: number }
interface Driver {
  id: string; name: string; score: number; tier: Tier;
  stops_done: number; stops_total: number; route_eff: number; aktiv: boolean;
  delay_risk: boolean; eta_drift_min: number; profit_eur: number;
  co2_g_per_delivery: number; stops: TourStop[];
  schicht_h: number; profit_per_stop: number;
  abschluss_prognose_min: number; kundenbindungs_pct: number;
  wellbeing_score: number; abschluss_fenster_min: number;
  uebergabe_erfolg_pct: number;
}

interface ZoneGap { name: string; demand: number; supply: number; gap_pct: number }

const MOCK_DRIVERS: Driver[] = [
  { id: 'd1', name: 'Nico W.',  score: 96, tier: 'platin', stops_done: 6, stops_total: 8, route_eff: 95, aktiv: true,
    delay_risk: false, eta_drift_min: -1, profit_eur: 148, co2_g_per_delivery: 78,  schicht_h: 3.2,
    profit_per_stop: 24.7, abschluss_prognose_min: 18, kundenbindungs_pct: 84,
    wellbeing_score: 88, abschluss_fenster_min: -3, uebergabe_erfolg_pct: 96,
    stops: [{ seq: 1, eta: '14:15', abgeschlossen: true, eta_drift_min: -1 }, { seq: 2, eta: '14:28', abgeschlossen: false, eta_drift_min: 2 }] },
  { id: 'd2', name: 'Sara K.',  score: 83, tier: 'gold',   stops_done: 3, stops_total: 6, route_eff: 80, aktiv: true,
    delay_risk: false, eta_drift_min: 3,  profit_eur: 97, co2_g_per_delivery: 102, schicht_h: 5.5,
    profit_per_stop: 19.4, abschluss_prognose_min: 32, kundenbindungs_pct: 76,
    wellbeing_score: 66, abschluss_fenster_min: 5, uebergabe_erfolg_pct: 89,
    stops: [{ seq: 1, eta: '14:10', abgeschlossen: true, eta_drift_min: 3 }, { seq: 2, eta: '14:25', abgeschlossen: false, eta_drift_min: 0 }] },
  { id: 'd3', name: 'Tom B.',   score: 65, tier: 'gut',    stops_done: 1, stops_total: 4, route_eff: 59, aktiv: true,
    delay_risk: true,  eta_drift_min: 9,  profit_eur: 54, co2_g_per_delivery: 151, schicht_h: 7.8,
    profit_per_stop: 13.5, abschluss_prognose_min: 51, kundenbindungs_pct: 63,
    wellbeing_score: 42, abschluss_fenster_min: 12, uebergabe_erfolg_pct: 78,
    stops: [{ seq: 1, eta: '14:05', abgeschlossen: true, eta_drift_min: 9 }, { seq: 2, eta: '14:22', abgeschlossen: false, eta_drift_min: 14 }] },
  { id: 'd4', name: 'Mia F.',   score: 42, tier: 'schwach', stops_done: 0, stops_total: 3, route_eff: 40, aktiv: true,
    delay_risk: true,  eta_drift_min: 17, profit_eur: 21, co2_g_per_delivery: 199, schicht_h: 2.1,
    profit_per_stop: 7.0, abschluss_prognose_min: 74, kundenbindungs_pct: 51,
    wellbeing_score: 81, abschluss_fenster_min: 20, uebergabe_erfolg_pct: 70,
    stops: [{ seq: 1, eta: '14:18', abgeschlossen: false, eta_drift_min: 17 }] },
];

const MOCK_GAPS: ZoneGap[] = [
  { name: 'Mitte',   demand: 18, supply: 12, gap_pct: 33 },
  { name: 'Nord',    demand: 10, supply: 9,  gap_pct: 10 },
  { name: 'Süd',     demand: 14, supply: 15, gap_pct: 0  },
  { name: 'Ost',     demand: 8,  supply: 4,  gap_pct: 50 },
];

const MOCK_KPI = {
  fleet: 4, aktiv: 4, risiko: 2, eff_pct: 70, sync: 84, co2_avg: 133,
  ertrag: 320, energie: 66, bindung: 69, puenktl: 87, wellb: 69, fairness: 74,
};

const ZONE_FAIRNESS = 74;

const TIER_CLS: Record<Tier, string> = {
  platin: 'text-sky-300', gold: 'text-yellow-300', gut: 'text-emerald-400', schwach: 'text-gray-400',
};

const TABS: { key: Tab; label: string }[] = [
  { key: 'rangliste',  label: 'Rangliste'  },
  { key: 'profit',     label: 'Profit'     },
  { key: 'energie',    label: 'Energie'    },
  { key: 'luecken',    label: 'Lücken'     },
  { key: 'co2',        label: 'CO₂'        },
  { key: 'bindung',    label: 'Bindung'    },
  { key: 'abschluss',  label: 'Abschluss'  },
  { key: 'wellbeing',  label: 'Wellbeing'  },
];

export function DispatchPhase5547ScoreTourVisualisierungV44({ locationId }: { locationId: string | null }) {
  const [drivers, setDrivers] = useState<Driver[]>(MOCK_DRIVERS);
  const [gaps, setGaps] = useState<ZoneGap[]>(MOCK_GAPS);
  const [kpi, setKpi] = useState(MOCK_KPI);
  const [tab, setTab] = useState<Tab>('rangliste');

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/dispatch/score-tour-v44?location_id=${locationId}`);
      if (r.ok) {
        const d = await r.json();
        setDrivers(d.drivers ?? MOCK_DRIVERS);
        setGaps(d.gaps ?? MOCK_GAPS);
        setKpi(d.kpi ?? MOCK_KPI);
      }
    } catch { /* use mock */ }
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  }, [load]);

  const sorted = [...drivers].sort((a, b) => b.score - a.score);

  return (
    <Card className="bg-gray-900 border-gray-700/50 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Trophy className="h-4 w-4 text-violet-400" />
          <span className="text-xs font-bold text-white">Tour-Visualisierung V44</span>
        </div>
        <span className="text-[10px] text-gray-500">Fairness: <span className={cn('font-bold', ZONE_FAIRNESS >= 80 ? 'text-emerald-400' : ZONE_FAIRNESS >= 60 ? 'text-yellow-400' : 'text-red-400')}>{ZONE_FAIRNESS}</span></span>
      </div>

      {/* 12-KPI-Grid */}
      <div className="grid grid-cols-4 gap-1 text-center">
        {[
          { label: 'Fleet',    val: kpi.fleet,    cls: 'text-sky-400'     },
          { label: 'Aktiv',    val: kpi.aktiv,    cls: 'text-emerald-400' },
          { label: 'Risiko',   val: kpi.risiko,   cls: 'text-red-400'     },
          { label: 'Eff%',     val: `${kpi.eff_pct}%`, cls: 'text-indigo-400' },
          { label: 'Sync',     val: kpi.sync,     cls: 'text-cyan-400'    },
          { label: 'CO₂avg',   val: kpi.co2_avg,  cls: 'text-green-400'   },
          { label: 'Ertrag€',  val: kpi.ertrag,   cls: 'text-yellow-300'  },
          { label: 'Energie',  val: kpi.energie,  cls: 'text-orange-400'  },
          { label: 'Bindung',  val: `${kpi.bindung}%`, cls: 'text-rose-400' },
          { label: 'Pünktl',   val: `${kpi.puenktl}%`, cls: 'text-teal-400' },
          { label: 'Wellb',    val: kpi.wellb,    cls: 'text-pink-400'    },
          { label: 'Fairness', val: kpi.fairness, cls: 'text-violet-400'  },
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
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('text-[10px] px-2 py-0.5 rounded whitespace-nowrap transition-colors',
              tab === t.key ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'rangliste' && (
        <div className="space-y-1.5">
          {sorted.map((d, i) => (
            <div key={d.id} className="flex items-center gap-2 rounded bg-gray-800 px-2 py-1.5">
              <span className="text-[10px] text-gray-500 w-4">{i + 1}</span>
              <span className="flex-1 text-[10px] text-white font-medium">{d.name}</span>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-16 rounded-full bg-gray-700">
                  <div className={cn('h-1.5 rounded-full', d.tier === 'platin' ? 'bg-sky-400' : d.tier === 'gold' ? 'bg-yellow-400' : d.tier === 'gut' ? 'bg-emerald-500' : 'bg-gray-500')}
                    style={{ width: `${d.score}%` }} />
                </div>
                <span className={cn('text-xs font-bold w-6 text-right', TIER_CLS[d.tier])}>{d.score}</span>
                {d.delay_risk && <AlertTriangle className="h-3 w-3 text-red-400" />}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'profit' && (
        <div className="space-y-1">
          {sorted.map(d => (
            <div key={d.id} className="flex items-center gap-2 rounded bg-gray-800 px-2 py-1">
              <span className="flex-1 text-[10px] text-gray-300">{d.name}</span>
              <span className="text-[10px] text-yellow-300 font-mono">{d.profit_eur}€</span>
              <span className="text-[9px] text-gray-500">{d.profit_per_stop.toFixed(1)}€/Stop</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'energie' && (
        <div className="space-y-1">
          {sorted.map(d => (
            <div key={d.id} className="flex items-center gap-2 rounded bg-gray-800 px-2 py-1">
              <span className="flex-1 text-[10px] text-gray-300">{d.name}</span>
              <div className="h-1.5 w-16 rounded-full bg-gray-700">
                <div className={cn('h-1.5 rounded-full', d.schicht_h > 7 ? 'bg-red-500' : d.schicht_h > 5 ? 'bg-yellow-400' : 'bg-emerald-500')}
                  style={{ width: `${Math.min(100, (d.schicht_h / 8) * 100)}%` }} />
              </div>
              <span className="text-[9px] text-gray-400">{d.schicht_h}h</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'luecken' && (
        <div className="space-y-1">
          {gaps.map(g => (
            <div key={g.name} className="flex items-center gap-2 rounded bg-gray-800 px-2 py-1">
              <span className="text-[10px] text-gray-400 w-12">{g.name}</span>
              <div className="flex-1 h-1.5 rounded-full bg-gray-700">
                <div className={cn('h-1.5 rounded-full', g.gap_pct > 30 ? 'bg-red-500' : g.gap_pct > 10 ? 'bg-yellow-400' : 'bg-emerald-500')}
                  style={{ width: `${Math.min(100, g.demand)}%` }} />
              </div>
              <span className={cn('text-[9px] font-bold', g.gap_pct > 30 ? 'text-red-400' : g.gap_pct > 10 ? 'text-yellow-400' : 'text-emerald-400')}>
                {g.gap_pct > 0 ? `−${g.gap_pct}%` : 'OK'}
              </span>
            </div>
          ))}
          <div className="text-[9px] text-gray-500 pt-1">Zonen-Fairness-Index: <span className="text-violet-400 font-bold">{ZONE_FAIRNESS}/100</span></div>
        </div>
      )}

      {tab === 'co2' && (
        <div className="space-y-1">
          {sorted.map(d => (
            <div key={d.id} className="flex items-center gap-2 rounded bg-gray-800 px-2 py-1">
              <span className="flex-1 text-[10px] text-gray-300">{d.name}</span>
              <div className="h-1.5 w-16 rounded-full bg-gray-700">
                <div className={cn('h-1.5 rounded-full', d.co2_g_per_delivery > 150 ? 'bg-red-500' : d.co2_g_per_delivery > 100 ? 'bg-yellow-400' : 'bg-green-500')}
                  style={{ width: `${Math.min(100, (d.co2_g_per_delivery / 200) * 100)}%` }} />
              </div>
              <span className="text-[9px] text-green-400 font-mono">{d.co2_g_per_delivery}g</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'bindung' && (
        <div className="space-y-1">
          {sorted.map(d => (
            <div key={d.id} className="flex items-center gap-2 rounded bg-gray-800 px-2 py-1">
              <span className="flex-1 text-[10px] text-gray-300">{d.name}</span>
              <div className="h-1.5 w-16 rounded-full bg-gray-700">
                <div className="h-1.5 rounded-full bg-rose-400" style={{ width: `${d.kundenbindungs_pct}%` }} />
              </div>
              <span className="text-[9px] text-rose-400">{d.kundenbindungs_pct}%</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'abschluss' && (
        <div className="space-y-1">
          {sorted.map(d => (
            <div key={d.id} className="rounded bg-gray-800 px-2 py-1.5 space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-300">{d.name}</span>
                <div className="flex items-center gap-1.5">
                  <span className={cn('text-[10px] font-mono', d.abschluss_fenster_min <= 0 ? 'text-emerald-400' : d.abschluss_fenster_min <= 8 ? 'text-yellow-400' : 'text-red-400')}>
                    {d.abschluss_fenster_min <= 0 ? `−${Math.abs(d.abschluss_fenster_min)}min früh` : `+${d.abschluss_fenster_min}min spät`}
                  </span>
                  <span className={cn('text-[9px] rounded px-1', d.uebergabe_erfolg_pct >= 90 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400')}>
                    {d.uebergabe_erfolg_pct}% Überg.
                  </span>
                </div>
              </div>
              <div className="flex gap-1">
                {d.stops.map(s => (
                  <div key={s.seq} className={cn('h-1.5 flex-1 rounded', s.abgeschlossen ? 'bg-emerald-500' : Math.abs(s.eta_drift_min) <= 3 ? 'bg-indigo-500' : 'bg-red-500')} />
                ))}
              </div>
            </div>
          ))}
          <div className="text-[9px] text-gray-500 pt-1">Tour-Abschluss-Zeitfenster · Übergabe-Erfolg je Fahrer</div>
        </div>
      )}

      {tab === 'wellbeing' && (
        <div className="space-y-1">
          {sorted.map(d => (
            <div key={d.id} className="flex items-center gap-2 rounded bg-gray-800 px-2 py-1">
              <span className="flex-1 text-[10px] text-gray-300">{d.name}</span>
              <div className="h-1.5 w-16 rounded-full bg-gray-700">
                <div className={cn('h-1.5 rounded-full', d.wellbeing_score >= 80 ? 'bg-emerald-500' : d.wellbeing_score >= 55 ? 'bg-yellow-400' : 'bg-red-500')}
                  style={{ width: `${d.wellbeing_score}%` }} />
              </div>
              <span className={cn('text-xs font-bold', d.wellbeing_score >= 80 ? 'text-emerald-400' : d.wellbeing_score >= 55 ? 'text-yellow-400' : 'text-red-400')}>
                {d.wellbeing_score}
              </span>
              {d.wellbeing_score < 55 && <AlertTriangle className="h-3 w-3 text-red-400" />}
            </div>
          ))}
          <div className="text-[9px] text-gray-500 pt-1">Wellbeing: Schichtdauer · Pausen · Bewertung</div>
        </div>
      )}
    </Card>
  );
}
