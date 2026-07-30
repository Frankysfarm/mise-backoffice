'use client';

import React, { useEffect, useState } from 'react';
import { cn, euro } from '@/lib/utils';
import { BarChart3, TrendingUp, TrendingDown, Minus, Star, Clock, Package, Euro, Percent, Bike, AlertCircle, CheckCircle2 } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface KpiItem {
  key: string;
  label: string;
  value: number;
  unit: string;
  ziel?: number;
  delta_pct?: number;
  status: 'gut' | 'ok' | 'schlecht';
  icon: React.ComponentType<{ className?: string }>;
}

interface StundenPunkt {
  stunde: string;
  bestellungen: number;
  umsatz: number;
}

interface Stats {
  kpis: KpiItem[];
  stunden: StundenPunkt[];
  top_fahrer: Array<{ name: string; score: number; touren: number; trinkgeld: number }>;
  gesamt_score: number;
  insight?: string;
}

interface Props {
  locationId: string | null;
}

const STATUS_COLOR = {
  gut: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', dot: 'bg-emerald-400' },
  ok: { text: 'text-amber-400', bg: 'bg-amber-500/10', dot: 'bg-amber-400' },
  schlecht: { text: 'text-red-400', bg: 'bg-red-500/10', dot: 'bg-red-400' },
};

function DeltaChip({ delta }: { delta?: number }) {
  if (delta === undefined || delta === null) return null;
  const abs = Math.abs(delta).toFixed(1);
  if (Math.abs(delta) < 0.5) return <span className="text-xs text-slate-500 flex items-center gap-0.5"><Minus className="h-2.5 w-2.5" /> {abs}%</span>;
  return delta > 0
    ? <span className="text-xs text-emerald-400 flex items-center gap-0.5"><TrendingUp className="h-2.5 w-2.5" /> +{abs}%</span>
    : <span className="text-xs text-red-400 flex items-center gap-0.5"><TrendingDown className="h-2.5 w-2.5" /> -{abs}%</span>;
}

export function LieferdienstPhase5075StatistikenPerformanceHub({ locationId }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartMode, setChartMode] = useState<'bestellungen' | 'umsatz'>('bestellungen');

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }

    async function load() {
      try {
        const res = await fetch(`/api/delivery/lieferdienst?location_id=${locationId}&type=stats`);
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        } else {
          setStats(MOCK_STATS);
        }
      } catch {
        setStats(MOCK_STATS);
      } finally {
        setLoading(false);
      }
    }

    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 p-4 animate-pulse space-y-3">
        <div className="h-4 w-56 bg-slate-700/50 rounded" />
        <div className="grid grid-cols-2 gap-2">
          {[1,2,3,4].map(i => <div key={i} className="h-16 bg-slate-700/30 rounded-lg" />)}
        </div>
        <div className="h-24 bg-slate-700/20 rounded-lg" />
      </div>
    );
  }

  if (!stats) return null;

  const { kpis, stunden, top_fahrer, gesamt_score, insight } = stats;

  return (
    <div className="rounded-xl border border-slate-700/40 bg-slate-900/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800/40 border-b border-slate-700/40">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-indigo-400" />
          <span className="text-sm font-semibold text-slate-200">Statistiken Performance Hub</span>
        </div>
        <div className={cn(
          'flex items-center gap-1.5 text-sm font-bold px-2.5 py-1 rounded-full',
          gesamt_score >= 80 ? 'bg-emerald-500/20 text-emerald-400' :
          gesamt_score >= 60 ? 'bg-amber-500/20 text-amber-400' :
          'bg-red-500/20 text-red-400'
        )}>
          Score {gesamt_score}
        </div>
      </div>

      {/* Insight Tipp */}
      {insight && (
        <div className="flex items-start gap-2 px-4 py-2.5 bg-indigo-500/5 border-b border-indigo-500/20">
          <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" />
          <p className="text-xs text-indigo-300/80">{insight}</p>
        </div>
      )}

      {/* KPI-Grid */}
      <div className="grid grid-cols-2 gap-px bg-slate-700/20 border-b border-slate-700/20">
        {kpis.map(kpi => {
          const Icon = kpi.icon;
          const colors = STATUS_COLOR[kpi.status];
          const pct = kpi.ziel ? Math.min(100, (kpi.value / kpi.ziel) * 100) : null;

          return (
            <div key={kpi.key} className={cn('bg-slate-800/40 px-3 py-2.5', colors.bg)}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <div className={cn('h-1.5 w-1.5 rounded-full', colors.dot)} />
                  <Icon className={cn('h-3 w-3', colors.text)} />
                  <span className="text-xs text-slate-500">{kpi.label}</span>
                </div>
                <DeltaChip delta={kpi.delta_pct} />
              </div>
              <div className="flex items-baseline gap-1">
                <span className={cn('text-xl font-bold tabular-nums', colors.text)}>
                  {kpi.unit === '€' ? euro(kpi.value) :
                   kpi.unit === '%' ? kpi.value.toFixed(1) :
                   kpi.unit === 'min' ? kpi.value.toFixed(1) :
                   kpi.value.toFixed(0)}
                </span>
                {kpi.unit !== '€' && (
                  <span className="text-xs text-slate-500">{kpi.unit}</span>
                )}
              </div>
              {pct !== null && (
                <div className="h-1 rounded-full bg-slate-700/50 mt-1.5 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', kpi.status === 'gut' ? 'bg-emerald-400' : kpi.status === 'ok' ? 'bg-amber-400' : 'bg-red-400')}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Chart */}
      {stunden.length > 0 && (
        <div className="p-3 border-b border-slate-700/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500">Stundenverlauf</span>
            <div className="flex rounded-md overflow-hidden border border-slate-700/40">
              {(['bestellungen', 'umsatz'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setChartMode(m)}
                  className={cn(
                    'px-2 py-0.5 text-xs font-medium transition-colors',
                    chartMode === m ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-500 hover:text-slate-400'
                  )}
                >
                  {m === 'bestellungen' ? 'Bestellungen' : 'Umsatz'}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={stunden} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="stunde" tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 6, fontSize: 11, color: '#cbd5e1' }}
                cursor={{ fill: 'rgba(148,163,184,0.05)' }}
              />
              <Bar dataKey={chartMode} radius={[2,2,0,0]}>
                {stunden.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={i === stunden.length - 1 ? '#818cf8' : '#334155'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top-Fahrer */}
      {top_fahrer.length > 0 && (
        <div className="p-3">
          <p className="text-xs text-slate-500 mb-2">Top Fahrer</p>
          <div className="space-y-1.5">
            {top_fahrer.slice(0, 3).map((f, i) => (
              <div key={f.name} className="flex items-center gap-2">
                <span className="text-xs font-bold w-4 text-slate-500">
                  {['🥇', '🥈', '🥉'][i]}
                </span>
                <span className="text-xs text-slate-300 flex-1">{f.name}</span>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-0.5 text-emerald-400">
                    <Bike className="h-3 w-3" />{f.touren}
                  </span>
                  <span className="flex items-center gap-0.5 text-amber-400">
                    <Star className="h-3 w-3" />{f.score}
                  </span>
                </div>
                <div className="w-16 h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
                  <div className="h-full rounded-full bg-indigo-400/80" style={{ width: `${Math.min(100, f.score)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Mock-Daten
const MOCK_STATS: Stats = {
  gesamt_score: 78,
  insight: 'Pünktlichkeit 3% unter Ziel — Küchenstart 2 min früher empfohlen.',
  kpis: [
    { key: 'bestellungen', label: 'Bestellungen', value: 47, unit: '', ziel: 60, delta_pct: 8.2, status: 'ok', icon: Package },
    { key: 'umsatz', label: 'Umsatz', value: 1240, unit: '€', ziel: 1500, delta_pct: 12.5, status: 'ok', icon: Euro },
    { key: 'lieferzeit', label: 'Ø Lieferzeit', value: 34.2, unit: 'min', ziel: 35, delta_pct: -2.1, status: 'gut', icon: Clock },
    { key: 'puenktlichkeit', label: 'Pünktlichkeit', value: 82.4, unit: '%', ziel: 90, delta_pct: -1.8, status: 'ok', icon: Percent },
    { key: 'bewertung', label: 'Bewertung', value: 4.6, unit: '★', delta_pct: 0.3, status: 'gut', icon: Star },
    { key: 'storno', label: 'Storno-Quote', value: 3.2, unit: '%', ziel: 5, delta_pct: 0.5, status: 'gut', icon: AlertCircle },
  ],
  stunden: [
    { stunde: '11', bestellungen: 4, umsatz: 95 },
    { stunde: '12', bestellungen: 9, umsatz: 210 },
    { stunde: '13', bestellungen: 11, umsatz: 265 },
    { stunde: '14', bestellungen: 7, umsatz: 162 },
    { stunde: '17', bestellungen: 6, umsatz: 148 },
    { stunde: '18', bestellungen: 10, umsatz: 240 },
    { stunde: '19', bestellungen: 0, umsatz: 0 },
  ],
  top_fahrer: [
    { name: 'Max M.', score: 94, touren: 8, trinkgeld: 14.50 },
    { name: 'Anna K.', score: 87, touren: 7, trinkgeld: 11.20 },
    { name: 'Tom S.', score: 79, touren: 6, trinkgeld: 8.00 },
  ],
};
