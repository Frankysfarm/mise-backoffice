'use client';

import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Cell, Tooltip, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WeekBar {
  week: string;
  score: number;
  grade: string;
}

interface Props {
  driverId: string;
  locationId: string;
}

const GRADE_COLOR: Record<string, string> = {
  'A+': '#10b981',
  'A':  '#34d399',
  'B':  '#60a5fa',
  'C':  '#fbbf24',
  'D':  '#f87171',
};

const GRADE_MSG: Record<string, string> = {
  'A+': 'Spitzenklasse! Du bist Top-Performer! 🏆',
  'A':  'Sehr gute Arbeit — weiter so! ✨',
  'B':  'Solide Performance — Steigerung möglich!',
  'C':  'Noch Luft nach oben — du schaffst das!',
  'D':  'Lass uns zusammen deinen Score verbessern.',
};

/* Fahrer-App: persönlicher Score-Verlauf der letzten 8 Wochen als BarChart. */
export function FahrerWochenScoreVerlauf({ driverId, locationId }: Props) {
  const [bars, setBars] = useState<WeekBar[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!driverId || !locationId) { setLoading(false); return; }

    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(
          `/api/delivery/admin/driver-score?location_id=${encodeURIComponent(locationId)}&action=history&driver_id=${encodeURIComponent(driverId)}&weeks=8`,
        );
        if (!r.ok || cancelled) return;
        const d = await r.json();
        const data: WeekBar[] = (d.rows ?? []).map((row: Record<string, unknown>) => ({
          week:  String(row.periodStart ?? '').slice(5),
          score: Number(row.compositeScore ?? 0),
          grade: String(row.grade ?? 'D'),
        }));
        if (!cancelled) setBars(data);
      } catch { /* silent */ }
      finally { if (!cancelled) setLoading(false); }
    };

    load();
    const t = setInterval(load, 10 * 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [driverId, locationId]);

  if (loading || bars.length === 0) return null;

  const latest = bars.at(-1);
  const prev   = bars.at(-2);
  const delta  = latest && prev ? latest.score - prev.score : 0;
  const grade  = latest?.grade ?? 'D';

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-400" />
          <span className="font-semibold text-stone-800 text-sm">Mein Score-Verlauf</span>
        </div>
        <div className={cn(
          'flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border',
          delta > 0 ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
            : delta < 0 ? 'text-red-700 bg-red-50 border-red-200'
            : 'text-stone-500 bg-stone-50 border-stone-200',
        )}>
          {delta > 0 ? <TrendingUp className="h-3 w-3" /> : delta < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
          {delta > 0 ? '+' : ''}{Math.round(delta * 10) / 10} vs. Vorwoche
        </div>
      </div>

      <ResponsiveContainer width="100%" height={100}>
        <BarChart data={bars} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <XAxis dataKey="week" tick={{ fontSize: 10 }} />
          <YAxis domain={[0, 100]} hide />
          <Tooltip formatter={(val: unknown) => [`${Number(val).toFixed(1)} Pkt`, 'Score']} />
          <Bar dataKey="score" radius={[3, 3, 0, 0]}>
            {bars.map((b, i) => (
              <Cell key={i} fill={GRADE_COLOR[b.grade] ?? '#94a3b8'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-2 bg-stone-50 rounded-lg px-3 py-2">
        <span className={cn(
          'text-sm font-bold px-2 py-0.5 rounded',
          grade === 'A+' || grade === 'A' ? 'bg-emerald-100 text-emerald-800' :
          grade === 'B' ? 'bg-blue-100 text-blue-800' :
          grade === 'C' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800',
        )}>
          Note {grade}
        </span>
        <span className="text-xs text-stone-600">{GRADE_MSG[grade] ?? ''}</span>
      </div>
    </div>
  );
}
