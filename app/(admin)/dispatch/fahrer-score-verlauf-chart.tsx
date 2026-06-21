'use client';

import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DriverOption {
  id: string;
  name: string | null;
}

interface TrendPoint {
  week: string;
  score: number;
  benchmark: number | null;
}

interface Props {
  locationId: string | null;
}

/* Dispatch: Einzel-Fahrer-Score-Verlauf mit Benchmark-Overlay.
   Manager wählt Fahrer aus Dropdown, sieht 8-Wochen-Trend vs. Standort-Ø. */
export function DispatchFahrerScoreVerlaufChart({ locationId }: Props) {
  const [open, setOpen] = useState(false);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [points, setPoints] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    const load = async () => {
      try {
        const r = await fetch(
          `/api/delivery/admin/driver-score?location_id=${encodeURIComponent(locationId)}&action=leaderboard&limit=20`,
        );
        if (!r.ok) return;
        const d = await r.json();
        const opts: DriverOption[] = (d.entries ?? []).map((e: Record<string, unknown>) => ({
          id:   String(e.driverId ?? ''),
          name: (e.driverName as string | null) ?? null,
        }));
        setDrivers(opts);
        if (opts.length > 0 && !selectedId) setSelectedId(opts[0].id);
      } catch { /* silent */ }
    };
    load();
  }, [locationId, selectedId]);

  useEffect(() => {
    if (!open || !locationId || !selectedId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [histRes, benchRes] = await Promise.all([
          fetch(`/api/delivery/admin/driver-score?location_id=${encodeURIComponent(locationId)}&action=history&driver_id=${encodeURIComponent(selectedId)}&weeks=8`),
          fetch(`/api/delivery/admin/driver-score-benchmarks?location_id=${encodeURIComponent(locationId)}&weeks=8`),
        ]);
        if (cancelled) return;

        const histData = histRes.ok ? await histRes.json() : { rows: [] };
        const benchData = benchRes.ok ? await benchRes.json() : { benchmarks: [] };

        const benchMap = new Map<string, number>();
        for (const b of benchData.benchmarks ?? []) {
          benchMap.set(String(b.weekStart ?? ''), Number(b.avgComposite ?? 0));
        }

        const pts: TrendPoint[] = (histData.rows ?? []).map((r: Record<string, unknown>) => ({
          week:      String(r.periodStart ?? '').slice(5),
          score:     Number(r.compositeScore ?? 0),
          benchmark: benchMap.get(String(r.periodStart ?? '')) ?? null,
        }));
        if (!cancelled) setPoints(pts);
      } catch { /* silent */ }
      finally { if (!cancelled) setLoading(false); }
    };

    load();
    const t = setInterval(load, 10 * 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [open, locationId, selectedId]);

  if (!locationId) return null;

  const trend = points.length >= 2
    ? points.at(-1)!.score - points.at(-2)!.score
    : 0;

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-matcha-600" />
          <span className="font-semibold text-stone-800 text-sm">Score-Verlauf Einzelfahrer</span>
          {points.length > 0 && (
            <span className={cn(
              'text-xs font-medium px-1.5 py-0.5 rounded',
              trend > 0 ? 'text-emerald-700 bg-emerald-50' : trend < 0 ? 'text-red-700 bg-red-50' : 'text-stone-500 bg-stone-100',
            )}>
              {trend > 0 ? '+' : ''}{Math.round(trend * 10) / 10} Pkt
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
      </button>

      {open && (
        <div className="border-t border-stone-100 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-stone-400" />
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="text-sm border border-stone-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-matcha-400"
            >
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>{d.name ?? d.id.slice(0, 8)}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="h-32 flex items-center justify-center text-stone-400 text-sm">Lade…</div>
          ) : points.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-stone-400 text-sm">
              Noch keine Verlaufsdaten — Cron läuft täglich 02:50 UTC
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={28} />
                <Tooltip formatter={(val: unknown) => [`${Number(val).toFixed(1)} Pkt`]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={60} stroke="#d1d5db" strokeDasharray="4 2" label={{ value: 'B', fontSize: 10, fill: '#9ca3af' }} />
                <Line type="monotone" dataKey="score" name="Score" stroke="#4ade80" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="benchmark" name="Standort-Ø" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  );
}
