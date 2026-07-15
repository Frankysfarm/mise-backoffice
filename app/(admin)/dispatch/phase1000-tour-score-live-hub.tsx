'use client';

import { useEffect, useState } from 'react';
import { Trophy, TrendingUp, Clock, MapPin, Bike, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tour = {
  id: string;
  driverName: string;
  score: number;
  completedStops: number;
  totalStops: number;
  elapsedMin: number;
  etaMin: number | null;
  zone: string | null;
  health: 'on-time' | 'tight' | 'late' | 'unknown';
};

type Props = {
  tours: Tour[];
};

function ScoreRing({ score }: { score: number }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(100, score) / 100);
  const color =
    score >= 80 ? '#16a34a' : score >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <svg width="52" height="52" viewBox="0 0 52 52">
      <circle cx="26" cy="26" r={r} fill="none" stroke="#e5e7eb" strokeWidth="5" />
      <circle
        cx="26" cy="26" r={r} fill="none"
        stroke={color} strokeWidth="5"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 26 26)"
        style={{ transition: 'stroke-dashoffset 0.7s ease' }}
      />
      <text x="26" y="30" textAnchor="middle" fontSize="12" fontWeight="800" fill={color}>
        {Math.round(score)}
      </text>
    </svg>
  );
}

const healthStyle = {
  'on-time': { label: 'Pünktlich',  badge: 'bg-matcha-500 text-white' },
  tight:     { label: 'Knapp',      badge: 'bg-amber-400 text-white' },
  late:      { label: 'Verspätet', badge: 'bg-red-500 text-white animate-pulse' },
  unknown:   { label: 'Unbekannt', badge: 'bg-muted text-muted-foreground' },
};

export function DispatchPhase1000TourScoreLiveHub({ tours }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, []);

  if (!tours || tours.length === 0) return null;

  const sorted = [...tours].sort((a, b) => {
    const urgency = { late: 0, tight: 1, 'on-time': 2, unknown: 3 };
    return urgency[a.health] - urgency[b.health];
  });

  const avgScore = Math.round(tours.reduce((s, t) => s + t.score, 0) / tours.length);
  const lateCount = tours.filter((t) => t.health === 'late').length;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-100">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <Trophy className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold">Tour Score Live Hub</div>
          <div className="text-[11px] text-muted-foreground">
            {tours.length} aktive Tour{tours.length !== 1 ? 'en' : ''} · Ø Score {avgScore}
          </div>
        </div>
        {lateCount > 0 && (
          <span className="rounded-full bg-red-500 px-2.5 py-0.5 text-[9px] font-black text-white animate-pulse">
            {lateCount} verspätet
          </span>
        )}
        {lateCount === 0 && (
          <span className="rounded-full bg-matcha-100 px-2.5 py-0.5 text-[9px] font-bold text-matcha-800">
            Alle im Plan
          </span>
        )}
      </div>

      {/* Tour rows */}
      <div className="divide-y divide-stone-100">
        {sorted.map((tour) => {
          const hs = healthStyle[tour.health];
          const progressPct = tour.totalStops > 0 ? (tour.completedStops / tour.totalStops) * 100 : 0;

          return (
            <div key={tour.id} className="flex items-center gap-3 px-4 py-3">
              {/* Score ring */}
              <div className="shrink-0">
                <ScoreRing score={tour.score} />
              </div>

              {/* Main info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <div className="flex items-center gap-1 text-xs font-bold">
                    <Bike className="h-3 w-3 text-muted-foreground" />
                    {tour.driverName}
                  </div>
                  {tour.zone && (
                    <span className="text-[9px] rounded-full border bg-muted/30 px-1.5 py-0.5 font-semibold text-muted-foreground">
                      Zone {tour.zone}
                    </span>
                  )}
                  <span className={cn('text-[9px] rounded-full px-2 py-0.5 font-black', hs.badge)}>
                    {hs.label}
                  </span>
                </div>

                {/* Stop progress */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-stone-100 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-700',
                        tour.health === 'late' ? 'bg-red-500' :
                        tour.health === 'tight' ? 'bg-amber-400' : 'bg-matcha-500',
                      )}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-[10px] font-bold tabular-nums text-muted-foreground">
                    {tour.completedStops}/{tour.totalStops}
                  </span>
                </div>

                <div className="flex items-center gap-3 mt-1">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="h-2.5 w-2.5" />
                    {tour.elapsedMin}m aktiv
                  </div>
                  {tour.etaMin !== null && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Target className="h-2.5 w-2.5" />
                      ~{tour.etaMin}m ETA
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
