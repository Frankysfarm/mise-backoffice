'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Star, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';

/**
 * Phase 897 — Schicht-Score-Cockpit
 *
 * Gesamtscore 0–100 aus Pünktlichkeit + Stopps/h + Bewertung mit Tages-Trend.
 * SVG-Ring-Visualisierung + 3 Sub-Scores + Trend-Indikator.
 */

interface ScoreData {
  gesamt_score: number;
  pünktlichkeit_score: number;
  effizienz_score: number;
  bewertungs_score: number;
  stopps_heute: number;
  stopps_pro_h: number;
  avg_bewertung: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  vorwoche_avg: number | null;
}

interface Props {
  driverId: string;
  isOnline: boolean;
}

const MOCK: ScoreData = {
  gesamt_score: 78,
  pünktlichkeit_score: 82,
  effizienz_score: 71,
  bewertungs_score: 84,
  stopps_heute: 12,
  stopps_pro_h: 3.2,
  avg_bewertung: 4.3,
  trend: 'steigend',
  vorwoche_avg: 73,
};

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={6} className="text-muted/30" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={`${circ}`}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-700"
      />
      <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle"
        fontSize="16" fontWeight="bold" fill={color}>
        {score}
      </text>
    </svg>
  );
}

export function FahrerPhase897SchichtScoreCockpit({ driverId, isOnline }: Props) {
  const [data, setData] = useState<ScoreData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!driverId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/driver/schicht-score?driver_id=${driverId}`);
        if (!cancelled) setData(res.ok ? await res.json() : MOCK);
      } catch {
        if (!cancelled) setData(MOCK);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const id = setInterval(load, 5 * 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [driverId]);

  if (!isOnline) return null;

  const d = data ?? MOCK;
  const TrendIcon = d.trend === 'steigend' ? TrendingUp : d.trend === 'fallend' ? TrendingDown : Minus;
  const trendColor = d.trend === 'steigend' ? 'text-matcha-500' : d.trend === 'fallend' ? 'text-red-500' : 'text-muted-foreground';

  const subScores = [
    { label: 'Pünktlichkeit', score: d.pünktlichkeit_score, icon: '⏱' },
    { label: 'Effizienz', score: d.effizienz_score, icon: '⚡' },
    { label: 'Bewertung', score: d.bewertungs_score, icon: '⭐' },
  ];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
        <Star className="h-4 w-4 text-amber-400 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Schicht-Score
        </span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
        <div className={cn('ml-auto flex items-center gap-1', trendColor)}>
          <TrendIcon className="h-3.5 w-3.5" />
          <span className="text-[10px] font-bold">
            {d.trend === 'steigend' ? '+' : d.trend === 'fallend' ? '-' : ''}
            {d.vorwoche_avg !== null
              ? `${Math.abs(d.gesamt_score - d.vorwoche_avg)} vs. Vorwoche`
              : d.trend}
          </span>
        </div>
      </div>

      <div className="px-4 py-4">
        {/* Main score ring + stats */}
        <div className="flex items-center gap-4">
          <ScoreRing score={d.gesamt_score} size={84} />
          <div className="flex-1 space-y-1.5">
            <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Heute</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <div>
                <span className="text-[10px] text-muted-foreground">Stopps</span>
                <p className="text-sm font-black tabular-nums text-foreground">{d.stopps_heute}</p>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground">Ø Stopps/h</span>
                <p className="text-sm font-black tabular-nums text-foreground">{d.stopps_pro_h.toFixed(1)}</p>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground">Ø Bewertung</span>
                <p className="text-sm font-black tabular-nums text-amber-500">★ {d.avg_bewertung.toFixed(1)}</p>
              </div>
              {d.vorwoche_avg !== null && (
                <div>
                  <span className="text-[10px] text-muted-foreground">Vorwoche Ø</span>
                  <p className="text-sm font-black tabular-nums text-muted-foreground">{d.vorwoche_avg}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sub-scores */}
        <div className="mt-4 space-y-2">
          {subScores.map(({ label, score, icon }) => {
            const barColor = score >= 80 ? 'bg-matcha-500' : score >= 60 ? 'bg-amber-400' : 'bg-red-400';
            return (
              <div key={label} className="flex items-center gap-2">
                <span className="w-4 text-center text-sm shrink-0">{icon}</span>
                <span className="w-24 shrink-0 text-[11px] text-muted-foreground">{label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', barColor)}
                    style={{ width: `${score}%` }}
                  />
                </div>
                <span className="w-7 text-right text-[11px] font-bold tabular-nums text-foreground">{score}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
