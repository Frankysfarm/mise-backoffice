'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, TrendingUp, TrendingDown, MapPin, Star, AlertTriangle, ChevronDown, ChevronUp, Route, Zap, Target, BarChart2, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Phase 5505 — Score + Tour-Visualisierung V39
// V38+: Fahrer-Compliance-Score je Bestellung (SLA-Einhaltung/GPS-Abweichung/Kundenkontakt);
// Tour-Profit-per-km-Heatmap-Balken; Gesamttour-Bilanz-Panel Einnahmen vs. Kosten;
// Fleet-Fitness-Score-Gauge; ETA-Drift-Warnung Banner;
// 6-KPI-Grid Fleet-Score/Aktiv/Risiko/Compliance/Profit-km/ETA-Drift;
// 3-Tab Rangliste/Compliance/Profit; Tier Platin/Gold/Gut/Schwach;
// 20-Sek-Polling; Mock-Fallback

type Tier = 'platin' | 'gold' | 'gut' | 'schwach';
type Tab = 'rangliste' | 'compliance' | 'profit';

interface TourStop { seq: number; eta: string; betrag: number; bewertung: number | null; abgeschlossen: boolean; eta_drift_min: number }
interface Driver {
  id: string; name: string; score: number; score_delta: number; tier: Tier;
  stops_done: number; stops_total: number; route_eff: number; eco_score: number;
  delay_risk: boolean; aktiv: boolean; batch_id: string | null; stops: TourStop[];
  compliance_score: number; profit_km: number; km_total: number; earnings: number; costs: number;
}

const MOCK_DRIVERS: Driver[] = [
  { id: 'd1', name: 'Nico W.',  score: 96, score_delta: +2, tier: 'platin', stops_done: 5, stops_total: 7, route_eff: 94, eco_score: 89, delay_risk: false, aktiv: true, batch_id: 'B-01', compliance_score: 97, profit_km: 3.20, km_total: 42, earnings: 134.40, costs: 21.00,
    stops: [
      { seq: 1, eta: '14:15', betrag: 24.90, bewertung: 5,    abgeschlossen: true, eta_drift_min: -1 },
      { seq: 2, eta: '14:28', betrag: 17.40, bewertung: 4,    abgeschlossen: true, eta_drift_min: 0  },
      { seq: 3, eta: '14:41', betrag: 31.20, bewertung: null, abgeschlossen: false, eta_drift_min: 2 },
    ] },
  { id: 'd2', name: 'Sara K.',  score: 83, score_delta: +1, tier: 'gold',   stops_done: 3, stops_total: 6, route_eff: 80, eco_score: 75, delay_risk: false, aktiv: true, batch_id: 'B-02', compliance_score: 84, profit_km: 2.45, km_total: 38, earnings: 93.10, costs: 19.00,
    stops: [
      { seq: 1, eta: '14:10', betrag: 19.50, bewertung: 5,    abgeschlossen: true, eta_drift_min: 3 },
      { seq: 2, eta: '14:25', betrag: 22.80, bewertung: null, abgeschlossen: false, eta_drift_min: 0 },
    ] },
  { id: 'd3', name: 'Tom B.',   score: 66, score_delta: -4, tier: 'gut',    stops_done: 1, stops_total: 4, route_eff: 60, eco_score: 62, delay_risk: true,  aktiv: true, batch_id: null,   compliance_score: 61, profit_km: 1.80, km_total: 29, earnings: 52.20, costs: 14.50,
    stops: [
      { seq: 1, eta: '14:05', betrag: 14.20, bewertung: 3,    abgeschlossen: true, eta_drift_min: 8  },
      { seq: 2, eta: '14:22', betrag: 28.60, bewertung: null, abgeschlossen: false, eta_drift_min: 12 },
    ] },
  { id: 'd4', name: 'Mia F.',   score: 44, score_delta: -8, tier: 'schwach',stops_done: 0, stops_total: 3, route_eff: 42, eco_score: 36, delay_risk: true,  aktiv: true, batch_id: 'B-01', compliance_score: 39, profit_km: 0.90, km_total: 21, earnings: 18.90, costs: 10.50,
    stops: [
      { seq: 1, eta: '14:18', betrag: 16.70, bewertung: null, abgeschlossen: false, eta_drift_min: 15 },
    ] },
];

const TIER_CONFIG: Record<Tier, { label: string; textClass: string; bgClass: string; ringClass: string }> = {
  platin:  { label: 'Platin',  textClass: 'text-violet-300', bgClass: 'bg-violet-500/15', ringClass: 'ring-violet-500/40' },
  gold:    { label: 'Gold',    textClass: 'text-yellow-300', bgClass: 'bg-yellow-400/10', ringClass: 'ring-yellow-400/40' },
  gut:     { label: 'Gut',     textClass: 'text-emerald-400', bgClass: 'bg-emerald-500/10', ringClass: 'ring-emerald-500/30' },
  schwach: { label: 'Schwach', textClass: 'text-red-400',    bgClass: 'bg-red-500/10',    ringClass: 'ring-red-500/30' },
};

interface Props { locationId: string | null; className?: string }

export function DispatchPhase5510ScoreTourVisualisierungV39({ locationId, className }: Props) {
  const [drivers, setDrivers] = useState<Driver[]>(MOCK_DRIVERS);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('rangliste');

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/dispatch/tour-scores?location_id=${locationId}`);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.drivers)) setDrivers(json.drivers);
      }
    } catch { /* Mock-Fallback */ }
  }, [locationId]);

  useEffect(() => { load(); const iv = setInterval(load, 20_000); return () => clearInterval(iv); }, [load]);

  const fleetScore = Math.round(drivers.reduce((a, d) => a + d.score, 0) / Math.max(1, drivers.length));
  const activeCount = drivers.filter(d => d.aktiv).length;
  const riskCount = drivers.filter(d => d.delay_risk).length;
  const avgCompliance = Math.round(drivers.reduce((a, d) => a + d.compliance_score, 0) / Math.max(1, drivers.length));
  const avgProfitKm = (drivers.reduce((a, d) => a + d.profit_km, 0) / Math.max(1, drivers.length)).toFixed(2);
  const maxDrift = Math.max(...drivers.flatMap(d => d.stops.map(s => s.eta_drift_min)));
  const totalEarnings = drivers.reduce((a, d) => a + d.earnings, 0);
  const totalCosts = drivers.reduce((a, d) => a + d.costs, 0);
  const netProfit = totalEarnings - totalCosts;

  const TABS: { key: Tab; label: string }[] = [
    { key: 'rangliste', label: 'Rangliste' },
    { key: 'compliance', label: 'Compliance' },
    { key: 'profit', label: 'Profit/km' },
  ];

  return (
    <Card className={cn('bg-zinc-900 text-white border-zinc-800 p-4 space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-violet-400" />
          <span className="font-semibold text-sm">Score & Tour-Visualisierung V39</span>
        </div>
        <div className="flex items-center gap-1.5">
          {maxDrift > 10 && (
            <span className="flex items-center gap-1 text-xs bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full">
              <AlertTriangle className="h-3 w-3" />ETA-Drift +{maxDrift}min
            </span>
          )}
        </div>
      </div>

      {/* 6-KPI-Grid */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {[
          { label: 'Fleet-Score', value: fleetScore,    icon: <Trophy className="h-3 w-3 text-violet-400" />,    color: 'text-violet-300' },
          { label: 'Aktiv',       value: activeCount,   icon: <Zap className="h-3 w-3 text-emerald-400" />,      color: 'text-emerald-300' },
          { label: 'Risiko',      value: riskCount,     icon: <AlertTriangle className="h-3 w-3 text-red-400" />, color: riskCount > 0 ? 'text-red-300' : 'text-zinc-500' },
          { label: 'Compliance',  value: `${avgCompliance}%`, icon: <ShieldCheck className="h-3 w-3 text-sky-400" />, color: 'text-sky-300' },
          { label: 'Profit/km',   value: `${avgProfitKm}€`, icon: <Route className="h-3 w-3 text-amber-400" />,   color: 'text-amber-300' },
          { label: 'ETA-Drift',   value: `+${maxDrift}m`, icon: <Target className="h-3 w-3 text-orange-400" />,  color: maxDrift > 5 ? 'text-orange-300' : 'text-zinc-500' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-zinc-800 rounded-lg p-2 text-center">
            <div className="flex justify-center mb-1">{kpi.icon}</div>
            <div className={cn('text-base font-bold leading-none', kpi.color)}>{kpi.value}</div>
            <div className="text-xs text-zinc-500 mt-0.5">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Tab-Nav */}
      <div className="flex gap-1">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('flex-1 text-xs py-1.5 rounded-lg transition-colors',
              tab === t.key ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Rangliste Tab */}
      {tab === 'rangliste' && (
        <div className="space-y-2">
          {drivers.sort((a, b) => b.score - a.score).map((d, i) => {
            const cfg = TIER_CONFIG[d.tier];
            const isOpen = expanded === d.id;
            return (
              <div key={d.id} className={cn('rounded-lg ring-1 overflow-hidden', cfg.bgClass, cfg.ringClass)}>
                <button className="w-full flex items-center gap-3 p-3 text-left"
                  onClick={() => setExpanded(isOpen ? null : d.id)}>
                  <span className="text-xs text-zinc-500 w-4">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{d.name}</span>
                      <span className={cn('text-xs px-1.5 py-0.5 rounded', cfg.bgClass, cfg.textClass)}>{cfg.label}</span>
                      {d.delay_risk && <AlertTriangle className="h-3.5 w-3.5 text-red-400" />}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full', d.score >= 85 ? 'bg-violet-500' : d.score >= 70 ? 'bg-yellow-400' : d.score >= 55 ? 'bg-emerald-500' : 'bg-red-500')}
                          style={{ width: `${d.score}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={cn('font-bold text-lg', cfg.textClass)}>{d.score}</div>
                    <div className={cn('text-xs', d.score_delta >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {d.score_delta >= 0 ? '+' : ''}{d.score_delta}
                    </div>
                  </div>
                  {isOpen ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 space-y-2 border-t border-zinc-700/50 pt-2">
                    <div className="flex gap-4 text-xs text-zinc-400">
                      <span>Stopps {d.stops_done}/{d.stops_total}</span>
                      <span>Route {d.route_eff}%</span>
                      <span>Compliance {d.compliance_score}%</span>
                    </div>
                    <div className="flex gap-1">
                      {d.stops.map(s => (
                        <div key={s.seq} className={cn('flex-1 h-2 rounded-full',
                          s.abgeschlossen ? 'bg-emerald-500' : s.eta_drift_min > 5 ? 'bg-red-500' : 'bg-zinc-600')} />
                      ))}
                    </div>
                    {d.stops.filter(s => !s.abgeschlossen).slice(0, 2).map(s => (
                      <div key={s.seq} className="flex justify-between text-xs text-zinc-300">
                        <span>Stop #{s.seq} — ETA {s.eta}</span>
                        {s.eta_drift_min > 0 && <span className="text-orange-300">+{s.eta_drift_min}min Drift</span>}
                        <span>{s.betrag.toFixed(2)}€</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Compliance Tab */}
      {tab === 'compliance' && (
        <div className="space-y-2">
          {drivers.sort((a, b) => b.compliance_score - a.compliance_score).map(d => {
            const cfg = TIER_CONFIG[d.tier];
            const col = d.compliance_score >= 90 ? 'bg-emerald-500' : d.compliance_score >= 75 ? 'bg-yellow-400' : 'bg-red-500';
            const textCol = d.compliance_score >= 90 ? 'text-emerald-300' : d.compliance_score >= 75 ? 'text-yellow-300' : 'text-red-300';
            return (
              <div key={d.id} className="flex items-center gap-3 bg-zinc-800 rounded-lg p-3">
                <div className="w-24 shrink-0">
                  <div className="text-sm font-medium">{d.name}</div>
                  <div className={cn('text-xs', cfg.textClass)}>{cfg.label}</div>
                </div>
                <div className="flex-1 h-2 bg-zinc-700 rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full', col)} style={{ width: `${d.compliance_score}%` }} />
                </div>
                <div className={cn('text-sm font-bold w-12 text-right', textCol)}>{d.compliance_score}%</div>
                <ShieldCheck className={cn('h-4 w-4 shrink-0', textCol)} />
              </div>
            );
          })}
        </div>
      )}

      {/* Profit Tab */}
      {tab === 'profit' && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Einnahmen', value: `${totalEarnings.toFixed(0)}€`, color: 'text-emerald-300' },
              { label: 'Kosten',    value: `${totalCosts.toFixed(0)}€`,    color: 'text-red-300' },
              { label: 'Gewinn',    value: `${netProfit.toFixed(0)}€`,     color: netProfit >= 0 ? 'text-violet-300' : 'text-red-300' },
            ].map(kpi => (
              <div key={kpi.label} className="bg-zinc-800 rounded-lg p-3 text-center">
                <div className={cn('text-xl font-bold', kpi.color)}>{kpi.value}</div>
                <div className="text-xs text-zinc-500 mt-1">{kpi.label}</div>
              </div>
            ))}
          </div>
          {drivers.sort((a, b) => b.profit_km - a.profit_km).map(d => {
            const maxPKm = Math.max(...drivers.map(x => x.profit_km));
            const col = d.profit_km >= 2.5 ? 'bg-emerald-500' : d.profit_km >= 1.5 ? 'bg-yellow-400' : 'bg-red-500';
            const textCol = d.profit_km >= 2.5 ? 'text-emerald-300' : d.profit_km >= 1.5 ? 'text-yellow-300' : 'text-red-300';
            return (
              <div key={d.id} className="flex items-center gap-3 bg-zinc-800 rounded-lg p-3">
                <div className="w-20 shrink-0 text-sm font-medium">{d.name}</div>
                <div className="flex-1 h-2 bg-zinc-700 rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full', col)} style={{ width: `${(d.profit_km / maxPKm) * 100}%` }} />
                </div>
                <div className={cn('text-sm font-bold w-16 text-right', textCol)}>{d.profit_km.toFixed(2)}€/km</div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-center text-xs text-zinc-600">20s-Polling · Phase 5505</p>
    </Card>
  );
}
