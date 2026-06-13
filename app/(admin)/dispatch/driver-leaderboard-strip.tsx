'use client';

/**
 * DriverLeaderboardStrip — Kompaktes Fahrer-Ranking für den Dispatch-Board-Header.
 * Zeigt die Top-Fahrer heute nach Lieferungen, Pünktlichkeit und Durchschnittszeit.
 * Daten: /api/delivery/admin/driver-leaderboard?period=today
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Trophy, Clock, TrendingUp, Bike } from 'lucide-react';

type LeaderboardEntry = {
  employeeId: string;
  name: string;
  deliveries: number;
  onTimePct: number | null;
  avgDeliveryMin: number | null;
  totalDistanceKm: number | null;
  isOnline: boolean;
};

const MEDAL = ['🥇', '🥈', '🥉'];

export function DriverLeaderboardStrip({ locationId }: { locationId: string | null }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/delivery/admin/driver-leaderboard?location_id=${locationId}&period=today&limit=5`,
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.entries)) {
          setEntries(data.entries.slice(0, 5));
          setLastFetched(new Date());
        }
      } catch {
        // Ignore fetch errors — leaderboard is non-critical
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const iv = setInterval(load, 3 * 60_000); // refresh every 3 min
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (loading && entries.length === 0) return null;
  if (entries.length === 0) return null;

  const top = entries.filter((e) => e.deliveries > 0);
  if (top.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 px-4 py-3 space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Trophy className="h-3.5 w-3.5 text-amber-600 shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">
          Fahrer-Rangliste heute
        </span>
        {lastFetched && (
          <span className="ml-auto text-[9px] text-amber-500 tabular-nums">
            {lastFetched.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
          </span>
        )}
      </div>

      {/* Driver chips */}
      <div className="flex flex-wrap gap-2">
        {top.map((entry, idx) => {
          const onTimeCls =
            entry.onTimePct == null ? 'text-stone-400'
            : entry.onTimePct >= 90 ? 'text-matcha-600'
            : entry.onTimePct >= 75 ? 'text-amber-600'
            : 'text-red-600';
          const avgTimeCls =
            entry.avgDeliveryMin == null ? 'text-stone-400'
            : entry.avgDeliveryMin <= 25 ? 'text-matcha-600'
            : entry.avgDeliveryMin <= 35 ? 'text-amber-600'
            : 'text-red-600';

          return (
            <div
              key={entry.employeeId}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs',
                idx === 0
                  ? 'border-amber-400/60 bg-amber-100/80'
                  : 'border-stone-200 bg-white/80',
              )}
            >
              {/* Rank medal / number */}
              <span className="text-sm shrink-0">
                {idx < 3 ? MEDAL[idx] : `#${idx + 1}`}
              </span>

              {/* Name + online dot */}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={cn('font-bold text-[11px] truncate', idx === 0 ? 'text-amber-800' : 'text-stone-700')}>
                    {entry.name}
                  </span>
                  {entry.isOnline && (
                    <span className="h-1.5 w-1.5 rounded-full bg-matcha-500 shrink-0 animate-pulse" title="Online" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="flex items-center gap-0.5 text-[9px] font-bold text-stone-500">
                    <Bike className="h-2.5 w-2.5" />
                    {entry.deliveries}
                  </span>
                  {entry.onTimePct != null && (
                    <span className={cn('flex items-center gap-0.5 text-[9px] font-bold', onTimeCls)}>
                      <TrendingUp className="h-2.5 w-2.5" />
                      {Math.round(entry.onTimePct)}%
                    </span>
                  )}
                  {entry.avgDeliveryMin != null && (
                    <span className={cn('flex items-center gap-0.5 text-[9px] font-bold', avgTimeCls)}>
                      <Clock className="h-2.5 w-2.5" />
                      {Math.round(entry.avgDeliveryMin)}m
                    </span>
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
