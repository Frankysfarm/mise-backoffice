'use client';

/**
 * StoppTimingStatistik — Phase 315
 *
 * Statistik-Dashboard für Stopp-Timing-Qualität der aktuellen Schicht.
 * Zeigt: Pünktlichkeit, Ø Delay, bester Fahrer, stündliche Verteilung.
 * Polling alle 60 s auf /api/delivery/admin/stop-timing-stats
 */

import { useEffect, useRef, useState } from 'react';
import { BarChart, Bar, Cell, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import {
  Award, Clock, Target, TrendingDown, TrendingUp, Timer, CheckCircle2, AlertTriangle,
} from 'lucide-react';

interface HourBucket {
  hour: number;
  label: string;
  completed: number;
  onTime: number;
  avgDelayMin: number;
}

interface StatsData {
  avgDeliveryTimeMin: number;
  onTimePct: number;
  latePct: number;
  totalStopsCompleted: number;
  avgDelayMinutes: number;
  bestDriverId: string | null;
  bestDriverName: string | null;
  bestDriverOnTimePct: number;
  perHour: HourBucket[];
}

function KpiTile({
  label, value, sub, color, icon,
}: {
  label: string; value: string; sub?: string;
  color: string; icon: React.ReactNode;
}) {
  return (
    <div className={cn('rounded-xl p-3 border', color)}>
      <div className="flex items-center gap-2 mb-1">
        <div className="opacity-70">{icon}</div>
        <span className="text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</span>
      </div>
      <div className="text-xl font-black tabular-nums leading-none">{value}</div>
      {sub && <div className="text-[10px] mt-0.5 opacity-60">{sub}</div>}
    </div>
  );
}

export function StoppTimingStatistik({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    try {
      const url = `/api/delivery/admin/stop-timing-stats${locationId ? `?location_id=${encodeURIComponent(locationId)}` : ''}`;
      const res = await fetch(url, { cache: 'no-store' }).catch(() => null);
      if (!res?.ok) return;
      const d = await res.json();
      setData(d);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 60_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="h-4 w-40 bg-stone-100 rounded animate-pulse mb-3" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-14 bg-stone-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.totalStopsCompleted === 0) return null;

  const onTimeColor = data.onTimePct >= 85 ? 'bg-matcha-50 border-matcha-200 text-matcha-800'
    : data.onTimePct >= 70 ? 'bg-amber-50 border-amber-200 text-amber-800'
    : 'bg-red-50 border-red-200 text-red-800';

  const delayColor = data.avgDelayMinutes <= 2 ? 'bg-matcha-50 border-matcha-200 text-matcha-800'
    : data.avgDelayMinutes <= 5 ? 'bg-amber-50 border-amber-200 text-amber-800'
    : 'bg-red-50 border-red-200 text-red-800';

  const chartData = data.perHour.map(h => ({
    name: h.label,
    pünktlich: h.onTime,
    verspätet: h.completed - h.onTime,
  }));

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 border-b border-stone-100 hover:bg-stone-50 transition text-left"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100 text-matcha-700 shrink-0">
          <Timer className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-char">Stopp-Timing Statistik</div>
          <div className="text-xs text-stone-400">
            {data.totalStopsCompleted} Stopps dieser Schicht · {data.onTimePct}% pünktlich
          </div>
        </div>
        <div className={cn(
          'text-[10px] font-black rounded-full px-2.5 py-1',
          data.onTimePct >= 85 ? 'bg-matcha-100 text-matcha-700' : data.onTimePct >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700',
        )}>
          {data.onTimePct >= 85 ? '✓ Gut' : data.onTimePct >= 70 ? '⚡ Mittel' : '⚠ Kritisch'}
        </div>
      </button>

      {open && (
        <div className="p-5 space-y-4">
          {/* KPI-Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiTile
              label="Pünktlich"
              value={`${data.onTimePct}%`}
              sub={`${data.totalStopsCompleted} Stopps gesamt`}
              color={onTimeColor}
              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            />
            <KpiTile
              label="Ø Lieferzeit"
              value={`${data.avgDeliveryTimeMin} Min`}
              sub="seit Abfahrt"
              color="bg-blue-50 border-blue-200 text-blue-800"
              icon={<Clock className="h-3.5 w-3.5" />}
            />
            <KpiTile
              label="Ø Verzug"
              value={data.avgDelayMinutes > 0 ? `+${data.avgDelayMinutes} Min` : '0 Min'}
              sub={`${data.latePct}% der Stopps`}
              color={delayColor}
              icon={<AlertTriangle className="h-3.5 w-3.5" />}
            />
            <KpiTile
              label="Top-Fahrer"
              value={data.bestDriverName ? `${data.bestDriverOnTimePct}%` : '—'}
              sub={data.bestDriverName ?? 'noch keine Daten'}
              color="bg-purple-50 border-purple-200 text-purple-800"
              icon={<Award className="h-3.5 w-3.5" />}
            />
          </div>

          {/* Stündliches Chart */}
          {chartData.length > 1 && (
            <div>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                Stopps je Stunde (Pünktlich vs. Verspätet)
              </div>
              <div className="h-28">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barSize={14} barGap={2}>
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 9, fill: '#a8a29e' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 8 }}
                      formatter={(v: number, name: string) => [v, name === 'pünktlich' ? 'Pünktlich' : 'Verspätet']}
                    />
                    <Bar dataKey="pünktlich" stackId="a" radius={[0, 0, 0, 0]}>
                      {chartData.map((_, i) => <Cell key={i} fill="#65a30d" />)}
                    </Bar>
                    <Bar dataKey="verspätet" stackId="a" radius={[3, 3, 0, 0]}>
                      {chartData.map((_, i) => <Cell key={i} fill="#f87171" />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Legende */}
              <div className="flex items-center gap-4 mt-1">
                <div className="flex items-center gap-1">
                  <div className="h-2 w-4 rounded bg-matcha-500" />
                  <span className="text-[9px] text-stone-500">Pünktlich</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-2 w-4 rounded bg-red-400" />
                  <span className="text-[9px] text-stone-500">Verspätet</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
