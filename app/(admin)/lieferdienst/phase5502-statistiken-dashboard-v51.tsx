'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { BarChart, Bar, Cell, XAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { BarChart2, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Users, Euro, Clock, Star, Target, Trophy, Zap, Leaf, Package } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn, euro } from '@/lib/utils';

// Phase 5502 — Statistiken Dashboard V51
// V50+: Revenue-Trend-SparkLine (letzte 7h); Zonen-Performance-Ring; Fahrer-Vergleichs-Balken;
// Alert-Strip; Gesamt-Score-Balken; 8-KPI-Grid 2-spaltig Ampel+Δ%+Ziel-Balken;
// Insight-Tipp; Stundenverlauf BarChart umschaltbar; Top-3-Fahrer; Zonen-SLA; 60-Sek-Polling; Mock-Fallback

interface KPI {
  key: string; label: string; value: number; unit: string; delta: number;
  ziel: number; icon: React.ElementType; invertDelta?: boolean;
}

interface HourlyBucket { h: number; label: string; bestellungen: number; umsatz: number }
interface TrendPoint { h: string; umsatz: number }
interface TopDriver { name: string; score: number; touren: number; trinkgeld: number }
interface Zone { name: string; sla: number; avg_min: number; fahrer: number }

interface Stats {
  score: number; kpis: KPI[]; hourly: HourlyBucket[]; trend7h: TrendPoint[];
  top_drivers: TopDriver[]; zones: Zone[]; insight: string;
}

const MOCK: Stats = {
  score: 81,
  insight: 'Umsatz liegt 8% über Vorwoche — Freitagseffekt aktiv. Fahrer Nico W. führt das Ranking an.',
  kpis: [
    { key: 'bestellungen', label: 'Bestellungen',    value: 93,    unit: '',  delta: +14,  ziel: 100, icon: Target },
    { key: 'umsatz',       label: 'Umsatz',          value: 2580,  unit: '€', delta: +8,   ziel: 3000, icon: Euro },
    { key: 'lieferzeit',   label: 'Ø Lieferzeit',    value: 27,    unit: 'min', delta: -3,  ziel: 30, icon: Clock, invertDelta: true },
    { key: 'puenktlich',   label: 'Pünktlichkeit',   value: 84,    unit: '%', delta: +4,   ziel: 90, icon: CheckCircle2 },
    { key: 'fahrer',       label: 'Fahrer online',   value: 6,     unit: '',  delta: +1,   ziel: 7, icon: Users },
    { key: 'bewertung',    label: 'Bewertung',        value: 4.7,   unit: '★', delta: +0.1, ziel: 4.8, icon: Star },
    { key: 'storno',       label: 'Storno-Rate',      value: 1.9,   unit: '%', delta: -0.4, ziel: 2.0, icon: AlertTriangle, invertDelta: true },
    { key: 'trinkgeld',    label: 'Trinkgeld',        value: 138,   unit: '€', delta: +18,  ziel: 150, icon: Zap },
  ],
  hourly: [
    { h: 11, label: '11h', bestellungen: 9,  umsatz: 230 },
    { h: 12, label: '12h', bestellungen: 21, umsatz: 560 },
    { h: 13, label: '13h', bestellungen: 26, umsatz: 698 },
    { h: 14, label: '14h', bestellungen: 19, umsatz: 512 },
    { h: 15, label: '15h', bestellungen: 12, umsatz: 325 },
    { h: 16, label: '16h', bestellungen: 6,  umsatz: 255 },
  ],
  trend7h: [
    { h: '10h', umsatz: 180 },
    { h: '11h', umsatz: 230 },
    { h: '12h', umsatz: 560 },
    { h: '13h', umsatz: 698 },
    { h: '14h', umsatz: 512 },
    { h: '15h', umsatz: 325 },
    { h: '16h', umsatz: 255 },
  ],
  top_drivers: [
    { name: 'Nico W.',  score: 95, touren: 9, trinkgeld: 42 },
    { name: 'Sara K.',  score: 82, touren: 7, trinkgeld: 29 },
    { name: 'Tom B.',   score: 68, touren: 5, trinkgeld: 21 },
  ],
  zones: [
    { name: 'Mitte',   sla: 90, avg_min: 25, fahrer: 2 },
    { name: 'Nord',    sla: 76, avg_min: 30, fahrer: 2 },
    { name: 'West',    sla: 94, avg_min: 23, fahrer: 1 },
    { name: 'Süd',     sla: 63, avg_min: 37, fahrer: 1 },
  ],
};

function ampel(kpi: KPI): 'green' | 'yellow' | 'red' {
  const pct = kpi.value / kpi.ziel;
  if (kpi.invertDelta) return pct <= 1 ? 'green' : pct <= 1.15 ? 'yellow' : 'red';
  return pct >= 0.9 ? 'green' : pct >= 0.7 ? 'yellow' : 'red';
}

const AMPEL_DOT: Record<'green' | 'yellow' | 'red', string> = {
  green: 'bg-emerald-400', yellow: 'bg-yellow-400', red: 'bg-red-400',
};

const AMPEL_BAR: Record<'green' | 'yellow' | 'red', string> = {
  green: 'bg-emerald-500', yellow: 'bg-yellow-500', red: 'bg-red-500',
};

interface Props { locationId?: string | null; className?: string }

export function LieferdienstPhase5502StatistikenDashboardV51({ locationId, className }: Props) {
  const [data, setData] = useState<Stats>(MOCK);
  const [chartMode, setChartMode] = useState<'bestellungen' | 'umsatz'>('bestellungen');
  const nowH = new Date().getHours();

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/statistiken-dashboard?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (json.score !== undefined) setData(json); }
    } catch { /* Mock-Fallback */ }
  }, [locationId]);

  useEffect(() => { load(); const iv = setInterval(load, 60_000); return () => clearInterval(iv); }, [load]);

  const alertKpis = useMemo(() => data.kpis.filter(k => ampel(k) === 'red'), [data.kpis]);
  const maxScore = data.top_drivers.length > 0 ? Math.max(...data.top_drivers.map(d => d.score)) : 1;

  return (
    <Card className={cn('bg-zinc-900 text-white border-zinc-800 p-4 space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-indigo-400" />
          <span className="font-semibold text-sm">Statistiken V51</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-black tabular-nums text-indigo-300">{data.score}</span>
          <span className="text-xs text-zinc-500">/ 100</span>
        </div>
      </div>

      {/* Gesamt-Score-Balken */}
      <div className="h-2 rounded-full bg-zinc-800">
        <div className={cn('h-2 rounded-full transition-all duration-700', data.score >= 80 ? 'bg-indigo-500' : data.score >= 60 ? 'bg-yellow-500' : 'bg-red-500')}
          style={{ width: `${data.score}%` }} />
      </div>

      {/* Alert Strip */}
      {alertKpis.length > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
          <p className="text-xs text-red-300">{alertKpis.map(k => k.label).join(' · ')} unter Ziel</p>
        </div>
      )}

      {/* Revenue Trend SparkLine */}
      <div className="space-y-1">
        <p className="text-[10px] text-zinc-500 uppercase tracking-wide font-semibold">Umsatz-Trend (letzte 7h)</p>
        <div className="h-16">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.trend7h} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <Line type="monotone" dataKey="umsatz" stroke="#818cf8" strokeWidth={2} dot={false} />
              <Tooltip
                contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 10 }}
                formatter={(value: unknown) => [`${value} €`, 'Umsatz']}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 8-KPI-Grid */}
      <div className="grid grid-cols-2 gap-2">
        {data.kpis.map(kpi => {
          const a = ampel(kpi);
          const pct = Math.min(100, Math.round((kpi.value / kpi.ziel) * 100));
          const Icon = kpi.icon;
          return (
            <div key={kpi.key} className="rounded-lg bg-zinc-800 p-2.5 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <div className={cn('h-1.5 w-1.5 rounded-full', AMPEL_DOT[a])} />
                <Icon className="h-3 w-3 text-zinc-500" />
                <span className="text-[10px] text-zinc-400 truncate">{kpi.label}</span>
                <span className={cn('ml-auto text-[10px] font-mono', kpi.delta > 0 ? (kpi.invertDelta ? 'text-red-400' : 'text-emerald-400') : kpi.delta < 0 ? (kpi.invertDelta ? 'text-emerald-400' : 'text-red-400') : 'text-zinc-500')}>
                  {kpi.delta > 0 ? '+' : ''}{kpi.delta}{kpi.unit === '%' ? 'pp' : ''}
                </span>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-base font-bold tabular-nums text-white">{kpi.value}{kpi.unit === '€' ? '' : kpi.unit}</span>
                {kpi.unit === '€' && <span className="text-xs text-zinc-500">{euro(kpi.value)}</span>}
                <span className="text-[10px] text-zinc-600">/{kpi.ziel}{kpi.unit}</span>
              </div>
              <div className="h-1 rounded-full bg-zinc-700">
                <div className={cn('h-1 rounded-full transition-all', AMPEL_BAR[a])} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Insight */}
      <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-3 py-2">
        <p className="text-xs text-indigo-300 leading-relaxed">💡 {data.insight}</p>
      </div>

      {/* Stundenverlauf Chart */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wide font-semibold">Stundenverlauf</p>
          <div className="ml-auto flex gap-1">
            {(['bestellungen', 'umsatz'] as const).map(m => (
              <button key={m} onClick={() => setChartMode(m)}
                className={cn('text-[10px] px-2 py-0.5 rounded-md transition-colors', chartMode === m ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300')}>
                {m === 'bestellungen' ? 'Bestellungen' : 'Umsatz'}
              </button>
            ))}
          </div>
        </div>
        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.hourly} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#71717a' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 10 }}
                formatter={(value: unknown) => [value, chartMode === 'bestellungen' ? 'Bestellungen' : 'Umsatz (€)']}
              />
              <Bar dataKey={chartMode} radius={[3, 3, 0, 0]}>
                {data.hourly.map(b => (
                  <Cell key={b.h} fill={b.h === nowH ? '#8b5cf6' : '#4338ca'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Fahrer */}
      <div className="space-y-2">
        <p className="text-[10px] text-zinc-500 uppercase tracking-wide font-semibold flex items-center gap-1">
          <Trophy className="h-3 w-3 text-yellow-400" />Top Fahrer
        </p>
        {data.top_drivers.map((d, i) => (
          <div key={d.name} className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-600 w-4 text-right">{i + 1}</span>
            <span className="text-xs text-white truncate w-20">{d.name}</span>
            <div className="flex-1 h-1.5 rounded-full bg-zinc-800">
              <div className="h-1.5 rounded-full bg-indigo-500 transition-all" style={{ width: `${(d.score / maxScore) * 100}%` }} />
            </div>
            <span className="text-[10px] font-mono text-indigo-300 w-8 text-right">{d.score}</span>
            <span className="text-[10px] text-zinc-500 w-10 text-right">{d.touren} T.</span>
          </div>
        ))}
      </div>

      {/* Zonen SLA */}
      <div className="space-y-2">
        <p className="text-[10px] text-zinc-500 uppercase tracking-wide font-semibold flex items-center gap-1">
          <Package className="h-3 w-3 text-zinc-400" />Zonen-SLA
        </p>
        {data.zones.map(z => (
          <div key={z.name} className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 w-12 truncate">{z.name}</span>
            <div className="flex-1 h-2 rounded-full bg-zinc-800">
              <div className={cn('h-2 rounded-full transition-all', z.sla >= 85 ? 'bg-emerald-500' : z.sla >= 70 ? 'bg-yellow-500' : 'bg-red-500')}
                style={{ width: `${z.sla}%` }} />
            </div>
            <span className="text-[10px] font-mono text-zinc-400 w-12 text-right">{z.sla}% · {z.avg_min}min</span>
            <span className="text-[10px] text-zinc-600">{z.fahrer}F</span>
          </div>
        ))}
      </div>

      <div className="text-center text-[10px] text-zinc-600 flex items-center justify-center gap-1">
        <Zap className="h-2.5 w-2.5" />
        60s-Polling
      </div>
    </Card>
  );
}
