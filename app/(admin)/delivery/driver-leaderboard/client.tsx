'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Trophy, Star, Clock, Bike } from 'lucide-react';

interface LeaderboardEntry {
  rank: number;
  driverId: string;
  driverName: string | null;
  initials: string;
  toursCompleted: number;
  stopsCompleted: number;
  totalDistanceKm: number;
  activeMinutes: number;
  avgDeliveryMin: number | null;
  onTimeRate: number | null;
  avgRating: number | null;
  totalRatings: number;
  earningsEur: number;
  lastActiveDate: string;
  activeDays: number;
}

interface LeaderboardData {
  period: string;
  total: number;
  entries: LeaderboardEntry[];
}

type Period = 'today' | 'week' | 'month';

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Heute',
  week: 'Diese Woche',
  month: 'Dieser Monat',
};

function rankColor(rank: number) {
  if (rank === 1) return 'bg-amber-100 text-amber-700 border-amber-300';
  if (rank === 2) return 'bg-slate-100 text-slate-600 border-slate-300';
  if (rank === 3) return 'bg-orange-50 text-orange-600 border-orange-200';
  return 'bg-muted text-muted-foreground border-border';
}

function onTimeColor(rate: number | null) {
  if (rate === null) return 'text-muted-foreground';
  if (rate >= 0.9) return 'text-matcha-700';
  if (rate >= 0.75) return 'text-amber-600';
  return 'text-red-600';
}

export function DriverLeaderboardClient({ locationId }: { locationId: string }) {
  const [period, setPeriod] = useState<Period>('week');
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setData(null);
    fetch(`/api/delivery/admin/driver-leaderboard?location_id=${locationId}&period=${period}&limit=20`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.entries) setData(d as LeaderboardData); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId, period]);

  return (
    <div className="space-y-6">
      {/* Zeitraum */}
      <div className="flex items-center gap-2">
        {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-sm font-semibold transition',
              period === p
                ? 'bg-matcha-700 text-white border-matcha-700'
                : 'bg-card border-border text-muted-foreground hover:bg-muted',
            )}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
        {data && (
          <span className="ml-auto text-[11px] text-muted-foreground">
            {data.total} Fahrer
          </span>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">Lade Rangliste…</div>
      )}

      {!loading && (!data || data.entries.length === 0) && (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
          Keine Fahrer-Daten für diesen Zeitraum.
        </div>
      )}

      {!loading && data && data.entries.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <Trophy className="h-4 w-4 text-matcha-700" />
            <span className="font-semibold text-sm">Rangliste · {PERIOD_LABELS[period]}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border">
                  <th className="text-left px-4 py-2">#</th>
                  <th className="text-left px-4 py-2">Fahrer</th>
                  <th className="text-left px-4 py-2">Touren</th>
                  <th className="text-left px-4 py-2">Stopps</th>
                  <th className="text-left px-4 py-2">On-Time</th>
                  <th className="text-left px-4 py-2">Ø Lieferzeit</th>
                  <th className="text-left px-4 py-2">Bewertung</th>
                  <th className="text-left px-4 py-2">Km</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map(entry => (
                  <tr key={entry.driverId} className="border-t border-border hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-black border', rankColor(entry.rank))}>
                        {entry.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-matcha-100 text-matcha-800 flex items-center justify-center text-xs font-bold shrink-0">
                          {entry.initials}
                        </div>
                        <div>
                          <div className="text-sm font-medium">{entry.driverName ?? entry.driverId.slice(0, 8)}</div>
                          <div className="text-[11px] text-muted-foreground">{entry.activeDays} aktive Tage</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums font-medium">{entry.toursCompleted}</td>
                    <td className="px-4 py-3 text-sm tabular-nums">{entry.stopsCompleted}</td>
                    <td className="px-4 py-3">
                      {entry.onTimeRate !== null ? (
                        <span className={cn('text-sm font-bold', onTimeColor(entry.onTimeRate))}>
                          {Math.round(entry.onTimeRate * 100)}%
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 shrink-0" />
                        {entry.avgDeliveryMin !== null ? `${Math.round(entry.avgDeliveryMin)} Min` : '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {entry.avgRating !== null ? (
                        <div className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                          <span className="text-sm font-medium">{entry.avgRating.toFixed(1)}</span>
                          <span className="text-[11px] text-muted-foreground">({entry.totalRatings})</span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-sm tabular-nums text-muted-foreground">
                        <Bike className="h-3 w-3 shrink-0" />
                        {entry.totalDistanceKm.toFixed(1)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
