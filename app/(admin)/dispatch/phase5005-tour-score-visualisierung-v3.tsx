'use client';

import { useEffect, useState } from 'react';
import { Trophy, TrendingUp, TrendingDown, Star, Clock, MapPin, CheckCircle2, Zap, Leaf, Route } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ZoneKpi {
  zone: string;
  sla_pct: number;
  avg_min: number;
  umsatz: number;
  co2_kg: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface TourKpi {
  tour_id: string;
  fahrer_name: string;
  score: number;
  score_delta: number;
  tier: 'platin' | 'gold' | 'gut' | 'schwach';
  stopps_gesamt: number;
  stopps_fertig: number;
  pct_puenktlich: number;
  avg_lieferzeit_min: number;
  umsatz: number;
  co2_kg: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  expanded?: boolean;
}

interface ApiResponse {
  touren: TourKpi[];
  zonen: ZoneKpi[];
  fleet_score: number;
  fleet_score_delta: number;
  team_co2_gesamt_kg: number;
  team_co2_ziel_kg: number;
  alert: string | null;
  chart: { stunde: string; score: number; co2: number }[];
}

function euro(v: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}

const MOCK: ApiResponse = {
  fleet_score: 86,
  fleet_score_delta: 4,
  team_co2_gesamt_kg: 14.2,
  team_co2_ziel_kg: 20,
  alert: null,
  chart: [
    { stunde: '11', score: 74, co2: 1.8 },
    { stunde: '12', score: 80, co2: 2.4 },
    { stunde: '13', score: 79, co2: 2.6 },
    { stunde: '14', score: 85, co2: 1.9 },
    { stunde: '17', score: 89, co2: 2.1 },
    { stunde: '18', score: 86, co2: 2.2 },
    { stunde: '19', score: 83, co2: 1.2 },
  ],
  zonen: [
    { zone: 'Innenstadt', sla_pct: 94, avg_min: 21, umsatz: 820, co2_kg: 4.2, ampel: 'gruen' },
    { zone: 'Nord', sla_pct: 88, avg_min: 26, umsatz: 540, co2_kg: 5.1, ampel: 'gelb' },
    { zone: 'Süd', sla_pct: 75, avg_min: 31, umsatz: 310, co2_kg: 4.9, ampel: 'rot' },
  ],
  touren: [
    {
      tour_id: 't1', fahrer_name: 'Jonas M.', score: 93, score_delta: 5, tier: 'platin',
      stopps_gesamt: 5, stopps_fertig: 4, pct_puenktlich: 100, avg_lieferzeit_min: 21,
      umsatz: 420, co2_kg: 2.1, ampel: 'gruen',
    },
    {
      tour_id: 't2', fahrer_name: 'Sara K.', score: 79, score_delta: -2, tier: 'gut',
      stopps_gesamt: 4, stopps_fertig: 2, pct_puenktlich: 75, avg_lieferzeit_min: 27,
      umsatz: 310, co2_kg: 3.4, ampel: 'gelb',
    },
    {
      tour_id: 't3', fahrer_name: 'Mehmet A.', score: 65, score_delta: -6, tier: 'schwach',
      stopps_gesamt: 3, stopps_fertig: 1, pct_puenktlich: 50, avg_lieferzeit_min: 35,
      umsatz: 190, co2_kg: 4.6, ampel: 'rot',
    },
  ],
};

function tierStyle(t: string) {
  if (t === 'platin') return 'border-sky-400/60 bg-sky-950/30 text-sky-300';
  if (t === 'gold') return 'border-amber-400/60 bg-amber-950/30 text-amber-300';
  if (t === 'gut') return 'border-green-600/50 bg-green-950/20 text-green-400';
  return 'border-slate-600/50 bg-slate-800/30 text-slate-400';
}

function tierBadge(t: string) {
  if (t === 'platin') return 'bg-sky-900/60 text-sky-200 border-sky-600/50';
  if (t === 'gold') return 'bg-amber-900/60 text-amber-200 border-amber-600/50';
  if (t === 'gut') return 'bg-green-900/50 text-green-300 border-green-700/50';
  return 'bg-slate-800/60 text-slate-400 border-slate-600/50';
}

function scoreColor(v: number) {
  if (v >= 85) return 'text-green-400';
  if (v >= 70) return 'text-yellow-400';
  return 'text-red-400';
}

function zonAmpel(a: string) {
  if (a === 'gruen') return 'text-green-400';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-red-400';
}

export function DispatchPhase5005TourScoreVisualisierungV3() {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<'touren' | 'zonen'>('touren');

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/delivery/admin/tour-score', { cache: 'no-store' });
        if (res.ok) setData(await res.json());
      } catch {
        // Mock bleibt
      }
    };
    poll();
    const id = setInterval(poll, 20_000);
    return () => clearInterval(id);
  }, []);

  const co2Pct = Math.min(100, (data.team_co2_gesamt_kg / data.team_co2_ziel_kg) * 100);

  return (
    <div className="rounded-xl border border-violet-700/40 bg-gradient-to-b from-violet-950/60 to-slate-900/80 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-semibold text-violet-300">Tour-Score V3</span>
        </div>
        <div className="flex items-center gap-2">
          {data.fleet_score_delta !== 0 && (
            data.fleet_score_delta > 0
              ? <TrendingUp className="w-3.5 h-3.5 text-green-400" />
              : <TrendingDown className="w-3.5 h-3.5 text-red-400" />
          )}
          <span className={`text-xl font-bold ${scoreColor(data.fleet_score)}`}>{data.fleet_score}</span>
          <span className="text-xs text-slate-500">Fleet</span>
        </div>
      </div>

      {/* Alert */}
      {data.alert && (
        <div className="rounded-lg border border-red-600/50 bg-red-950/40 px-2.5 py-1.5 text-xs text-red-300">
          {data.alert}
        </div>
      )}

      {/* CO₂ Banner */}
      <div className="rounded-lg border border-lime-700/40 bg-lime-950/30 px-2.5 py-2">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <Leaf className="w-3.5 h-3.5 text-lime-400" />
            <span className="text-xs text-lime-300 font-medium">CO₂ Schicht</span>
          </div>
          <span className="text-xs font-bold text-lime-300">
            {data.team_co2_gesamt_kg.toFixed(1)} / {data.team_co2_ziel_kg} kg
          </span>
        </div>
        <div className="w-full h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${co2Pct < 60 ? 'bg-lime-500' : co2Pct < 85 ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${co2Pct}%` }}
          />
        </div>
      </div>

      {/* Score Chart */}
      <div className="rounded-lg border border-slate-700/40 bg-slate-800/30 p-2">
        <div className="text-[10px] text-slate-500 mb-1.5">Score-Verlauf (Stunden)</div>
        <ResponsiveContainer width="100%" height={52}>
          <BarChart data={data.chart} barSize={10}>
            <XAxis dataKey="stunde" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, fontSize: 10 }}
              formatter={(v: number) => [`Score: ${v}`, '']}
            />
            <Bar dataKey="score" radius={[3, 3, 0, 0]}>
              {data.chart.map((entry, i) => (
                <Cell key={i} fill={entry.score >= 85 ? '#22c55e' : entry.score >= 70 ? '#eab308' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tab Nav */}
      <div className="flex gap-1">
        {(['touren', 'zonen'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md py-1 text-xs font-medium transition-colors ${
              tab === t ? 'bg-violet-600 text-white' : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
            }`}
          >
            {t === 'touren' ? `Fahrer (${data.touren.length})` : `Zonen (${data.zonen.length})`}
          </button>
        ))}
      </div>

      {/* Touren Tab */}
      {tab === 'touren' && (
        <div className="space-y-2">
          {data.touren.map((tour) => (
            <div key={tour.tour_id} className={`rounded-lg border p-2.5 ${tierStyle(tour.tier)}`}>
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpanded((e) => ({ ...e, [tour.tour_id]: !e[tour.tour_id] }))}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-100">{tour.fahrer_name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${tierBadge(tour.tier)}`}>
                    {tour.tier === 'platin' ? '💎 Platin' : tour.tier === 'gold' ? '🥇 Gold' : tour.tier === 'gut' ? '✓ Gut' : '↓ Schwach'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5">
                    {tour.score_delta !== 0 && (
                      tour.score_delta > 0
                        ? <TrendingUp className="w-3 h-3 text-green-400" />
                        : <TrendingDown className="w-3 h-3 text-red-400" />
                    )}
                    <span className={`text-sm font-bold ${scoreColor(tour.score)}`}>{tour.score}</span>
                  </div>
                </div>
              </div>

              {/* Mini KPIs */}
              <div className="grid grid-cols-4 gap-1 mt-2">
                <div className="text-center">
                  <div className="text-[10px] text-slate-400">{tour.stopps_fertig}/{tour.stopps_gesamt}</div>
                  <div className="text-[9px] text-slate-500">Stopps</div>
                </div>
                <div className="text-center">
                  <div className={`text-[10px] ${tour.pct_puenktlich >= 85 ? 'text-green-400' : 'text-yellow-400'}`}>{tour.pct_puenktlich}%</div>
                  <div className="text-[9px] text-slate-500">Pünktl.</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-slate-300">{tour.avg_lieferzeit_min}min</div>
                  <div className="text-[9px] text-slate-500">Ø Zeit</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-lime-400">{tour.co2_kg}kg</div>
                  <div className="text-[9px] text-slate-500">CO₂</div>
                </div>
              </div>

              {/* Fortschrittsbalken */}
              <div className="w-full h-1 bg-slate-700/60 rounded-full overflow-hidden mt-2">
                <div
                  className={`h-full rounded-full ${tour.ampel === 'gruen' ? 'bg-green-500' : tour.ampel === 'gelb' ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${(tour.stopps_fertig / Math.max(1, tour.stopps_gesamt)) * 100}%` }}
                />
              </div>

              {/* Umsatz */}
              {expanded[tour.tour_id] && (
                <div className="mt-2 pt-2 border-t border-slate-700/40 flex justify-between items-center">
                  <span className="text-[10px] text-slate-500">Umsatz</span>
                  <span className="text-xs font-semibold text-slate-200">{euro(tour.umsatz)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Zonen Tab */}
      {tab === 'zonen' && (
        <div className="space-y-2">
          {data.zonen.map((z) => (
            <div key={z.zone} className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-200">{z.zone}</span>
                </div>
                <div className={`flex items-center gap-1 text-xs font-bold ${zonAmpel(z.ampel)}`}>
                  <CheckCircle2 className="w-3 h-3" />
                  {z.sla_pct}% SLA
                </div>
              </div>
              <div className="w-full h-1.5 bg-slate-700/60 rounded-full overflow-hidden mb-1.5">
                <div
                  className={`h-full rounded-full ${z.ampel === 'gruen' ? 'bg-green-500' : z.ampel === 'gelb' ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${z.sla_pct}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-1 text-center">
                <div>
                  <div className="text-[10px] text-slate-300">{z.avg_min}min</div>
                  <div className="text-[9px] text-slate-500">Ø Zeit</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-300">{euro(z.umsatz)}</div>
                  <div className="text-[9px] text-slate-500">Umsatz</div>
                </div>
                <div>
                  <div className="text-[10px] text-lime-400">{z.co2_kg}kg</div>
                  <div className="text-[9px] text-slate-500">CO₂</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-[9px] text-slate-600 text-right">20s-Polling · Mock-Fallback</div>
    </div>
  );
}
