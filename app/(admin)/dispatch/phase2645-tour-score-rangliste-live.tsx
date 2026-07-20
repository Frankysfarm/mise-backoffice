'use client';

/**
 * Phase 2645 — Tour-Score Rangliste Live
 *
 * Dispatch-Cockpit für Echtzeit-Fahrer-Rangliste:
 * - Score-Ring (0–100) je Fahrer mit Farbkodierung grün/gelb/rot
 * - Rank-Platzierung mit Trend-Pfeil (↑↓=)
 * - Aktuelle Tour-Statistiken: Stopps, ETA, Liefertreue
 * - Team-Ø Score + Alert bei <65
 * - Top-Performer-Badge & Coaching-Tipp für Schlechtesten
 * - 25-Sek-Polling
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Trophy, TrendingUp, TrendingDown, Minus, MapPin, AlertTriangle, Loader2, Star } from 'lucide-react';

interface TourStop {
  status: 'delivered' | 'pending' | 'delayed';
  etaMin?: number | null;
}

interface DriverRank {
  rank: number;
  rankTrend: 'up' | 'down' | 'same';
  driverId: string;
  name: string;
  score: number;
  scoreTrend: number;
  stopsCompleted: number;
  stopsTotal: number;
  dots: TourStop[];
  etaNextMin: number | null;
  onTimePct: number;
  isActive: boolean;
}

interface TeamSummary {
  avgScore: number;
  topDriverId: string | null;
  bottomDriverId: string | null;
  activeCount: number;
}

interface ApiResponse {
  drivers: DriverRank[];
  summary: TeamSummary;
}

const MOCK: ApiResponse = {
  summary: { avgScore: 76, topDriverId: 'd1', bottomDriverId: 'd3', activeCount: 4 },
  drivers: [
    { rank: 1, rankTrend: 'up',   driverId: 'd1', name: 'Max M.',    score: 94, scoreTrend: +3,  stopsCompleted: 6, stopsTotal: 8, dots: [{ status: 'delivered' }, { status: 'delivered' }, { status: 'delivered' }, { status: 'delivered' }, { status: 'delivered' }, { status: 'delivered' }, { status: 'pending', etaMin: 5 }, { status: 'pending', etaMin: 20 }], etaNextMin: 5,  onTimePct: 97, isActive: true },
    { rank: 2, rankTrend: 'same', driverId: 'd2', name: 'Anna S.',   score: 82, scoreTrend: 0,   stopsCompleted: 4, stopsTotal: 7, dots: [{ status: 'delivered' }, { status: 'delivered' }, { status: 'delivered' }, { status: 'delivered' }, { status: 'pending', etaMin: 8 }, { status: 'pending' }, { status: 'pending' }], etaNextMin: 8,  onTimePct: 88, isActive: true },
    { rank: 3, rankTrend: 'down', driverId: 'd4', name: 'Tom R.',    score: 71, scoreTrend: -5,  stopsCompleted: 3, stopsTotal: 6, dots: [{ status: 'delivered' }, { status: 'delivered' }, { status: 'delivered' }, { status: 'pending', etaMin: 3 }, { status: 'pending' }, { status: 'pending' }], etaNextMin: 3,  onTimePct: 79, isActive: true },
    { rank: 4, rankTrend: 'down', driverId: 'd3', name: 'Lisa K.',   score: 55, scoreTrend: -8,  stopsCompleted: 2, stopsTotal: 5, dots: [{ status: 'delivered' }, { status: 'delayed', etaMin: 1 }, { status: 'pending' }, { status: 'pending' }, { status: 'pending' }], etaNextMin: 1,  onTimePct: 61, isActive: true },
  ],
};

function scoreColor(s: number): { ring: string; text: string; bg: string } {
  if (s >= 80) return { ring: '#22c55e', text: 'text-matcha-600', bg: 'bg-matcha-50' };
  if (s >= 65) return { ring: '#f59e0b', text: 'text-amber-600',  bg: 'bg-amber-50'  };
  return { ring: '#ef4444', text: 'text-red-600', bg: 'bg-red-50' };
}

function dotCls(s: TourStop['status']): string {
  switch (s) {
    case 'delivered': return 'bg-matcha-500';
    case 'delayed':   return 'bg-red-500 ring-1 ring-red-300';
    default:          return 'bg-muted-foreground/30';
  }
}

function ScoreRing({ score, size = 44 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const { ring } = scoreColor(score);
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={6} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={ring} strokeWidth={6}
        strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round" />
    </svg>
  );
}

export function DispatchPhase2645TourScoreRanglisteLive({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/dispatch/score-rangliste?locationId=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch { /* use mock */ } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    pollRef.current = setInterval(fetchData, 25_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [locationId]);

  const s = data.summary;
  const topDriver = data.drivers.find(d => d.driverId === s.topDriverId);
  const bottomDriver = data.drivers.find(d => d.driverId === s.bottomDriverId);
  const alertLow = s.avgScore < 65;

  const TrendIcon = ({ trend }: { trend: DriverRank['rankTrend'] }) => {
    if (trend === 'up')   return <TrendingUp className="h-3 w-3 text-matcha-500" />;
    if (trend === 'down') return <TrendingDown className="h-3 w-3 text-red-500" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/30 transition"
      >
        <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="font-display text-sm font-black uppercase tracking-wider">
          Tour-Score Rangliste Live
        </span>
        <span className="text-[10px] text-muted-foreground ml-1">Phase 2645</span>
        {alertLow && (
          <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-black text-white animate-pulse">
            <AlertTriangle className="h-2.5 w-2.5" /> Team-Ø {s.avgScore}
          </span>
        )}
        {loading && <Loader2 className="h-3 w-3 animate-spin ml-1 text-muted-foreground" />}
        <span className="ml-auto text-muted-foreground text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t">
          {/* Team summary */}
          <div className="flex items-center gap-4 px-4 py-2 bg-muted/20 text-sm flex-wrap">
            <div className="flex items-center gap-1.5">
              <Star className={cn('h-3.5 w-3.5', scoreColor(s.avgScore).text)} />
              <span className={cn('font-black text-base', scoreColor(s.avgScore).text)}>{s.avgScore}</span>
              <span className="text-[10px] text-muted-foreground">Team-Ø</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground">Aktiv:</span>
              <span className="font-bold text-sm">{s.activeCount}</span>
            </div>
            {topDriver && (
              <div className="flex items-center gap-1 ml-auto">
                <Trophy className="h-3 w-3 text-amber-500" />
                <span className="text-[10px] font-bold">{topDriver.name}</span>
                <span className="text-[10px] text-matcha-600 font-black">{topDriver.score}</span>
              </div>
            )}
            {bottomDriver && s.avgScore < 75 && (
              <div className="text-[10px] text-red-600">
                💬 Coaching: <span className="font-bold">{bottomDriver.name}</span>
              </div>
            )}
          </div>

          {/* Driver list */}
          <div className="divide-y">
            {data.drivers.map((d) => {
              const sc = scoreColor(d.score);
              return (
                <div key={d.driverId} className={cn('flex items-center gap-3 px-4 py-3', !d.isActive && 'opacity-50')}>
                  {/* Rank */}
                  <div className="flex flex-col items-center shrink-0 w-8">
                    <span className="font-black text-base leading-none">{d.rank}</span>
                    <TrendIcon trend={d.rankTrend} />
                  </div>

                  {/* Score ring */}
                  <div className="relative shrink-0">
                    <ScoreRing score={d.score} />
                    <span className={cn('absolute inset-0 flex items-center justify-center font-black text-[11px]', sc.text)}>
                      {d.score}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm truncate">{d.name}</span>
                      {d.scoreTrend !== 0 && (
                        <span className={cn('text-[10px] font-bold', d.scoreTrend > 0 ? 'text-matcha-600' : 'text-red-600')}>
                          {d.scoreTrend > 0 ? '+' : ''}{d.scoreTrend}
                        </span>
                      )}
                    </div>

                    {/* Stop dots */}
                    <div className="flex gap-0.5 mt-1 flex-wrap">
                      {d.dots.map((dot, i) => (
                        <span key={i} className={cn('h-2 w-2 rounded-full shrink-0', dotCls(dot.status))} />
                      ))}
                    </div>

                    {/* On-time bar */}
                    <div className="mt-1 flex items-center gap-1.5">
                      <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn('h-full rounded-full', d.onTimePct >= 85 ? 'bg-matcha-500' : d.onTimePct >= 65 ? 'bg-amber-400' : 'bg-red-500')}
                          style={{ width: `${d.onTimePct}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-muted-foreground tabular-nums">{d.onTimePct}%</span>
                    </div>
                  </div>

                  {/* Next ETA */}
                  <div className="flex flex-col items-end shrink-0">
                    <span className="font-mono text-sm font-black">
                      {d.stopsCompleted}/{d.stopsTotal}
                    </span>
                    {d.etaNextMin !== null && (
                      <div className="flex items-center gap-0.5 mt-0.5">
                        <MapPin className="h-2.5 w-2.5 text-muted-foreground" />
                        <span className="font-mono text-[10px] text-muted-foreground tabular-nums">{d.etaNextMin} Min</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
