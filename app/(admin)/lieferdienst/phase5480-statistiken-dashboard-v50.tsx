'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { BarChart, Bar, Cell, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart2, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Users, Euro, Clock, Star, Target, Trophy, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn, euro } from '@/lib/utils';

// Phase 5480 — Statistiken Dashboard V50
// Alert-Strip; Gesamt-Score-Balken; 8-KPI-Grid 2-spaltig Ampel+Δ%+Ziel-Balken;
// Insight-Tipp; Stundenverlauf BarChart umschaltbar Bestellungen/Umsatz Jetzt-Stunde violet;
// Top-3-Fahrer Score+Touren+Trinkgeld; Zonen-SLA-Balken; 60-Sek-Polling; Mock-Fallback

interface KPI {
  key: string; label: string; value: number; unit: string; delta: number;
  ziel: number; icon: React.ElementType; invertDelta?: boolean;
}

interface HourlyBucket { h: number; label: string; bestellungen: number; umsatz: number }
interface TopDriver { name: string; score: number; touren: number; trinkgeld: number }
interface Zone { name: string; sla: number; avg_min: number }

interface Stats {
  score: number; kpis: KPI[]; hourly: HourlyBucket[];
  top_drivers: TopDriver[]; zones: Zone[]; insight: string;
}

const MOCK: Stats = {
  score: 78,
  insight: 'Pünktlichkeit liegt 4% über Vorwoche — Fahrer Nico W. führt das Ranking an.',
  kpis: [
    { key: 'bestellungen', label: 'Bestellungen',    value: 87,    unit: '',  delta: +12,  ziel: 100, icon: Target },
    { key: 'umsatz',       label: 'Umsatz',          value: 2340,  unit: '€', delta: +8,   ziel: 3000, icon: Euro },
    { key: 'lieferzeit',   label: 'Ø Lieferzeit',    value: 28,    unit: 'min', delta: -5,  ziel: 30, icon: Clock, invertDelta: true },
    { key: 'puenktlich',   label: 'Pünktlichkeit',   value: 82,    unit: '%', delta: +4,   ziel: 90, icon: CheckCircle2 },
    { key: 'fahrer',       label: 'Fahrer online',   value: 5,     unit: '',  delta: 0,    ziel: 6, icon: Users },
    { key: 'bewertung',    label: 'Bewertung',        value: 4.6,   unit: '★', delta: +0.1, ziel: 4.8, icon: Star },
    { key: 'storno',       label: 'Storno-Rate',      value: 2.1,   unit: '%', delta: -0.3, ziel: 2.0, icon: AlertTriangle, invertDelta: true },
    { key: 'trinkgeld',    label: 'Trinkgeld',        value: 124,   unit: '€', delta: +15,  ziel: 150, icon: Zap },
  ],
  hourly: [
    { h: 11, label: '11h', bestellungen: 8,  umsatz: 210 },
    { h: 12, label: '12h', bestellungen: 19, umsatz: 510 },
    { h: 13, label: '13h', bestellungen: 24, umsatz: 648 },
    { h: 14, label: '14h', bestellungen: 17, umsatz: 459 },
    { h: 15, label: '15h', bestellungen: 11, umsatz: 297 },
    { h: 16, label: '16h', bestellungen: 8,  umsatz: 216 },
  ],
  top_drivers: [
    { name: 'Nico W.',  score: 94, touren: 8, trinkgeld: 38 },
    { name: 'Sara K.',  score: 81, touren: 6, trinkgeld: 27 },
    { name: 'Tom B.',   score: 67, touren: 5, trinkgeld: 19 },
  ],
  zones: [
    { name: 'Mitte',   sla: 88, avg_min: 26 },
    { name: 'Nord',    sla: 74, avg_min: 31 },
    { name: 'West',    sla: 92, avg_min: 24 },
    { name: 'Süd',     sla: 61, avg_min: 38 },
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

interface Props { locationId?: string | null; className?: string }

export function LieferdienstPhase5480StatistikenDashboardV50({ locationId, className }: Props) {
  const [data, setData] = useState<Stats>(MOCK);
  const [chartMode, setChartMode] = useState<'bestellungen' | 'umsatz'>('bestellungen');
  const nowH = new Date().getHours();

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/stats/shift?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (json.score !== undefined) setData(json); }
    } catch { /* Mock-Fallback */ }
  }, [locationId]);

  useEffect(() => { load(); const iv = setInterval(load, 60_000); return () => clearInterval(iv); }, [load]);

  const criticalKPIs = useMemo(() => data.kpis.filter(k => ampel(k) === 'red'), [data.kpis]);

  return (
    <Card className={cn('bg-white border border-gray-200 shadow-sm p-4 space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-indigo-600" />
          <span className="font-semibold text-sm text-gray-800">Statistiken Dashboard V50</span>
        </div>
        <div className="text-xs text-gray-500">{new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div>
      </div>

      {/* Alert Strip */}
      {criticalKPIs.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
          <span className="text-xs text-red-700 font-medium">
            {criticalKPIs.map(k => k.label).join(', ')} — unter Ziel
          </span>
        </div>
      )}

      {/* Score Bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-600">Gesamt-Score</span>
          <span className={cn('text-sm font-bold', data.score >= 80 ? 'text-emerald-600' : data.score >= 60 ? 'text-yellow-600' : 'text-red-600')}>{data.score}/100</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full transition-all', data.score >= 80 ? 'bg-emerald-500' : data.score >= 60 ? 'bg-yellow-400' : 'bg-red-500')}
            style={{ width: `${data.score}%` }} />
        </div>
        {data.insight && <p className="text-xs text-gray-500 mt-1.5 italic">{data.insight}</p>}
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-2">
        {data.kpis.map(kpi => {
          const status = ampel(kpi);
          const pct = Math.min(100, (kpi.value / kpi.ziel) * 100);
          const Icon = kpi.icon;
          return (
            <div key={kpi.key} className="bg-gray-50 rounded-xl p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className={cn('h-2 w-2 rounded-full', AMPEL_DOT[status])} />
                  <Icon className="h-3.5 w-3.5 text-gray-400" />
                  <span className="text-[11px] text-gray-500 truncate">{kpi.label}</span>
                </div>
                <span className={cn('text-[11px] font-medium', kpi.delta >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                  {kpi.delta > 0 ? '+' : ''}{kpi.delta}{kpi.unit === '%' ? 'pp' : ''}
                </span>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-base font-bold text-gray-800">
                  {kpi.unit === '€' ? euro(kpi.value * 100) : `${kpi.value}${kpi.unit}`}
                </span>
                <span className="text-[10px] text-gray-400">Ziel: {kpi.unit === '€' ? euro(kpi.ziel * 100) : `${kpi.ziel}${kpi.unit}`}</span>
              </div>
              <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full', status === 'green' ? 'bg-emerald-400' : status === 'yellow' ? 'bg-yellow-400' : 'bg-red-400')}
                  style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Stundenverlauf Chart */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-700">Stundenverlauf</span>
          <div className="flex gap-1">
            {(['bestellungen', 'umsatz'] as const).map(m => (
              <button key={m} onClick={() => setChartMode(m)}
                className={cn('px-2 py-0.5 rounded text-[11px] font-medium transition-colors',
                  chartMode === m ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600')}>
                {m === 'bestellungen' ? 'Bestellg.' : 'Umsatz'}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={data.hourly} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v: number) => chartMode === 'umsatz' ? [euro(v * 100), 'Umsatz'] : [v, 'Bestellungen']} />
            <Bar dataKey={chartMode} radius={[3, 3, 0, 0]}>
              {data.hourly.map(e => (
                <Cell key={e.h} fill={e.h === nowH ? '#7c3aed' : '#e0e7ff'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top Fahrer */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Trophy className="h-4 w-4 text-yellow-500" />
          <span className="text-xs font-semibold text-gray-700">Top Fahrer</span>
        </div>
        <div className="space-y-1.5">
          {data.top_drivers.map((d, i) => (
            <div key={d.name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-gray-400 w-4">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                <span className="font-medium text-gray-700">{d.name}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-500">
                <span className="font-semibold text-gray-800">{d.score}</span>
                <span>{d.touren} Touren</span>
                <span className="text-yellow-600">{euro(d.trinkgeld * 100)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Zonen SLA */}
      <div>
        <span className="text-xs font-semibold text-gray-700 block mb-2">Zonen-SLA</span>
        <div className="grid grid-cols-2 gap-1.5">
          {data.zones.map(z => (
            <div key={z.name} className="bg-gray-50 rounded-lg p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-gray-700">{z.name}</span>
                <span className={cn('text-[11px] font-bold', z.sla >= 85 ? 'text-emerald-600' : z.sla >= 70 ? 'text-yellow-600' : 'text-red-600')}>{z.sla}%</span>
              </div>
              <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full', z.sla >= 85 ? 'bg-emerald-400' : z.sla >= 70 ? 'bg-yellow-400' : 'bg-red-400')}
                  style={{ width: `${z.sla}%` }} />
              </div>
              <span className="text-[10px] text-gray-400">Ø {z.avg_min} min</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-gray-400">
        <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Live Statistiken</span>
        <span>60-Sek-Polling</span>
      </div>
    </Card>
  );
}
