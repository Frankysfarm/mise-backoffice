'use client';

/**
 * FahrerScoreVerlaufChart — Phase 359
 * Personal score history AreaChart (8 weeks)
 * Collapsible, dark matcha gradient header
 */

import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';

type ScoreGrade = 'A+' | 'A' | 'B' | 'C' | 'D';

interface HistoryRow {
  driverId: string;
  periodStart: string;
  compositeScore: number;
  grade: ScoreGrade;
}

interface ChartPoint {
  week: string;
  score: number;
  grade: ScoreGrade;
}

const GRADE_COLORS: Record<ScoreGrade, string> = {
  'A+': 'bg-emerald-100 text-emerald-800',
  'A':  'bg-green-100 text-green-800',
  'B':  'bg-blue-100 text-blue-800',
  'C':  'bg-amber-100 text-amber-800',
  'D':  'bg-red-100 text-red-800',
};

export function FahrerScoreVerlaufChart() {
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch('/api/delivery/admin/driver-score?action=history&weeks=8');
        if (!res.ok) { setLoaded(true); return; }
        const d = await res.json();
        const rows: HistoryRow[] = d.rows ?? [];
        if (rows.length === 0) { setLoaded(true); return; }

        // Take the first driver's own data if possible, else show all averaged
        const byWeek = new Map<string, { scores: number[]; grades: ScoreGrade[] }>();
        for (const r of rows) {
          const entry = byWeek.get(r.periodStart) ?? { scores: [], grades: [] };
          entry.scores.push(r.compositeScore);
          entry.grades.push(r.grade);
          byWeek.set(r.periodStart, entry);
        }
        const pts: ChartPoint[] = [...byWeek.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([week, { scores, grades }]) => ({
            week: week.slice(5),
            score: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length * 10) / 10,
            grade: grades[0],
          }));

        if (!cancelled) { setPoints(pts); setLoaded(true); }
      } catch { setLoaded(true); }
    };

    load();
  }, []);

  if (!loaded || points.length === 0) return null;

  const latest = points[points.length - 1];
  const first = points[0];
  const delta = latest ? latest.score - (first?.score ?? latest.score) : 0;

  return (
    <div className="mt-3 overflow-hidden rounded-xl border">
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="flex w-full items-center justify-between bg-gradient-to-r from-matcha-800 to-matcha-600 px-4 py-3 text-white"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          <span className="text-sm font-semibold">Mein Score-Verlauf (8 Wochen)</span>
        </div>
        <div className="flex items-center gap-3">
          {latest && (
            <span className="text-sm font-bold">{latest.score} Pkt</span>
          )}
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {open && (
        <div className="bg-card p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-2xl font-bold font-display">{latest?.score ?? 0}</div>
              <div className="text-[10px] text-muted-foreground">Aktuell</div>
            </div>
            <div className="text-center">
              <div className={`text-sm font-bold ${delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {delta >= 0 ? '+' : ''}{delta.toFixed(1)}
              </div>
              <div className="text-[10px] text-muted-foreground">vs. Start</div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={points} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4ade80" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="week" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(value) => [typeof value === 'number' ? `${value} Pkt` : String(value ?? ''), 'Score']} />
              <Area
                type="monotone"
                dataKey="score"
                stroke="#22c55e"
                strokeWidth={2}
                fill="url(#scoreGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>

          <div className="flex flex-wrap gap-1.5">
            {points.map((p: ChartPoint) => (
              <span
                key={p.week}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${GRADE_COLORS[p.grade]}`}
              >
                {p.week}: {p.grade}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default FahrerScoreVerlaufChart;
