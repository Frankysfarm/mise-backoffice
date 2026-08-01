'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, TrendingUp, TrendingDown, MapPin, Star, AlertTriangle, ChevronDown, ChevronUp, Route, Zap, Target } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Phase 5492 — Score + Tour-Visualisierung V37
// Fleet-Score + Delta; Fahrer-Rangliste tier-farbkodiert Platin/Gold/Gut/Schwach;
// Stopp-Dot-Sequenz + aufklappbare Timeline; Route-Effizienz-Balken; High-Risk-Alert-Banner;
// 5-KPI-Grid Fleet-Score/Aktiv/Risiko/Eff%/€; 20-Sek-Polling; Mock-Fallback

type Tier = 'platin' | 'gold' | 'gut' | 'schwach';

interface TourStop { seq: number; eta: string; betrag: number; bewertung: number | null; abgeschlossen: boolean }
interface Driver {
  id: string; name: string; score: number; score_delta: number; tier: Tier;
  stops_done: number; stops_total: number; route_eff: number; delay_risk: boolean;
  aktiv: boolean; stops: TourStop[];
}

const MOCK_DRIVERS: Driver[] = [
  { id: 'd1', name: 'Nico W.',   score: 94, score_delta: +3, tier: 'platin', stops_done: 4, stops_total: 6, route_eff: 92, delay_risk: false, aktiv: true,
    stops: [
      { seq: 1, eta: '14:15', betrag: 24.90, bewertung: 5, abgeschlossen: true },
      { seq: 2, eta: '14:28', betrag: 17.40, bewertung: 4, abgeschlossen: true },
      { seq: 3, eta: '14:41', betrag: 31.20, bewertung: null, abgeschlossen: false },
    ] },
  { id: 'd2', name: 'Sara K.',   score: 81, score_delta: +1, tier: 'gold',   stops_done: 2, stops_total: 5, route_eff: 78, delay_risk: false, aktiv: true,
    stops: [
      { seq: 1, eta: '14:10', betrag: 19.50, bewertung: 5, abgeschlossen: true },
      { seq: 2, eta: '14:25', betrag: 22.80, bewertung: null, abgeschlossen: false },
    ] },
  { id: 'd3', name: 'Tom B.',    score: 67, score_delta: -4, tier: 'gut',    stops_done: 1, stops_total: 4, route_eff: 61, delay_risk: true,  aktiv: true,
    stops: [
      { seq: 1, eta: '14:05', betrag: 14.20, bewertung: 3, abgeschlossen: true },
      { seq: 2, eta: '14:22', betrag: 28.60, bewertung: null, abgeschlossen: false },
    ] },
  { id: 'd4', name: 'Mia F.',    score: 44, score_delta: -8, tier: 'schwach',stops_done: 0, stops_total: 3, route_eff: 42, delay_risk: true,  aktiv: true,
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

export function DispatchPhase5492ScoreTourVisualisierungV37({ locationId, className }: Props) {
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

  return (
    <Card className={cn('bg-zinc-900 text-white border-zinc-800 p-4 space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-violet-400" />
          <span className="font-semibold text-sm">Score + Tour-Visualisierung V37</span>
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
          { label: 'Touren',      val: drivers.reduce((s, d) => s + d.stops_total, 0), color: 'text-zinc-300' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-zinc-800 rounded-lg p-2 text-center">
            <div className={cn('text-lg font-bold tabular-nums', kpi.color)}>{kpi.val}</div>
            <div className="text-[10px] text-zinc-500 mt-0.5 truncate">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Risk Alert */}
      {risikoCount > 1 && (
        <div className="flex items-center gap-2 rounded-lg bg-red-600/15 border border-red-600/35 px-3 py-2 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{risikoCount} Fahrer mit Verspätungsrisiko — Eingreifen empfohlen</span>
        </div>
      )}

      {/* Driver List */}
      <div className="space-y-2">
        {drivers.map((d, i) => {
          const tc = TIER_CONFIG[d.tier];
          const isOpen = expanded.has(d.id);
          return (
            <div key={d.id} className={cn('rounded-xl border p-3 ring-1 transition-colors', tc.bgClass, tc.ringClass)}>
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => toggle(d.id)}>
                <span className="text-zinc-500 text-xs w-4 shrink-0">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm truncate">{d.name}</span>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full', tc.bgClass, tc.textClass)}>{tc.label}</span>
                    {d.delay_risk && <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
                    <span className="flex items-center gap-1"><Route className="h-3 w-3" />{d.stops_done}/{d.stops_total} Stopps</span>
                    <span className="flex items-center gap-1"><Zap className="h-3 w-3" />Eff. {d.route_eff}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full', d.route_eff >= 80 ? 'bg-emerald-500' : d.route_eff >= 60 ? 'bg-yellow-400' : 'bg-red-500')}
                      style={{ width: `${d.route_eff}%` }} />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={cn('text-lg font-bold tabular-nums', tc.textClass)}>{d.score}</div>
                  <div className={cn('text-xs flex items-center justify-end gap-0.5', d.score_delta >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {d.score_delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {d.score_delta >= 0 ? '+' : ''}{d.score_delta}
                  </div>
                </div>
                <button className="text-zinc-600 hover:text-zinc-300">
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>

              {/* Stopp-Dot-Sequenz */}
              <div className="flex items-center gap-1 mt-2">
                {d.stops.map(s => (
                  <div key={s.seq} className={cn('h-2 w-2 rounded-full', s.abgeschlossen ? 'bg-emerald-500' : 'bg-zinc-600')} title={`Stop ${s.seq}`} />
                ))}
                {Array.from({ length: d.stops_total - d.stops.length }, (_, j) => (
                  <div key={`empty-${j}`} className="h-2 w-2 rounded-full bg-zinc-700" />
                ))}
              </div>

              {/* Expandable Timeline */}
              {isOpen && (
                <div className="mt-3 border-t border-zinc-700 pt-3 space-y-1.5">
                  {d.stops.map(s => (
                    <div key={s.seq} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className={cn('h-2 w-2 rounded-full shrink-0', s.abgeschlossen ? 'bg-emerald-500' : 'bg-zinc-500')} />
                        <MapPin className="h-3 w-3 text-zinc-500" />
                        <span className="text-zinc-300">Stop {s.seq} — {s.eta} Uhr</span>
                      </div>
                      <div className="flex items-center gap-3 text-zinc-400">
                        <span>{s.betrag.toFixed(2)} €</span>
                        {s.bewertung !== null && (
                          <span className="flex items-center gap-0.5 text-yellow-400">
                            <Star className="h-3 w-3 fill-yellow-400" />{s.bewertung}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[10px] text-zinc-600">
        <span className="flex items-center gap-1"><Target className="h-3 w-3" /> Fleet-Live</span>
        <span>20-Sek-Polling</span>
      </div>
    </Card>
  );
}
