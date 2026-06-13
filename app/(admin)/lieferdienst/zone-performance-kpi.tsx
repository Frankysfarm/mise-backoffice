'use client';

/**
 * ZonePerformanceKpi — Detailliertes Zonen-Performance-Dashboard für den Lieferdienst.
 * Zeigt je Zone A–D: Lieferungen, Ø Zeit, SLA%, Umsatz, Trend.
 * Ergänzt den bestehenden Stats-View mit einem dedizierten Zonen-Vergleich.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { BarChart, Bar, Cell, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { MapPin, TrendingDown, TrendingUp, Zap } from 'lucide-react';

type ZoneRow = {
  zone: string;
  totalStops: number;
  onTimeCount: number;
  lateCount: number;
  onTimePct: number;
  avgDeviationMin: number;
  avgDeliveryMin: number;
};

type EtaData = {
  summary: {
    totalStops: number;
    onTimeCount: number;
    lateCount: number;
    onTimePct: number;
    avgDeviationMin: number;
    avgDeliveryMin: number;
  };
  byZone: Record<string, {
    totalStops: number;
    onTimeCount: number;
    onTimePct: number;
    avgDeviationMin: number;
    avgDeliveryMin?: number;
  }>;
};

const ZONE_COLORS: Record<string, string> = {
  A: '#22c55e', B: '#3b82f6', C: '#f59e0b', D: '#ef4444',
};
const ZONE_BG: Record<string, string> = {
  A: 'bg-green-50 border-green-200',
  B: 'bg-blue-50 border-blue-200',
  C: 'bg-amber-50 border-amber-200',
  D: 'bg-red-50 border-red-200',
};
const ZONE_TEXT: Record<string, string> = {
  A: 'text-green-700', B: 'text-blue-700', C: 'text-amber-700', D: 'text-red-700',
};

function SlaBar({ pct }: { pct: number }) {
  const color = pct >= 85 ? 'bg-green-500' : pct >= 70 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px]">
        <span className="text-muted-foreground">SLA</span>
        <span className={cn('font-black tabular-nums', pct >= 85 ? 'text-green-700' : pct >= 70 ? 'text-amber-700' : 'text-red-700')}>
          {pct.toFixed(0)}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ZonePerformanceKpi({ locationId }: { locationId: string }) {
  const [data, setData] = useState<EtaData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/admin/eta-accuracy?location_id=${locationId}&period=today`);
        if (res.ok && !cancelled) {
          setData(await res.json());
        }
      } catch { /* noop */ } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const iv = setInterval(load, 120_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (loading && !data) {
    return (
      <div className="rounded-xl border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground animate-pulse">
        Lade Zonen-Performance…
      </div>
    );
  }

  if (!data) return null;

  const zones: ZoneRow[] = Object.entries(data.byZone)
    .filter(([, v]) => v.totalStops > 0)
    .map(([zone, v]) => ({
      zone,
      totalStops: v.totalStops,
      onTimeCount: v.onTimeCount,
      lateCount: v.totalStops - v.onTimeCount,
      onTimePct: v.onTimePct,
      avgDeviationMin: v.avgDeviationMin,
      avgDeliveryMin: v.avgDeliveryMin ?? 0,
    }))
    .sort((a, b) => a.zone.localeCompare(b.zone));

  const chartData = zones.map((z) => ({
    zone: `Zone ${z.zone}`,
    pünktlich: z.onTimeCount,
    verspätet: z.lateCount,
    fill: ZONE_COLORS[z.zone] ?? '#94a3b8',
  }));

  const overallPct = data.summary.onTimePct;
  const bestZone = zones.length > 0 ? zones.reduce((best, z) => z.onTimePct > best.onTimePct ? z : best, zones[0]) : null;
  const worstZone = zones.length > 0 ? zones.reduce((worst, z) => z.onTimePct < worst.onTimePct ? z : worst, zones[0]) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <span className="font-bold text-sm">Zonen-Performance</span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          Gesamt SLA: <strong className={overallPct >= 85 ? 'text-green-700' : overallPct >= 70 ? 'text-amber-700' : 'text-red-700'}>{overallPct.toFixed(0)}%</strong>
        </span>
      </div>

      {/* Zone Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {zones.map((z) => (
          <div key={z.zone} className={cn('rounded-xl border p-3 space-y-2', ZONE_BG[z.zone] ?? 'bg-stone-50 border-stone-200')}>
            <div className="flex items-center justify-between">
              <span className={cn('font-black text-sm', ZONE_TEXT[z.zone] ?? 'text-stone-700')}>Zone {z.zone}</span>
              <span className="text-[10px] text-muted-foreground font-bold">{z.totalStops} Stopps</span>
            </div>
            <SlaBar pct={z.onTimePct} />
            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
              <div className="rounded-lg bg-white/60 px-2 py-1 text-center">
                <div className="font-black text-base tabular-nums">{z.avgDeliveryMin > 0 ? `${z.avgDeliveryMin.toFixed(0)}m` : '–'}</div>
                <div className="text-muted-foreground">Ø Lieferzeit</div>
              </div>
              <div className="rounded-lg bg-white/60 px-2 py-1 text-center">
                <div className={cn('font-black text-base tabular-nums', z.avgDeviationMin > 5 ? 'text-red-600' : z.avgDeviationMin > 2 ? 'text-amber-600' : 'text-green-600')}>
                  {z.avgDeviationMin >= 0 ? '+' : ''}{z.avgDeviationMin.toFixed(0)}m
                </div>
                <div className="text-muted-foreground">Ø Abweichung</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Comparison Chart */}
      {chartData.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
            Pünktlich vs. Verspätet je Zone
          </div>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={chartData} barSize={28} barGap={4}>
              <XAxis dataKey="zone" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(value, name) => [`${value} Stopps`, name === 'pünktlich' ? 'Pünktlich' : 'Verspätet']}
                contentStyle={{ fontSize: 11 }}
              />
              <Bar dataKey="pünktlich" fill="#22c55e" radius={[3, 3, 0, 0]} />
              <Bar dataKey="verspätet" fill="#ef4444" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Best/Worst Zone Callout */}
      {bestZone && worstZone && bestZone.zone !== worstZone.zone && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2.5 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-600 shrink-0" />
            <div>
              <div className="text-[10px] text-green-600 font-bold uppercase tracking-wide">Beste Zone</div>
              <div className="font-black text-sm text-green-800">Zone {bestZone.zone} · {bestZone.onTimePct.toFixed(0)}% pünktlich</div>
            </div>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-600 shrink-0" />
            <div>
              <div className="text-[10px] text-red-600 font-bold uppercase tracking-wide">Schwächste Zone</div>
              <div className="font-black text-sm text-red-800">Zone {worstZone.zone} · {worstZone.onTimePct.toFixed(0)}% pünktlich</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
