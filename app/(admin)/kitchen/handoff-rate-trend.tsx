'use client';

/**
 * KitchenHandoffRateTrend — 30-Tage Trend der Handoff-Wartezeiten
 * Zeigt: quickRatePct (grün), lateRatePct (rot), avgWaitMin (grau)
 * als Recharts-LineChart. Collapsible, 10-Min-Polling.
 */

import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HistoryRow {
  snapshotDate: string;
  totalOrders: number;
  quickPickups: number;
  latePickups: number;
  avgWaitMin: number | null;
  quickRatePct: number | null;
  lateRatePct: number | null;
}

interface ApiResponse {
  ok: boolean;
  history: HistoryRow[];
}

interface Props {
  locationId: string | null;
}

const DAYS = 30;

export function KitchenHandoffRateTrend({ locationId }: Props) {
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId || !open) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/delivery/admin/handoff-rate?action=history&days=${DAYS}&location_id=${locationId}`,
        );
        if (!res.ok) return;
        const json: ApiResponse = await res.json();
        if (!cancelled && json.ok) setHistory(json.history ?? []);
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const t = setInterval(load, 10 * 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [locationId, open]);

  // Letzte 14 Tage für den Chart (übersichtlicher)
  const chartData = history.slice(-14).map((r) => ({
    date:         r.snapshotDate.slice(5),   // MM-DD
    schnell:      r.quickRatePct,
    spät:         r.lateRatePct,
    avgMin:       r.avgWaitMin,
    orders:       r.totalOrders,
  }));

  const last = history[history.length - 1];
  const prev = history[history.length - 2];
  const lateRateDelta = last && prev && last.lateRatePct != null && prev.lateRatePct != null
    ? last.lateRatePct - prev.lateRatePct
    : null;

  const headerColor =
    last?.lateRatePct != null && last.lateRatePct > 20
      ? 'text-red-600 bg-red-50 border-red-200'
      : last?.lateRatePct != null && last.lateRatePct > 10
      ? 'text-amber-600 bg-amber-50 border-amber-200'
      : 'text-matcha-700 bg-matcha-50 border-matcha-200';

  return (
    <div className={cn('rounded-xl border overflow-hidden', headerColor)}>
      {/* Header — immer sichtbar */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:opacity-80 transition-opacity"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider">Handoff-Trend 30 Tage</span>
          {last?.lateRatePct != null && (
            <span className="text-xs font-black tabular-nums ml-1">
              {last.lateRatePct.toFixed(1)}% verspätet
              {lateRateDelta != null && (
                <span className={cn('ml-1', lateRateDelta > 0 ? 'text-red-600' : 'text-matcha-700')}>
                  {lateRateDelta > 0 ? '↑' : '↓'}{Math.abs(lateRateDelta).toFixed(1)}%
                </span>
              )}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {/* Body */}
      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-current/20">
          {loading && history.length === 0 ? (
            <div className="flex items-center gap-2 py-4 text-muted-foreground text-xs">
              <Clock className="h-4 w-4 animate-pulse" />
              Lade Verlauf…
            </div>
          ) : chartData.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              Noch keine Tages-Snapshots vorhanden.
              <br />
              Der Cron läuft täglich um 01:55 UTC.
            </div>
          ) : (
            <>
              {/* KPI-Leiste (letzter Tag) */}
              {last && (
                <div className="grid grid-cols-4 gap-2 pt-3">
                  {[
                    { label: 'Schnell <3 Min', value: last.quickRatePct != null ? `${last.quickRatePct.toFixed(1)}%` : '–', sub: `${last.quickPickups} Orders` },
                    { label: 'Verspätet >5 Min', value: last.lateRatePct != null ? `${last.lateRatePct.toFixed(1)}%` : '–', sub: `${last.latePickups} Orders` },
                    { label: 'Ø Warte-Min', value: last.avgWaitMin != null ? `${last.avgWaitMin.toFixed(1)} Min` : '–', sub: 'Durchschnitt' },
                    { label: 'Gesamt', value: String(last.totalOrders), sub: last.snapshotDate.slice(5) },
                  ].map((k) => (
                    <div key={k.label} className="text-center">
                      <div className="text-base font-black tabular-nums">{k.value}</div>
                      <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider leading-tight">
                        {k.label}
                      </div>
                      <div className="text-[9px] text-muted-foreground">{k.sub}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* LineChart */}
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 9, fill: '#6b7280' }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickFormatter={(v: number) => `${v}%`}
                    tick={{ fontSize: 9, fill: '#6b7280' }}
                    domain={[0, 100]}
                  />
                  <Tooltip
                    formatter={(value: unknown, name: unknown) =>
                      name === 'avgMin'
                        ? [`${Number(value).toFixed(1)} Min`, 'Ø Wartezeit']
                        : [`${Number(value).toFixed(1)}%`, name === 'schnell' ? 'Schnell (<3 Min)' : 'Verspätet (>5 Min)']
                    }
                    contentStyle={{ fontSize: 11 }}
                  />
                  <Legend
                    formatter={(value: string) =>
                      value === 'schnell' ? 'Schnell (<3 Min)' : value === 'spät' ? 'Verspätet (>5 Min)' : 'Ø Warte-Min'
                    }
                    wrapperStyle={{ fontSize: 10 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="schnell"
                    stroke="#16a34a"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="spät"
                    stroke="#dc2626"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>

              <p className="text-[9px] text-muted-foreground text-right">
                Ziel: Verspätet &lt; 15% · Schnell &gt; 70%
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
