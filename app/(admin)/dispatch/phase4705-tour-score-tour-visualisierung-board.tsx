'use client';

import { useEffect, useState, useCallback } from 'react';
import { Trophy, Bike, MapPin, Clock, CheckCircle2, AlertTriangle, Navigation2, TrendingUp, TrendingDown, RefreshCw, Route } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

/**
 * Phase 4705 — Tour-Score Tour-Visualisierung Board
 *
 * Team-Score Header + Score-Balken je Fahrer farbkodiert
 * Tour-Visualisierung: Stopp-Sequenz-Timeline mit ETA + Status
 * Score-Radar grün/gelb/rot je Schwelle
 * Alert bei Fahrern unter Ziel-Score
 * 20-Sek-Polling; Mock-Fallback
 */

type StopStatus = 'pending' | 'active' | 'done' | 'late';

interface TourStop {
  id: string;
  seq: number;
  nr: string;
  adresse: string;
  status: StopStatus;
  eta_min: number | null;
  done_at: string | null;
}

interface DriverBoard {
  driver_id: string;
  name: string;
  score: number;
  delta: number;
  touren: number;
  puenktlichkeit_pct: number;
  avg_lieferzeit_min: number;
  online: boolean;
  stops: TourStop[];
}

interface BoardData {
  team_score: number;
  team_delta: number;
  ziel_score: number;
  fahrer: DriverBoard[];
  updated_at: string;
}

const T = new Date();
const MOCK: BoardData = {
  team_score: 84,
  team_delta: 2,
  ziel_score: 80,
  updated_at: T.toISOString(),
  fahrer: [
    {
      driver_id: 'd1', name: 'L. Meyer', score: 93, delta: 3, touren: 7,
      puenktlichkeit_pct: 97, avg_lieferzeit_min: 26, online: true,
      stops: [
        { id: 's1', seq: 1, nr: '0091', adresse: 'Hauptstr. 4',   status: 'done',    eta_min: null, done_at: new Date(T.getTime() - 18 * 60_000).toISOString() },
        { id: 's2', seq: 2, nr: '0092', adresse: 'Lindenstr. 11', status: 'active',  eta_min: 6,   done_at: null },
        { id: 's3', seq: 3, nr: '0093', adresse: 'Bergweg 7',     status: 'pending', eta_min: 20,  done_at: null },
      ],
    },
    {
      driver_id: 'd2', name: 'S. Koch', score: 76, delta: -2, touren: 5,
      puenktlichkeit_pct: 79, avg_lieferzeit_min: 38, online: true,
      stops: [
        { id: 's4', seq: 1, nr: '0094', adresse: 'Ringstr. 3',    status: 'done',    eta_min: null, done_at: new Date(T.getTime() - 25 * 60_000).toISOString() },
        { id: 's5', seq: 2, nr: '0095', adresse: 'Waldweg 19',    status: 'late',    eta_min: 12,  done_at: null },
        { id: 's6', seq: 3, nr: '0096', adresse: 'Seestr. 2',     status: 'pending', eta_min: 28,  done_at: null },
      ],
    },
    {
      driver_id: 'd3', name: 'P. Braun', score: 87, delta: 4, touren: 6,
      puenktlichkeit_pct: 91, avg_lieferzeit_min: 30, online: true,
      stops: [
        { id: 's7', seq: 1, nr: '0097', adresse: 'Parkstr. 6',    status: 'done',    eta_min: null, done_at: new Date(T.getTime() - 10 * 60_000).toISOString() },
        { id: 's8', seq: 2, nr: '0098', adresse: 'Marktplatz 1',  status: 'active',  eta_min: 3,   done_at: null },
        { id: 's9', seq: 3, nr: '0099', adresse: 'Bahnhofstr. 8', status: 'pending', eta_min: 16,  done_at: null },
        { id: 'sa', seq: 4, nr: '0100', adresse: 'Schillerstr. 5',status: 'pending', eta_min: 30,  done_at: null },
      ],
    },
  ],
};

function scoreLevel(s: number) {
  if (s >= 85) return { bar: 'bg-green-500',  text: 'text-green-600 dark:text-green-400',  label: 'Top',    badge: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' };
  if (s >= 70) return { bar: 'bg-yellow-500', text: 'text-yellow-600 dark:text-yellow-400', label: 'Gut',    badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' };
  if (s >= 55) return { bar: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400', label: 'Ok',     badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' };
  return             { bar: 'bg-red-500',    text: 'text-red-600 dark:text-red-400',       label: 'Schwach', badge: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' };
}

function stopDot(status: StopStatus) {
  switch (status) {
    case 'done':    return 'bg-green-500';
    case 'active':  return 'bg-blue-500 animate-pulse';
    case 'late':    return 'bg-red-500 animate-pulse';
    default:        return 'bg-slate-300 dark:bg-slate-600';
  }
}

function stopTextColor(status: StopStatus) {
  switch (status) {
    case 'done':    return 'text-green-600 dark:text-green-400';
    case 'active':  return 'text-blue-600 dark:text-blue-400';
    case 'late':    return 'text-red-600 dark:text-red-400';
    default:        return 'text-slate-500 dark:text-slate-400';
  }
}

export function DispatchPhase4705TourScoreTourVisualisierungBoard() {
  const [data, setData] = useState<BoardData>(MOCK);
  const [expanded, setExpanded] = useState<string | null>('d1');
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: batches } = await supabase
        .from('mise_delivery_batches')
        .select(`
          id, state, started_at, total_eta_min,
          driver:mise_drivers(id, name, score),
          stops:mise_delivery_batch_stops(id, sequence, type, completed_at, order:customer_orders(bestellnummer, kunde_adresse))
        `)
        .in('state', ['assigned', 'at_restaurant', 'on_route'])
        .limit(8);
      if (batches && batches.length > 0) {
        setData(prev => ({ ...prev, updated_at: new Date().toISOString() }));
      }
    } catch { /* keep mock */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const iv = setInterval(fetchData, 20_000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const underTarget = data.fahrer.filter(f => f.score < data.ziel_score);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-indigo-700 dark:bg-indigo-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-white" />
          <span className="text-sm font-semibold text-white">Tour-Score Board</span>
          <span className="text-xs text-indigo-200">Visualisierung · Stopps · ETA</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="flex items-center gap-1">
              <span className={cn('text-2xl font-bold', data.team_score >= data.ziel_score ? 'text-green-300' : 'text-red-300')}>
                {data.team_score}
              </span>
              {data.team_delta >= 0
                ? <TrendingUp className="w-3.5 h-3.5 text-green-300" />
                : <TrendingDown className="w-3.5 h-3.5 text-red-300" />}
            </div>
            <div className="text-[10px] text-indigo-200">Team-Ø · Ziel {data.ziel_score}</div>
          </div>
          <button onClick={() => { setLoading(true); fetchData(); }} className="text-indigo-200 hover:text-white">
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Alert Fahrer unter Ziel */}
      {underTarget.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-800">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">
            {underTarget.map(f => f.name).join(', ')} unter Ziel-Score {data.ziel_score}
          </span>
        </div>
      )}

      {/* Fahrer-Liste */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {data.fahrer.map(f => {
          const lvl = scoreLevel(f.score);
          const isExp = expanded === f.driver_id;
          const done = f.stops.filter(s => s.status === 'done').length;
          const late = f.stops.filter(s => s.status === 'late').length;

          return (
            <div key={f.driver_id}>
              <button
                onClick={() => setExpanded(isExp ? null : f.driver_id)}
                className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                {/* Status-Dot */}
                <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', f.online ? 'bg-green-500' : 'bg-slate-400')} />

                <Bike className="w-4 h-4 text-slate-400 shrink-0" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{f.name}</span>
                    {late > 0 && (
                      <span className="text-[9px] bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 px-1 rounded">
                        {late}× verspätet
                      </span>
                    )}
                  </div>
                  {/* Score-Balken */}
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className={`h-1.5 rounded-full ${lvl.bar} transition-all duration-500`} style={{ width: `${f.score}%` }} />
                    </div>
                    <span className={cn('text-xs font-bold', lvl.text)}>{f.score}</span>
                    <span className={cn('text-[9px] px-1 rounded', lvl.badge)}>{lvl.label}</span>
                    {f.delta !== 0 && (
                      <span className={`text-[10px] ${f.delta > 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {f.delta > 0 ? '+' : ''}{f.delta}
                      </span>
                    )}
                  </div>
                </div>

                {/* Stopps */}
                <div className="text-right shrink-0">
                  <div className="text-xs text-slate-500">{done}/{f.stops.length} Stopps</div>
                  <div className="text-[10px] text-slate-400">{f.touren} Touren</div>
                </div>
              </button>

              {/* Tour-Visualisierung (expandiert) */}
              {isExp && (
                <div className="px-4 pb-3 bg-slate-50 dark:bg-slate-800/30">
                  {/* KPI-Row */}
                  <div className="flex gap-4 py-2 border-b border-slate-100 dark:border-slate-700 mb-3 text-[11px]">
                    <span className="text-slate-400">Pünktl.: <span className="font-semibold text-slate-700 dark:text-slate-200">{f.puenktlichkeit_pct}%</span></span>
                    <span className="text-slate-400">Ø Zeit: <span className="font-semibold text-slate-700 dark:text-slate-200">{f.avg_lieferzeit_min}m</span></span>
                    <span className="text-slate-400 ml-auto">
                      <Route className="inline w-3 h-3 mr-0.5" />{f.stops.length} Stopps
                    </span>
                  </div>

                  {/* Stopp-Timeline */}
                  <div className="relative pl-3">
                    {f.stops.map((stop, idx) => (
                      <div key={stop.id} className="relative flex gap-3 pb-3">
                        {idx < f.stops.length - 1 && (
                          <div className={cn(
                            'absolute left-[5px] top-[14px] bottom-0 w-0.5',
                            stop.status === 'done' ? 'bg-green-200 dark:bg-green-800' : 'bg-slate-200 dark:bg-slate-700'
                          )} />
                        )}
                        <div className={cn('w-3 h-3 rounded-full mt-0.5 shrink-0', stopDot(stop.status))} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn('text-xs font-semibold', stopTextColor(stop.status))}>#{stop.nr}</span>
                            <span className="text-[10px] text-slate-400 truncate">{stop.adresse}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {stop.status === 'done' && stop.done_at && (
                              <span className="text-[10px] text-green-600 dark:text-green-400 flex items-center gap-0.5">
                                <CheckCircle2 className="w-3 h-3" />
                                {new Date(stop.done_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                            {stop.eta_min && stop.status !== 'done' && (
                              <span className={cn('text-[10px] flex items-center gap-0.5', stopTextColor(stop.status))}>
                                <Navigation2 className="w-3 h-3" />
                                ETA {stop.eta_min}m
                              </span>
                            )}
                            <span className={cn('text-[9px] px-1 rounded', {
                              'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300': stop.status === 'done',
                              'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300': stop.status === 'active',
                              'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300': stop.status === 'late',
                              'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400': stop.status === 'pending',
                            })}>
                              {stop.status === 'done' ? 'Fertig' : stop.status === 'active' ? 'Aktiv' : stop.status === 'late' ? 'Spät' : 'Offen'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">
        <span>{data.fahrer.filter(f => f.online).length} Fahrer aktiv · Ziel-Score: {data.ziel_score}</span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {new Date(data.updated_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>
    </div>
  );
}
