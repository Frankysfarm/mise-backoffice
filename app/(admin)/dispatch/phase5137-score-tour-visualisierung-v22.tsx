'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Trophy, Route, MapPin, TrendingUp, TrendingDown, Zap, AlertTriangle, CheckCircle2, Clock, Euro } from 'lucide-react';

interface Stop {
  id: string;
  sequence: number;
  status: 'pending' | 'active' | 'done' | 'late';
  eta_min?: number | null;
  km?: number | null;
  betrag?: number | null;
  kunde?: string | null;
}

interface Driver {
  id: string;
  name: string;
  score: number;
  score_delta: number;
  tier: 'platin' | 'gold' | 'gut' | 'schwach';
  delay_risk: 'low' | 'medium' | 'high';
  stops: Stop[];
  aktiv: boolean;
  route_eff: number;
  zone?: string | null;
  umsatz?: number | null;
}

interface Props {
  locationId: string | null;
}

const TIER_CONFIG = {
  platin: { label: 'Platin', bg: 'bg-purple-900/40', text: 'text-purple-300', ring: 'ring-purple-500/40', bar: 'bg-purple-500' },
  gold:   { label: 'Gold',   bg: 'bg-yellow-900/40', text: 'text-yellow-300', ring: 'ring-yellow-500/40', bar: 'bg-yellow-400' },
  gut:    { label: 'Gut',    bg: 'bg-emerald-900/40',text: 'text-emerald-300',ring: 'ring-emerald-500/40',bar: 'bg-emerald-500' },
  schwach:{ label: 'Schwach',bg: 'bg-slate-800/60',  text: 'text-slate-400',  ring: 'ring-slate-600/40',  bar: 'bg-slate-500' },
};

const STOP_DOT = {
  pending: 'bg-slate-600',
  active:  'bg-blue-500 animate-pulse',
  done:    'bg-emerald-500',
  late:    'bg-red-500 animate-pulse',
};

const RISK = {
  low:    { label: 'Niedrig',  color: 'text-emerald-400' },
  medium: { label: 'Mittel',   color: 'text-amber-400' },
  high:   { label: 'Hoch',     color: 'text-red-400' },
};

const MOCK_DRIVERS: Driver[] = [
  {
    id: 'd1', name: 'Marco R.', score: 94, score_delta: +3, tier: 'platin', delay_risk: 'low',    aktiv: true,  route_eff: 92, zone: 'Nord',   umsatz: 148.50,
    stops: [
      { id: 's1', sequence: 1, status: 'done',    eta_min: 0,  km: 1.2, betrag: 28.5, kunde: 'Müller K.' },
      { id: 's2', sequence: 2, status: 'active',  eta_min: 4,  km: 1.8, betrag: 19.0, kunde: 'Schmidt A.' },
      { id: 's3', sequence: 3, status: 'pending', eta_min: 11, km: 2.1, betrag: 34.0, kunde: 'Weber G.' },
    ],
  },
  {
    id: 'd2', name: 'Lena K.', score: 81, score_delta: -2, tier: 'gold', delay_risk: 'medium', aktiv: true,  route_eff: 78, zone: 'Mitte',  umsatz: 96.50,
    stops: [
      { id: 's4', sequence: 1, status: 'done',    eta_min: 0,  km: 0.9, betrag: 22.0, kunde: 'Fischer M.' },
      { id: 's5', sequence: 2, status: 'late',    eta_min: 7,  km: 3.2, betrag: 15.5, kunde: 'Wagner T.' },
      { id: 's6', sequence: 3, status: 'pending', eta_min: 16, km: 1.5, betrag: 41.0, kunde: 'Bauer H.' },
      { id: 's7', sequence: 4, status: 'pending', eta_min: 24, km: 2.0, betrag: 18.0, kunde: 'Koch E.' },
    ],
  },
  {
    id: 'd3', name: 'Tobias M.', score: 67, score_delta: +1, tier: 'gut', delay_risk: 'high', aktiv: true,  route_eff: 61, zone: 'Süd',    umsatz: 62.00,
    stops: [
      { id: 's8', sequence: 1, status: 'active',  eta_min: 6,  km: 2.5, betrag: 33.0, kunde: 'Braun J.' },
      { id: 's9', sequence: 2, status: 'pending', eta_min: 18, km: 1.8, betrag: 27.0, kunde: 'Schulze O.' },
    ],
  },
  {
    id: 'd4', name: 'Sara B.', score: 45, score_delta: -5, tier: 'schwach', delay_risk: 'high', aktiv: false, route_eff: 42, zone: null, umsatz: 0,
    stops: [],
  },
];

export function DispatchPhase5137ScoreTourVisualisierungV22({ locationId }: Props) {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!locationId) { setDrivers(MOCK_DRIVERS); setLoading(false); return; }
    async function load() {
      try {
        const res = await fetch(`/api/delivery/dispatch/tours?location_id=${locationId}`);
        if (res.ok) setDrivers((await res.json()).drivers ?? MOCK_DRIVERS);
        else setDrivers(MOCK_DRIVERS);
      } catch { setDrivers(MOCK_DRIVERS); }
      finally { setLoading(false); }
    }
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const aktiv = drivers.filter(d => d.aktiv);
  const fleetScore = aktiv.length ? Math.round(aktiv.reduce((s, d) => s + d.score, 0) / aktiv.length) : 0;
  const scoreDelta = aktiv.length ? Math.round(aktiv.reduce((s, d) => s + d.score_delta, 0) / aktiv.length) : 0;
  const risikoCount = aktiv.filter(d => d.delay_risk === 'high').length;
  const avgRouteEff = aktiv.length ? Math.round(aktiv.reduce((s, d) => s + d.route_eff, 0) / aktiv.length) : 0;
  const gesamtUmsatz = aktiv.reduce((s, d) => s + (d.umsatz ?? 0), 0);

  if (loading) return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-slate-400 text-sm flex items-center gap-2">
      <Trophy className="w-4 h-4 animate-pulse" /> Lade Tours...
    </div>
  );

  return (
    <div className="rounded-xl border border-purple-500/20 bg-slate-900/80 backdrop-blur p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-purple-400" />
          <span className="font-semibold text-white text-sm">Score + Tour V22</span>
        </div>
        <div className="flex items-center gap-1 text-xs">
          {scoreDelta > 0 && <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />}
          {scoreDelta < 0 && <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
          <span className="text-purple-200 font-bold text-xl tabular-nums">{fleetScore}</span>
        </div>
      </div>

      {/* 5-KPI Grid */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: 'Fleet-Score', value: `${fleetScore}%`, color: fleetScore >= 80 ? 'text-emerald-400' : fleetScore >= 60 ? 'text-amber-400' : 'text-red-400' },
          { label: 'Aktiv',       value: aktiv.length,      color: 'text-blue-400' },
          { label: 'Risiko',      value: risikoCount,        color: risikoCount > 0 ? 'text-red-400' : 'text-slate-400' },
          { label: 'Route-Eff',   value: `${avgRouteEff}%`,  color: avgRouteEff >= 75 ? 'text-emerald-400' : 'text-amber-400' },
          { label: 'Umsatz',      value: `${gesamtUmsatz.toFixed(0)}€`, color: 'text-yellow-400' },
        ].map(k => (
          <div key={k.label} className="bg-slate-800/60 rounded-lg p-2 text-center">
            <div className={cn('text-sm font-bold tabular-nums', k.color)}>{k.value}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Driver Cards */}
      <div className="space-y-2">
        {drivers.map(d => {
          const tc = TIER_CONFIG[d.tier];
          const isOpen = expanded === d.id;
          const donePct = d.stops.length
            ? Math.round((d.stops.filter(s => s.status === 'done').length / d.stops.length) * 100)
            : 0;
          return (
            <div key={d.id} className={cn('rounded-lg border p-3 ring-1', tc.bg, tc.ring, 'border-transparent')}>
              <button
                className="w-full text-left"
                onClick={() => setExpanded(isOpen ? null : d.id)}
              >
                <div className="flex items-center gap-2">
                  <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded', tc.bg, tc.text)}>
                    {tc.label}
                  </span>
                  <span className="font-semibold text-white text-sm flex-1">{d.name}</span>
                  {!d.aktiv && <span className="text-[10px] text-slate-500 bg-slate-800 rounded px-1">Offline</span>}
                  <span className={cn('text-sm font-bold tabular-nums', tc.text)}>{d.score}</span>
                  {d.score_delta > 0 && <TrendingUp className="w-3 h-3 text-emerald-400" />}
                  {d.score_delta < 0 && <TrendingDown className="w-3 h-3 text-red-400" />}
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                  <span className={RISK[d.delay_risk].color}>⚠ {RISK[d.delay_risk].label}</span>
                  <span><Route className="w-3 h-3 inline mr-0.5" />{d.route_eff}%</span>
                  {d.zone && <span><MapPin className="w-3 h-3 inline mr-0.5" />{d.zone}</span>}
                  {d.umsatz != null && d.umsatz > 0 && <span><Euro className="w-3 h-3 inline mr-0.5" />{d.umsatz.toFixed(0)}</span>}
                </div>
                {/* Stop Dot Sequence */}
                {d.stops.length > 0 && (
                  <div className="flex items-center gap-1 mt-2">
                    {d.stops.map(s => (
                      <div key={s.id} className={cn('w-2.5 h-2.5 rounded-full', STOP_DOT[s.status])} />
                    ))}
                    <div className="flex-1 h-1 bg-slate-700 rounded-full ml-1 overflow-hidden">
                      <div className={cn('h-full rounded-full', tc.bar)} style={{ width: `${donePct}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-500">{donePct}%</span>
                  </div>
                )}
              </button>

              {/* Expanded Stop Timeline */}
              {isOpen && d.stops.length > 0 && (
                <div className="mt-3 space-y-1.5 border-t border-slate-700 pt-2">
                  {d.stops.map(s => (
                    <div key={s.id} className="flex items-center gap-2 text-xs">
                      <div className={cn('w-2 h-2 rounded-full shrink-0', STOP_DOT[s.status])} />
                      <span className="text-slate-400 w-4 text-right">{s.sequence}.</span>
                      <span className="text-white flex-1 truncate">{s.kunde ?? '—'}</span>
                      {s.eta_min != null && s.eta_min > 0 && (
                        <span className="flex items-center gap-0.5 text-slate-400">
                          <Clock className="w-3 h-3" />{s.eta_min}m
                        </span>
                      )}
                      {s.km != null && <span className="text-slate-500">{s.km}km</span>}
                      {s.betrag != null && <span className="text-yellow-400">{s.betrag.toFixed(0)}€</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {risikoCount > 0 && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-400">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{risikoCount} Fahrer mit hohem Verspätungsrisiko</span>
        </div>
      )}

      <div className="text-[10px] text-slate-600 text-right">20-Sek-Polling · Mock-Fallback</div>
    </div>
  );
}
