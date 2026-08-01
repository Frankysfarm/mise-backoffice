'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, TrendingUp, TrendingDown, MapPin, Star, AlertTriangle, ChevronDown, ChevronUp, Route, Zap, Target, Leaf } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Phase 5500 — Score + Tour-Visualisierung V38
// V37+: Eco-Score-Badge; Gesamttouren-Zielpfad-Balken; Batch-Indikator;
// Fleet-Score + Delta; Fahrer-Rangliste tier-farbkodiert Platin/Gold/Gut/Schwach;
// Stopp-Dot-Sequenz + aufklappbare Timeline; Route-Effizienz-Balken;
// High-Risk-Alert-Banner; 5-KPI-Grid; 20-Sek-Polling; Mock-Fallback

type Tier = 'platin' | 'gold' | 'gut' | 'schwach';

interface TourStop { seq: number; eta: string; betrag: number; bewertung: number | null; abgeschlossen: boolean }
interface Driver {
  id: string; name: string; score: number; score_delta: number; tier: Tier;
  stops_done: number; stops_total: number; route_eff: number; eco_score: number;
  delay_risk: boolean; aktiv: boolean; batch_id: string | null; stops: TourStop[];
}

const MOCK_DRIVERS: Driver[] = [
  { id: 'd1', name: 'Nico W.',  score: 95, score_delta: +3, tier: 'platin', stops_done: 5, stops_total: 7, route_eff: 93, eco_score: 88, delay_risk: false, aktiv: true, batch_id: 'B-01',
    stops: [
      { seq: 1, eta: '14:15', betrag: 24.90, bewertung: 5,    abgeschlossen: true },
      { seq: 2, eta: '14:28', betrag: 17.40, bewertung: 4,    abgeschlossen: true },
      { seq: 3, eta: '14:41', betrag: 31.20, bewertung: null, abgeschlossen: false },
    ] },
  { id: 'd2', name: 'Sara K.',  score: 82, score_delta: +2, tier: 'gold',   stops_done: 3, stops_total: 6, route_eff: 79, eco_score: 74, delay_risk: false, aktiv: true, batch_id: 'B-02',
    stops: [
      { seq: 1, eta: '14:10', betrag: 19.50, bewertung: 5,    abgeschlossen: true },
      { seq: 2, eta: '14:25', betrag: 22.80, bewertung: null, abgeschlossen: false },
    ] },
  { id: 'd3', name: 'Tom B.',   score: 65, score_delta: -5, tier: 'gut',    stops_done: 1, stops_total: 4, route_eff: 59, eco_score: 61, delay_risk: true,  aktiv: true, batch_id: null,
    stops: [
      { seq: 1, eta: '14:05', betrag: 14.20, bewertung: 3,    abgeschlossen: true },
      { seq: 2, eta: '14:22', betrag: 28.60, bewertung: null, abgeschlossen: false },
    ] },
  { id: 'd4', name: 'Mia F.',   score: 43, score_delta: -9, tier: 'schwach',stops_done: 0, stops_total: 3, route_eff: 41, eco_score: 35, delay_risk: true,  aktiv: true, batch_id: 'B-01',
    stops: [
      { seq: 1, eta: '14:18', betrag: 16.70, bewertung: null, abgeschlossen: false },
    ] },
];

const TIER_CONFIG: Record<Tier, { label: string; textClass: string; bgClass: string; ringClass: string }> = {
  platin: { label: 'Platin', textClass: 'text-violet-300', bgClass: 'bg-violet-500/15', ringClass: 'ring-violet-500/40' },
  gold:   { label: 'Gold',   textClass: 'text-yellow-300', bgClass: 'bg-yellow-400/10', ringClass: 'ring-yellow-400/40' },
  gut:    { label: 'Gut',    textClass: 'text-emerald-400', bgClass: 'bg-emerald-500/10', ringClass: 'ring-emerald-500/30' },
  schwach:{ label: 'Schwach',textClass: 'text-red-400',    bgClass: 'bg-red-500/10',    ringClass: 'ring-red-500/30' },
};

interface Props { batches?: unknown[]; drivers?: unknown[]; locationId?: string | null; className?: string }

export function DispatchPhase5500ScoreTourVisualisierungV38({ locationId, className }: Props) {
  const [drivers, setDrivers] = useState<Driver[]>(MOCK_DRIVERS);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/dispatch/tour-score?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (Array.isArray(json.drivers)) setDrivers(json.drivers); }
    } catch { /* Mock-Fallback */ }
  }, [locationId]);

  useEffect(() => { load(); const iv = setInterval(load, 20_000); return () => clearInterval(iv); }, [load]);

  const toggle = (id: string) => setExpanded(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  const activeDrivers = drivers.filter(d => d.aktiv);
  const fleetScore = activeDrivers.length > 0 ? Math.round(activeDrivers.reduce((s, d) => s + d.score, 0) / activeDrivers.length) : 0;
  const fleetDelta = activeDrivers.length > 0 ? Math.round(activeDrivers.reduce((s, d) => s + d.score_delta, 0) / activeDrivers.length) : 0;
  const risikoCount = drivers.filter(d => d.delay_risk).length;
  const avgEff = activeDrivers.length > 0 ? Math.round(activeDrivers.reduce((s, d) => s + d.route_eff, 0) / activeDrivers.length) : 0;
  const avgEco = activeDrivers.length > 0 ? Math.round(activeDrivers.reduce((s, d) => s + d.eco_score, 0) / activeDrivers.length) : 0;
  const gesamtStopps = drivers.reduce((s, d) => s + d.stops_total, 0);
  const fertigStopps = drivers.reduce((s, d) => s + d.stops_done, 0);
  const zielPct = gesamtStopps > 0 ? Math.round((fertigStopps / gesamtStopps) * 100) : 0;

  return (
    <Card className={cn('bg-zinc-900 text-white border-zinc-800 p-4 space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-violet-400" />
          <span className="font-semibold text-sm">Score + Tour-Visualisierung V38</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-2xl font-bold tabular-nums text-violet-300">{fleetScore}</span>
          <span className={cn('text-sm font-semibold flex items-center gap-0.5', fleetDelta >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {fleetDelta >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {fleetDelta >= 0 ? '+' : ''}{fleetDelta}
          </span>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: 'Fleet-Score', val: fleetScore, color: fleetScore >= 80 ? 'text-violet-300' : fleetScore >= 60 ? 'text-yellow-300' : 'text-red-400' },
          { label: 'Aktiv',       val: activeDrivers.length, color: 'text-blue-300' },
          { label: 'Risiko',      val: risikoCount, color: risikoCount > 0 ? 'text-red-400' : 'text-emerald-400' },
          { label: 'Eff%',        val: `${avgEff}%`, color: avgEff >= 80 ? 'text-emerald-400' : 'text-yellow-300' },
          { label: 'Eco',         val: `${avgEco}`, color: avgEco >= 80 ? 'text-green-400' : avgEco >= 60 ? 'text-yellow-300' : 'text-orange-400' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-zinc-800 rounded-lg p-2 text-center">
            <div className="text-[10px] text-zinc-500 mb-0.5">{kpi.label}</div>
            <div className={cn('text-sm font-bold tabular-nums', kpi.color)}>{kpi.val}</div>
          </div>
        ))}
      </div>

      {/* Gesamttouren-Zielpfad */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-400 flex items-center gap-1"><Target className="h-3 w-3" />Stopps gesamt</span>
          <span className="text-zinc-300 font-mono">{fertigStopps}/{gesamtStopps} ({zielPct}%)</span>
        </div>
        <div className="h-2 rounded-full bg-zinc-800">
          <div
            className={cn('h-2 rounded-full transition-all duration-500', zielPct >= 70 ? 'bg-violet-500' : zielPct >= 40 ? 'bg-yellow-500' : 'bg-red-500')}
            style={{ width: `${zielPct}%` }}
          />
        </div>
      </div>

      {/* High-Risk Alert */}
      {risikoCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
          <span className="text-xs text-red-300">{risikoCount} Fahrer mit Verzögerungsrisiko — sofort prüfen!</span>
        </div>
      )}

      {/* Driver List */}
      <div className="space-y-2">
        {drivers.map(d => {
          const cfg = TIER_CONFIG[d.tier];
          const isExpanded = expanded.has(d.id);
          const stopPct = d.stops_total > 0 ? Math.round((d.stops_done / d.stops_total) * 100) : 0;
          return (
            <div key={d.id} className={cn('rounded-lg border p-2.5 space-y-2', cfg.bgClass, cfg.ringClass, 'ring-1')}>
              <div className="flex items-center gap-2">
                {/* Score */}
                <div className="flex flex-col items-center w-12 shrink-0">
                  <span className={cn('text-xl font-black tabular-nums', cfg.textClass)}>{d.score}</span>
                  <span className={cn('text-[10px] font-medium', d.score_delta >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {d.score_delta >= 0 ? '+' : ''}{d.score_delta}
                  </span>
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-white truncate">{d.name}</span>
                    <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', cfg.textClass, cfg.bgClass)}>{cfg.label}</span>
                    {d.batch_id && <span className="text-[10px] text-zinc-500 font-mono">{d.batch_id}</span>}
                    {d.delay_risk && <AlertTriangle className="h-3.5 w-3.5 text-red-400 ml-auto" />}
                  </div>
                  {/* Stop dots */}
                  <div className="flex items-center gap-1 mt-1">
                    {Array.from({ length: d.stops_total }).map((_, i) => (
                      <div key={i} className={cn('h-2 w-2 rounded-full', i < d.stops_done ? 'bg-emerald-400' : 'bg-zinc-700')} />
                    ))}
                    <span className="text-[10px] text-zinc-500 ml-1">{d.stops_done}/{d.stops_total}</span>
                  </div>
                </div>
                {/* Route eff + Eco */}
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <div className="flex items-center gap-1">
                    <Route className="h-3 w-3 text-zinc-500" />
                    <span className="text-[10px] text-zinc-400 font-mono">{d.route_eff}%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Leaf className="h-3 w-3 text-green-500" />
                    <span className="text-[10px] text-zinc-400 font-mono">{d.eco_score}</span>
                  </div>
                  <button onClick={() => toggle(d.id)} className="text-zinc-500 hover:text-zinc-300">
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
              {/* Route efficiency bar */}
              <div className="h-1 rounded-full bg-zinc-800">
                <div className={cn('h-1 rounded-full transition-all', d.route_eff >= 80 ? 'bg-emerald-400' : d.route_eff >= 60 ? 'bg-yellow-400' : 'bg-red-400')}
                  style={{ width: `${d.route_eff}%` }} />
              </div>
              {/* Stop progress */}
              <div className="h-1 rounded-full bg-zinc-800">
                <div className="h-1 rounded-full bg-violet-500 transition-all" style={{ width: `${stopPct}%` }} />
              </div>
              {/* Expanded stop timeline */}
              {isExpanded && d.stops.length > 0 && (
                <div className="space-y-1 border-t border-zinc-700/50 pt-2">
                  {d.stops.map(stop => (
                    <div key={stop.seq} className="flex items-center gap-2 text-[10px]">
                      <div className={cn('h-2 w-2 rounded-full shrink-0', stop.abgeschlossen ? 'bg-emerald-400' : 'bg-zinc-700')} />
                      <MapPin className="h-2.5 w-2.5 text-zinc-500 shrink-0" />
                      <span className="text-zinc-400 font-mono">{stop.eta}</span>
                      <span className="text-zinc-300">{stop.betrag.toFixed(2)} €</span>
                      {stop.bewertung !== null && (
                        <div className="flex items-center gap-0.5 ml-auto">
                          <Star className="h-2.5 w-2.5 text-yellow-400" />
                          <span className="text-yellow-300">{stop.bewertung}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-center text-[10px] text-zinc-600 flex items-center justify-center gap-1">
        <Zap className="h-2.5 w-2.5" />
        Live · 20s-Polling
      </div>
    </Card>
  );
}
