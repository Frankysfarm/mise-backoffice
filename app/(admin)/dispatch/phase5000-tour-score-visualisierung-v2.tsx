'use client';

import { useEffect, useState } from 'react';
import { Route, TrendingUp, TrendingDown, Star, Clock, MapPin, AlertTriangle, CheckCircle2, Zap, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface TourStop {
  stopp_nr: number;
  adresse: string;
  zone: string;
  status: 'geliefert' | 'aktiv' | 'ausstehend' | 'verspaetet';
  eta_min: number | null;
  ist_min: number | null;
  score_delta: number;
}

interface TourKpi {
  tour_id: string;
  fahrer_name: string;
  score: number;
  score_delta: number;
  stopps_gesamt: number;
  stopps_fertig: number;
  pct_puenktlich: number;
  avg_lieferzeit_min: number;
  umsatz: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  stopps: TourStop[];
}

interface ApiResponse {
  touren: TourKpi[];
  fleet_score: number;
  fleet_score_delta: number;
  alert: string | null;
  chart: { stunde: string; score: number; touren: number }[];
}

function euro(v: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}

const MOCK: ApiResponse = {
  fleet_score: 84,
  fleet_score_delta: 3,
  alert: null,
  chart: [
    { stunde: '11', score: 76, touren: 2 },
    { stunde: '12', score: 82, touren: 4 },
    { stunde: '13', score: 79, touren: 5 },
    { stunde: '14', score: 85, touren: 3 },
    { stunde: '17', score: 88, touren: 5 },
    { stunde: '18', score: 84, touren: 6 },
    { stunde: '19', score: 81, touren: 4 },
  ],
  touren: [
    {
      tour_id: 't1', fahrer_name: 'Jonas M.', score: 92, score_delta: 4, stopps_gesamt: 4, stopps_fertig: 3,
      pct_puenktlich: 100, avg_lieferzeit_min: 22, umsatz: 340, ampel: 'gruen',
      stopps: [
        { stopp_nr: 1, adresse: 'Hauptstr. 12', zone: 'Nord', status: 'geliefert', eta_min: 18, ist_min: 17, score_delta: 2 },
        { stopp_nr: 2, adresse: 'Bahnhofstr. 5', zone: 'Nord', status: 'geliefert', eta_min: 20, ist_min: 21, score_delta: -1 },
        { stopp_nr: 3, adresse: 'Marktplatz 3', zone: 'Mitte', status: 'geliefert', eta_min: 22, ist_min: 22, score_delta: 0 },
        { stopp_nr: 4, adresse: 'Gartenweg 7', zone: 'Süd', status: 'aktiv', eta_min: 5, ist_min: null, score_delta: 0 },
      ],
    },
    {
      tour_id: 't2', fahrer_name: 'Sara K.', score: 77, score_delta: -2, stopps_gesamt: 3, stopps_fertig: 1,
      pct_puenktlich: 67, avg_lieferzeit_min: 28, umsatz: 210, ampel: 'gelb',
      stopps: [
        { stopp_nr: 1, adresse: 'Lindenstr. 4', zone: 'West', status: 'geliefert', eta_min: 25, ist_min: 29, score_delta: -3 },
        { stopp_nr: 2, adresse: 'Rosenweg 8', zone: 'West', status: 'verspaetet', eta_min: 8, ist_min: null, score_delta: -4 },
        { stopp_nr: 3, adresse: 'Bergstr. 22', zone: 'Ost', status: 'ausstehend', eta_min: 15, ist_min: null, score_delta: 0 },
      ],
    },
  ],
};

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-green-400 border-green-700/50 bg-green-950/20';
  if (a === 'gelb') return 'text-yellow-400 border-yellow-700/50 bg-yellow-950/20';
  return 'text-red-400 border-red-700/50 bg-red-950/20';
}

function stoppStatusIcon(s: string) {
  if (s === 'geliefert') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
  if (s === 'aktiv') return <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />;
  if (s === 'verspaetet') return <AlertTriangle className="w-3.5 h-3.5 text-red-400" />;
  return <Clock className="w-3.5 h-3.5 text-slate-500" />;
}

function scoreFarbe(s: number) {
  if (s >= 90) return 'text-emerald-400';
  if (s >= 80) return 'text-green-400';
  if (s >= 70) return 'text-yellow-400';
  if (s >= 60) return 'text-orange-400';
  return 'text-red-400';
}

export function DispatchPhase5000TourScoreVisualisierungV2({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  async function load() {
    if (!locationId) { setData(MOCK); return; }
    try {
      const res = await fetch(`/api/delivery/dispatch/tour-scores?location_id=${locationId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        setData(MOCK);
      }
    } catch {
      setData(MOCK);
    }
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data) return null;

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="rounded-xl border border-violet-800/40 bg-slate-950/60 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Route className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-slate-200">Tour-Score Visualisierung V2</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-lg font-bold font-mono ${scoreFarbe(data.fleet_score)}`}>{data.fleet_score}</span>
          <span className={`text-xs flex items-center gap-0.5 ${data.fleet_score_delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {data.fleet_score_delta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(data.fleet_score_delta)}
          </span>
        </div>
      </div>

      {/* Alert */}
      {data.alert && (
        <div className="flex items-center gap-2 rounded-lg border border-red-700/60 bg-red-950/30 px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-xs text-red-300">{data.alert}</span>
        </div>
      )}

      {/* Score Chart */}
      <div className="rounded-lg bg-slate-900/50 border border-slate-800/50 p-2">
        <div className="text-xs text-slate-500 mb-2">Stunden-Score-Verlauf (heute)</div>
        <div className="h-20">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.chart} margin={{ top: 2, right: 2, left: -20, bottom: 0 }}>
              <XAxis dataKey="stunde" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
                formatter={(v: number | undefined) => [`Score: ${v ?? 0}`, '']}
              />
              <Bar dataKey="score" radius={[3, 3, 0, 0]}>
                {data.chart.map((entry, i) => (
                  <Cell key={i} fill={entry.score >= 85 ? '#22c55e' : entry.score >= 75 ? '#eab308' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Touren */}
      <div className="space-y-2">
        {data.touren.map(tour => (
          <div key={tour.tour_id} className={`rounded-xl border p-3 ${ampelColor(tour.ampel)}`}>
            {/* Tour Header */}
            <button
              className="w-full flex items-center justify-between"
              onClick={() => toggleExpand(tour.tour_id)}
            >
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 shrink-0" />
                <span className="text-sm font-semibold text-slate-200">{tour.fahrer_name}</span>
                <span className="text-xs text-slate-400">{tour.stopps_fertig}/{tour.stopps_gesamt} Stopps</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className={`text-base font-bold font-mono ${scoreFarbe(tour.score)}`}>{tour.score}</div>
                  <div className={`text-xs flex items-center justify-end gap-0.5 ${tour.score_delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {tour.score_delta >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                    {Math.abs(tour.score_delta)}
                  </div>
                </div>
              </div>
            </button>

            {/* Tour KPIs */}
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <div className="rounded bg-slate-900/50 p-1.5 text-center">
                <div className="text-xs text-slate-500">Pünktl.</div>
                <div className={`text-sm font-bold font-mono ${tour.pct_puenktlich >= 90 ? 'text-green-400' : tour.pct_puenktlich >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>{tour.pct_puenktlich}%</div>
              </div>
              <div className="rounded bg-slate-900/50 p-1.5 text-center">
                <div className="text-xs text-slate-500">Ø Zeit</div>
                <div className="text-sm font-bold font-mono text-slate-300">{tour.avg_lieferzeit_min} min</div>
              </div>
              <div className="rounded bg-slate-900/50 p-1.5 text-center">
                <div className="text-xs text-slate-500">Umsatz</div>
                <div className="text-sm font-bold font-mono text-slate-300">{euro(tour.umsatz)}</div>
              </div>
            </div>

            {/* Tour Stops (expandierbar) */}
            {expanded.has(tour.tour_id) && (
              <div className="mt-2 space-y-1.5 border-t border-slate-700/40 pt-2">
                {tour.stopps.map(stopp => (
                  <div key={stopp.stopp_nr} className="flex items-center gap-2 rounded bg-slate-900/40 px-2 py-1.5">
                    <span className="text-xs text-slate-500 w-4 shrink-0">{stopp.stopp_nr}.</span>
                    {stoppStatusIcon(stopp.status)}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-slate-300 truncate">{stopp.adresse}</div>
                      <div className="text-xs text-slate-500">{stopp.zone}</div>
                    </div>
                    {stopp.eta_min !== null && (
                      <div className="text-right shrink-0">
                        {stopp.ist_min !== null ? (
                          <div className={`text-xs font-mono ${stopp.ist_min <= stopp.eta_min ? 'text-green-400' : 'text-red-400'}`}>
                            {stopp.ist_min} min
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400 font-mono">ETA {stopp.eta_min} min</div>
                        )}
                      </div>
                    )}
                    {stopp.score_delta !== 0 && (
                      <span className={`text-xs font-mono shrink-0 ${stopp.score_delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {stopp.score_delta > 0 ? '+' : ''}{stopp.score_delta}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
