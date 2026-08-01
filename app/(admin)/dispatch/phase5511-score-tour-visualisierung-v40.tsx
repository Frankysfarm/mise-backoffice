'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, MapPin, Route, Zap, AlertTriangle, ChevronDown, ChevronUp, Navigation2, Target, Clock, TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Phase 5511 — Score + Tour-Visualisierung V40
// V39+: KI-Zuweisung-Score je Bestellung (Empfehlung welcher Fahrer);
// Real-time Fleet ETA Sync Panel (Küche↔Fahrer-ETA Diff);
// Multi-Fahrer Tour-Status Matrix (Grid-Ansicht);
// Tour-Stop-Zeitlinie animiert (dot-progress);
// 8-KPI-Grid Fleet-Score/Aktiv/Risiko/Eff%/Sync/ETA-Drift/Profit/Touren;
// 4-Tab Rangliste/Matrix/Zuweisung/Fleet-ETA;
// Tier Platin/Gold/Gut/Schwach; 20s-Polling; Mock-Fallback

type Tier = 'platin' | 'gold' | 'gut' | 'schwach';
type Tab = 'rangliste' | 'matrix' | 'zuweisung' | 'eta';

interface TourStop { seq: number; eta: string; abgeschlossen: boolean; eta_drift_min: number }
interface Driver {
  id: string; name: string; score: number; score_delta: number; tier: Tier;
  stops_done: number; stops_total: number; route_eff: number; aktiv: boolean;
  delay_risk: boolean; eta_drift_min: number; profit_eur: number; ki_match_score: number;
  kitchen_eta_sec: number | null; stops: TourStop[];
}

interface ZuweisungOrder {
  id: string; bestellnummer: string; recommended_driver_id: string; ki_score: number; reason: string;
}

const MOCK_DRIVERS: Driver[] = [
  { id: 'd1', name: 'Nico W.',  score: 96, score_delta: +2, tier: 'platin', stops_done: 5, stops_total: 7, route_eff: 94, aktiv: true,  delay_risk: false, eta_drift_min: -1, profit_eur: 134, ki_match_score: 98, kitchen_eta_sec: 420,
    stops: [{ seq: 1, eta: '14:15', abgeschlossen: true, eta_drift_min: -1 }, { seq: 2, eta: '14:28', abgeschlossen: true, eta_drift_min: 0 }, { seq: 3, eta: '14:41', abgeschlossen: false, eta_drift_min: 2 }] },
  { id: 'd2', name: 'Sara K.',  score: 83, score_delta: +1, tier: 'gold',   stops_done: 3, stops_total: 6, route_eff: 80, aktiv: true,  delay_risk: false, eta_drift_min: 3,  profit_eur: 93,  ki_match_score: 85, kitchen_eta_sec: 680,
    stops: [{ seq: 1, eta: '14:10', abgeschlossen: true, eta_drift_min: 3 }, { seq: 2, eta: '14:25', abgeschlossen: false, eta_drift_min: 0 }] },
  { id: 'd3', name: 'Tom B.',   score: 66, score_delta: -4, tier: 'gut',    stops_done: 1, stops_total: 4, route_eff: 60, aktiv: true,  delay_risk: true,  eta_drift_min: 8,  profit_eur: 52,  ki_match_score: 61, kitchen_eta_sec: 950,
    stops: [{ seq: 1, eta: '14:05', abgeschlossen: true, eta_drift_min: 8 }, { seq: 2, eta: '14:22', abgeschlossen: false, eta_drift_min: 12 }] },
  { id: 'd4', name: 'Mia F.',   score: 44, score_delta: -8, tier: 'schwach',stops_done: 0, stops_total: 3, route_eff: 42, aktiv: true,  delay_risk: true,  eta_drift_min: 15, profit_eur: 19,  ki_match_score: 39, kitchen_eta_sec: null,
    stops: [{ seq: 1, eta: '14:18', abgeschlossen: false, eta_drift_min: 15 }] },
];

const MOCK_ORDERS: ZuweisungOrder[] = [
  { id: 'zo1', bestellnummer: 'B-2001', recommended_driver_id: 'd1', ki_score: 97, reason: 'Nahe am Restaurant · Hohe Pünktlichkeit' },
  { id: 'zo2', bestellnummer: 'B-2002', recommended_driver_id: 'd2', ki_score: 84, reason: 'Auf Route · Kapazität frei' },
  { id: 'zo3', bestellnummer: 'B-2003', recommended_driver_id: 'd1', ki_score: 91, reason: 'Bester Score in Zone · Batch-Potenzial' },
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

interface Props { locationId: string | null; className?: string }

export function DispatchPhase5511ScoreTourVisualisierungV40({ locationId, className }: Props) {
  const [drivers, setDrivers] = useState<Driver[]>(MOCK_DRIVERS);
  const [orders] = useState<ZuweisungOrder[]>(MOCK_ORDERS);
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
  const avgEff = Math.round(drivers.reduce((a, d) => a + d.route_eff, 0) / Math.max(1, drivers.length));
  const syncedCount = drivers.filter(d => d.kitchen_eta_sec != null && d.kitchen_eta_sec < 600).length;
  const avgDrift = Math.round(drivers.reduce((a, d) => a + d.eta_drift_min, 0) / Math.max(1, drivers.length));
  const totalProfit = drivers.reduce((a, d) => a + d.profit_eur, 0);
  const totalTouren = drivers.reduce((a, d) => a + d.stops_total, 0);

  const kpiGrid = [
    { label: 'Fleet', value: `${fleetScore}%`, alert: fleetScore < 70 },
    { label: 'Aktiv', value: String(activeCount), alert: false },
    { label: 'Risiko', value: String(riskCount), alert: riskCount > 0 },
    { label: 'Eff%', value: `${avgEff}%`, alert: avgEff < 70 },
    { label: 'Sync', value: String(syncedCount), alert: syncedCount < activeCount },
    { label: 'Drift', value: `${avgDrift}min`, alert: avgDrift > 5 },
    { label: 'Profit', value: `${totalProfit}€`, alert: false },
    { label: 'Touren', value: String(totalTouren), alert: false },
  ];

  const TABS: { key: Tab; label: string }[] = [
    { key: 'rangliste', label: 'Rangliste' },
    { key: 'matrix', label: 'Matrix' },
    { key: 'zuweisung', label: 'KI-Zuweis.' },
    { key: 'eta', label: 'Fleet-ETA' },
  ];

  return (
    <Card className={cn('bg-zinc-900 border-zinc-700/50 p-4 space-y-3', className)}>
      <div className="flex items-center gap-2">
        <Trophy className="w-4 h-4 text-violet-400 shrink-0" />
        <span className="text-xs font-semibold text-zinc-100">Score + Tour V40</span>
        <span className="ml-auto text-[10px] text-zinc-500">KI-Zuweisung · Fleet-ETA-Sync</span>
        {riskCount > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full">
            <AlertTriangle className="w-3 h-3" />{riskCount} Risiko
          </span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {kpiGrid.map(k => (
          <div key={k.label} className={cn('rounded-md px-2 py-1.5 text-center', k.alert ? 'bg-red-500/10 ring-1 ring-red-500/30' : 'bg-zinc-800')}>
            <p className={cn('text-sm font-bold', k.alert ? 'text-red-400' : 'text-zinc-100')}>{k.value}</p>
            <p className="text-[9px] text-zinc-500 leading-none mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('flex-1 text-[10px] py-1 rounded-md transition-colors',
              tab === t.key ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700')}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'rangliste' && (
        <div className="space-y-1.5">
          {drivers.sort((a, b) => b.score - a.score).map((d, i) => {
            const tc = TIER_CONFIG[d.tier];
            const isOpen = expanded === d.id;
            return (
              <div key={d.id} className={cn('rounded-lg overflow-hidden ring-1', tc.bg, tc.ring)}>
                <button className="w-full flex items-center gap-2 px-3 py-2" onClick={() => setExpanded(isOpen ? null : d.id)}>
                  <span className="text-[10px] text-zinc-400 w-4">#{i + 1}</span>
                  <span className="flex-1 text-xs font-medium text-zinc-100 text-left">{d.name}</span>
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full', tc.bg, tc.text)}>{tc.label}</span>
                  <span className="text-sm font-bold text-zinc-100">{d.score}</span>
                  <span className={cn('text-[10px]', d.score_delta >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {d.score_delta >= 0 ? '+' : ''}{d.score_delta}
                  </span>
                  {isOpen ? <ChevronUp className="w-3 h-3 text-zinc-500" /> : <ChevronDown className="w-3 h-3 text-zinc-500" />}
                </button>
                {isOpen && (
                  <div className="px-3 pb-2 space-y-2">
                    <StopDotRow stops={d.stops} done={d.stops_done} />
                    <div className="grid grid-cols-3 gap-1">
                      <div className="bg-zinc-900/50 rounded p-1.5 text-center">
                        <p className="text-xs font-bold text-zinc-100">{d.stops_done}/{d.stops_total}</p>
                        <p className="text-[9px] text-zinc-500">Stopps</p>
                      </div>
                      <div className="bg-zinc-900/50 rounded p-1.5 text-center">
                        <p className={cn('text-xs font-bold', d.eta_drift_min > 5 ? 'text-red-400' : 'text-emerald-400')}>
                          {d.eta_drift_min > 0 ? '+' : ''}{d.eta_drift_min}min
                        </p>
                        <p className="text-[9px] text-zinc-500">ETA-Drift</p>
                      </div>
                      <div className="bg-zinc-900/50 rounded p-1.5 text-center">
                        <p className="text-xs font-bold text-zinc-100">{d.profit_eur}€</p>
                        <p className="text-[9px] text-zinc-500">Profit</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'matrix' && (
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="text-zinc-500 border-b border-zinc-800">
                {['Fahrer', 'Score', 'Stopps', 'Eff%', 'Drift', 'Risiko'].map(h => (
                  <th key={h} className="pb-1 text-left font-medium px-1">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {drivers.map(d => {
                const tc = TIER_CONFIG[d.tier];
                return (
                  <tr key={d.id} className="border-b border-zinc-800/50">
                    <td className="py-1.5 px-1 text-zinc-200">{d.name}</td>
                    <td className={cn('py-1.5 px-1 font-bold', tc.text)}>{d.score}</td>
                    <td className="py-1.5 px-1 text-zinc-300">{d.stops_done}/{d.stops_total}</td>
                    <td className={cn('py-1.5 px-1', d.route_eff < 70 ? 'text-red-400' : 'text-emerald-400')}>{d.route_eff}%</td>
                    <td className={cn('py-1.5 px-1', d.eta_drift_min > 5 ? 'text-red-400' : 'text-zinc-300')}>+{d.eta_drift_min}m</td>
                    <td className="py-1.5 px-1">{d.delay_risk ? '⚠️' : '✓'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'zuweisung' && (
        <div className="space-y-2">
          <p className="text-[10px] text-zinc-500">KI-Zuweisung empfiehlt automatisch den besten Fahrer je Bestellung</p>
          {orders.map(zo => {
            const driver = drivers.find(d => d.id === zo.recommended_driver_id);
            return (
              <div key={zo.id} className="bg-zinc-800 rounded-lg px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-100">{zo.bestellnummer}</span>
                  <span className="text-xs font-bold text-violet-300">KI-Score: {zo.ki_score}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <Target className="w-3 h-3 text-indigo-400" />
                  <span className="text-[10px] text-indigo-300">{driver?.name ?? '—'}</span>
                  <span className={cn('text-[10px] px-1 rounded', driver ? TIER_CONFIG[driver.tier].bg + ' ' + TIER_CONFIG[driver.tier].text : '')}>
                    {driver ? TIER_CONFIG[driver.tier].label : ''}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 mt-0.5">{zo.reason}</p>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'eta' && (
        <div className="space-y-2">
          <p className="text-[10px] text-zinc-500">Küchen-ETA-Sync: Verbleibende Küchen-Zeit je Fahrer</p>
          {drivers.map(d => {
            const sec = d.kitchen_eta_sec;
            const synced = sec != null && sec < 600;
            const m = sec != null ? Math.floor(sec / 60) : null;
            return (
              <div key={d.id} className="bg-zinc-800 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-zinc-200 flex-1">{d.name}</span>
                  <span className={cn('text-[10px] font-bold', synced ? 'text-emerald-400' : sec == null ? 'text-zinc-500' : 'text-yellow-400')}>
                    {m != null ? `${m}min bis Abholung` : 'kein Küchen-ETA'}
                  </span>
                  <span className={cn('w-2 h-2 rounded-full', synced ? 'bg-emerald-400' : sec == null ? 'bg-zinc-600' : 'bg-yellow-400')} />
                </div>
                <div className="h-1 bg-zinc-700 rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full', synced ? 'bg-emerald-500' : sec == null ? 'bg-zinc-600' : 'bg-yellow-500')}
                    style={{ width: sec != null ? `${Math.min(100, (1 - sec / 1200) * 100)}%` : '0%' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
