'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Trophy, Route, MapPin, TrendingUp, TrendingDown, Zap, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Stop {
  id: string;
  sequence: number;
  status: 'pending' | 'active' | 'done' | 'late';
  eta_min?: number | null;
  km?: number | null;
  betrag?: number | null;
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
    id: 'd1', name: 'Marco R.', score: 94, score_delta: +3, tier: 'platin', delay_risk: 'low', aktiv: true, route_eff: 92,
    stops: [
      { id: 's1', sequence: 1, status: 'done', eta_min: 0, km: 1.2, betrag: 28.5 },
      { id: 's2', sequence: 2, status: 'active', eta_min: 4, km: 1.8, betrag: 19.0 },
      { id: 's3', sequence: 3, status: 'pending', eta_min: 11, km: 2.1, betrag: 34.0 },
    ],
  },
  {
    id: 'd2', name: 'Lena K.', score: 81, score_delta: -2, tier: 'gold', delay_risk: 'medium', aktiv: true, route_eff: 78,
    stops: [
      { id: 's4', sequence: 1, status: 'done', eta_min: 0, km: 0.9, betrag: 22.0 },
      { id: 's5', sequence: 2, status: 'late', eta_min: 7, km: 3.2, betrag: 15.5 },
      { id: 's6', sequence: 3, status: 'pending', eta_min: 16, km: 1.5, betrag: 41.0 },
      { id: 's7', sequence: 4, status: 'pending', eta_min: 24, km: 2.0, betrag: 18.0 },
    ],
  },
  {
    id: 'd3', name: 'Tobias M.', score: 67, score_delta: +1, tier: 'gut', delay_risk: 'high', aktiv: true, route_eff: 61,
    stops: [
      { id: 's8', sequence: 1, status: 'active', eta_min: 6, km: 2.5, betrag: 33.0 },
      { id: 's9', sequence: 2, status: 'pending', eta_min: 18, km: 1.8, betrag: 27.0 },
    ],
  },
  {
    id: 'd4', name: 'Sara B.', score: 45, score_delta: -5, tier: 'schwach', delay_risk: 'high', aktiv: false, route_eff: 42,
    stops: [],
  },
];

export function DispatchPhase5120ScoreTourVisualisierungV21({ locationId }: Props) {
  const [drivers, setDrivers] = useState<Driver[]>(MOCK_DRIVERS);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!locationId) return;
    setLoading(true);
    fetch(`/api/delivery/admin/overview?location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.drivers?.length) setDrivers(data.drivers); })
      .catch(() => {})
      .finally(() => setLoading(false));
    const iv = setInterval(() => {
      fetch(`/api/delivery/admin/overview?location_id=${locationId}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.drivers?.length) setDrivers(data.drivers); })
        .catch(() => {});
    }, 20_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const fleetScore = Math.round(drivers.reduce((s, d) => s + d.score, 0) / Math.max(drivers.length, 1));
  const activeCount = drivers.filter(d => d.aktiv).length;
  const highRisk = drivers.filter(d => d.delay_risk === 'high').length;

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700/60 overflow-hidden text-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-purple-400" />
          <span className="font-semibold text-white">Score + Tour V21</span>
          {loading && <span className="w-3 h-3 border-2 border-slate-600 border-t-purple-400 rounded-full animate-spin" />}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-400">Fleet <span className="text-white font-bold ml-1">{fleetScore}</span></span>
          <span className="text-slate-400">Aktiv <span className="text-emerald-400 font-bold ml-1">{activeCount}</span></span>
          {highRisk > 0 && (
            <span className="flex items-center gap-1 text-red-400"><AlertTriangle className="w-3 h-3" />{highRisk}</span>
          )}
        </div>
      </div>

      {/* Driver list */}
      <div className="divide-y divide-slate-700/40">
        {drivers.map((d, i) => {
          const t = TIER_CONFIG[d.tier];
          const isOpen = expanded === d.id;
          return (
            <div key={d.id} className={cn('transition-colors', isOpen ? 'bg-slate-800/60' : 'hover:bg-slate-800/30')}>
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                onClick={() => setExpanded(isOpen ? null : d.id)}
              >
                {/* Rank */}
                <span className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0', t.bg, t.text)}>
                  {i + 1}
                </span>

                {/* Name + tier */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={cn('text-xs font-semibold', d.aktiv ? 'text-white' : 'text-slate-500')}>{d.name}</span>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full ring-1', t.ring, t.bg, t.text)}>{t.label}</span>
                    {!d.aktiv && <span className="text-[10px] text-slate-600">Offline</span>}
                  </div>
                  {/* Route eff bar */}
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all', t.bar)} style={{ width: `${d.route_eff}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-500">{d.route_eff}%</span>
                  </div>
                </div>

                {/* Score + delta */}
                <div className="text-right shrink-0">
                  <div className="flex items-center gap-1 justify-end">
                    {d.score_delta >= 0
                      ? <TrendingUp className="w-3 h-3 text-emerald-400" />
                      : <TrendingDown className="w-3 h-3 text-red-400" />}
                    <span className="text-lg font-bold text-white">{d.score}</span>
                  </div>
                  <span className={cn('text-[10px]', RISK[d.delay_risk].color)}>
                    {RISK[d.delay_risk].label}
                  </span>
                </div>

                {/* Stop dot sequence */}
                <div className="flex items-center gap-1 shrink-0">
                  {d.stops.slice(0, 6).map(s => (
                    <span key={s.id} className={cn('w-2.5 h-2.5 rounded-full', STOP_DOT[s.status])} />
                  ))}
                </div>
              </button>

              {/* Expanded stop timeline */}
              {isOpen && d.stops.length > 0 && (
                <div className="px-4 pb-3 space-y-1.5">
                  {d.stops.map(s => (
                    <div key={s.id} className="flex items-center gap-2 text-xs">
                      <span className={cn('w-2 h-2 rounded-full shrink-0', STOP_DOT[s.status])} />
                      <span className="text-slate-400">Stopp {s.sequence}</span>
                      {s.eta_min != null && s.eta_min > 0 && (
                        <span className="text-slate-500">{s.eta_min} min</span>
                      )}
                      {s.status === 'done' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                      {s.km != null && <span className="text-slate-600 ml-auto">{s.km} km</span>}
                      {s.betrag != null && <span className="text-slate-500">{s.betrag.toFixed(2)} €</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-4 py-1.5 border-t border-slate-700/40 text-center text-[10px] text-slate-600">
        20-Sek-Polling · Mock-Fallback
      </div>
    </div>
  );
}
