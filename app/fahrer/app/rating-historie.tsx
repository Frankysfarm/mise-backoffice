'use client';

/**
 * FahrerRatingHistorie — Persönliche Kundenbewertungen
 *
 * Zeigt dem Fahrer seine letzten Kundenbewertungen:
 * Durchschnittssterne, Trend, letzte Kommentare.
 * Pollt /api/delivery/reviews (mit driver-Filter) alle 5 Min.
 *
 * Zeigt nur wenn mindestens 1 Bewertung vorliegt.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Star, TrendingUp, TrendingDown, Minus, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';

type Rating = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  bestellnummer?: string;
};

type Stats = {
  avg: number;
  count: number;
  fiveStar: number;
  oneStar: number;
  trend: 'up' | 'down' | 'stable';
  recent: Rating[];
};

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={cn('h-3.5 w-3.5', i <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')}
        />
      ))}
    </div>
  );
}

function BigStarDisplay({ avg }: { avg: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => {
        const fill = Math.min(1, Math.max(0, avg - (i - 1)));
        return (
          <div key={i} className="relative h-5 w-5">
            <Star className="absolute inset-0 h-5 w-5 text-muted-foreground/20" />
            <div className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function fmtAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60)      return 'gerade eben';
  if (secs < 3600)    return `vor ${Math.floor(secs / 60)} Min`;
  if (secs < 86400)   return `vor ${Math.floor(secs / 3600)} Std`;
  return `vor ${Math.floor(secs / 86400)} Tagen`;
}

export function FahrerRatingHistorie({ driverId }: { driverId: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [open, setOpen]   = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch(`/api/delivery/driver/my-ratings?driver_id=${driverId}&limit=20`);
        if (!r.ok) return;
        const data: { ratings: Rating[] } = await r.json();
        if (!data.ratings?.length) return;

        const ratings = data.ratings;
        const avg = ratings.reduce((s, r) => s + r.rating, 0) / ratings.length;
        const fiveStar = ratings.filter(r => r.rating === 5).length;
        const oneStar  = ratings.filter(r => r.rating <= 2).length;

        const half = Math.floor(ratings.length / 2);
        const recentHalf = ratings.slice(0, half);
        const olderHalf  = ratings.slice(half);
        const recentAvg  = recentHalf.reduce((s, r) => s + r.rating, 0) / (recentHalf.length || 1);
        const olderAvg   = olderHalf.reduce((s, r) => s + r.rating, 0) / (olderHalf.length || 1);
        const trend: 'up' | 'down' | 'stable' =
          recentAvg - olderAvg > 0.2 ? 'up' :
          recentAvg - olderAvg < -0.2 ? 'down' : 'stable';

        setStats({
          avg,
          count: ratings.length,
          fiveStar,
          oneStar,
          trend,
          recent: ratings.slice(0, 5),
        });
      } catch {}
    }
    load();
    const iv = setInterval(load, 300_000);
    return () => clearInterval(iv);
  }, [driverId]);

  if (!stats) return null;

  const TrendIcon = stats.trend === 'up' ? TrendingUp : stats.trend === 'down' ? TrendingDown : Minus;
  const trendColor = stats.trend === 'up' ? 'text-matcha-600' : stats.trend === 'down' ? 'text-red-500' : 'text-muted-foreground';

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        {/* Sterne */}
        <div className="flex flex-col">
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black tabular-nums">{stats.avg.toFixed(1)}</span>
            <TrendIcon className={cn('h-4 w-4', trendColor)} />
          </div>
          <BigStarDisplay avg={stats.avg} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold">Meine Bewertungen</div>
          <div className="text-xs text-muted-foreground">
            {stats.count} Bewertungen · ⭐⭐⭐⭐⭐ {stats.fiveStar}×
            {stats.oneStar > 0 && <span className="text-red-500"> · ⚠ {stats.oneStar}×</span>}
          </div>
        </div>

        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="border-t px-4 py-3 space-y-3">
          {/* Letzte Bewertungen */}
          <div className="space-y-2">
            {stats.recent.map((r) => (
              <div key={r.id} className="rounded-xl bg-muted/40 p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <StarRow rating={r.rating} />
                  <span className="text-[10px] text-muted-foreground">{fmtAgo(r.created_at)}</span>
                </div>
                {r.comment && (
                  <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
                    <span className="italic">"{r.comment}"</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Trend-Hinweis */}
          <div className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium',
            stats.trend === 'up'   ? 'bg-matcha-50 text-matcha-700' :
            stats.trend === 'down' ? 'bg-red-50 text-red-700' :
                                     'bg-muted text-muted-foreground',
          )}>
            <TrendIcon className="h-4 w-4 shrink-0" />
            {stats.trend === 'up'
              ? 'Super Trend! Deine letzten Bewertungen sind besser als vorher.'
              : stats.trend === 'down'
              ? 'Achtung: Deine letzten Bewertungen liegen unter dem Durchschnitt.'
              : 'Bewertungstrend ist stabil.'}
          </div>
        </div>
      )}
    </div>
  );
}
