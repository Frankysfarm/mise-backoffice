'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, MessageSquare, Star, ThumbsUp, ThumbsDown } from 'lucide-react';

interface DriverSatisfaction {
  driverId: string;
  driverName: string | null;
  totalRatings: number;
  avgRating: number;
  positiveRate: number;
  negativeRate: number;
  withComment: number;
}

interface SatisfactionData {
  totalRatings: number;
  avgRating: number;
  positiveRate: number;
  negativeRate: number;
  withComment: number;
  byDay: { date: string; avgRating: number; count: number }[];
  byDriver: DriverSatisfaction[];
  recentComments: { rating: number; comment: string; createdAt: string }[];
  _fallback?: boolean;
  _hint?: string;
}

const DAYS_OPTIONS = [7, 14, 30] as const;

function StarBadge({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={cn('h-3 w-3', i <= full ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')}
        />
      ))}
    </div>
  );
}

function RatingPill({ rating }: { rating: number }) {
  if (rating >= 4) return <span className="inline-flex items-center gap-1 rounded-full bg-matcha-100 text-matcha-800 px-2 py-0.5 text-[11px] font-bold"><ThumbsUp className="h-2.5 w-2.5" />{rating}/5</span>;
  if (rating >= 3) return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[11px] font-bold">{rating}/5</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[11px] font-bold"><ThumbsDown className="h-2.5 w-2.5" />{rating}/5</span>;
}

export function SatisfactionClient({ locationId }: { locationId: string }) {
  const [days, setDays] = useState<7 | 14 | 30>(14);
  const [data, setData] = useState<SatisfactionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setData(null);
    fetch(`/api/delivery/admin/satisfaction?location_id=${locationId}&days=${days}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d !== null) setData(d as SatisfactionData); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId, days]);

  return (
    <div className="space-y-6">
      {/* Zeitraum */}
      <div className="flex items-center gap-2">
        {DAYS_OPTIONS.map(d => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-sm font-semibold transition',
              days === d
                ? 'bg-matcha-700 text-white border-matcha-700'
                : 'bg-card border-border text-muted-foreground hover:bg-muted',
            )}
          >
            {d} Tage
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">Lade Bewertungen…</div>
      )}

      {!loading && data?._fallback && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>{data._hint ?? 'Keine Bewertungsdaten verfügbar.'}</div>
        </div>
      )}

      {!loading && data && !data._fallback && (
        <>
          {/* KPI-Karten */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border bg-card px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Bewertungen</div>
              <div className="font-display text-2xl font-black">{data.totalRatings}</div>
            </div>
            <div className="rounded-xl border bg-card px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Ø Bewertung</div>
              <div className="font-display text-2xl font-black">{data.avgRating.toFixed(1)}</div>
              <StarBadge rating={data.avgRating} />
            </div>
            <div className={cn('rounded-xl border px-4 py-3', data.positiveRate >= 80 ? 'bg-matcha-50 border-matcha-200' : 'bg-amber-50 border-amber-200')}>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Positiv</div>
              <div className={cn('font-display text-2xl font-black', data.positiveRate >= 80 ? 'text-matcha-700' : 'text-amber-700')}>{data.positiveRate}%</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{data.negativeRate}% negativ</div>
            </div>
            <div className="rounded-xl border bg-card px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Mit Kommentar</div>
              <div className="font-display text-2xl font-black">{data.withComment}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {data.totalRatings > 0 ? `${Math.round(data.withComment / data.totalRatings * 100)}%` : '—'}
              </div>
            </div>
          </div>

          {/* Fahrer-Aufschlüsselung */}
          {data.byDriver.length > 0 && (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center gap-2">
                <Star className="h-4 w-4 text-matcha-700" />
                <span className="font-semibold text-sm">Bewertungen nach Fahrer</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border">
                      <th className="text-left px-4 py-2">Fahrer</th>
                      <th className="text-left px-4 py-2">Bewertungen</th>
                      <th className="text-left px-4 py-2">Ø Note</th>
                      <th className="text-left px-4 py-2">Positiv</th>
                      <th className="text-left px-4 py-2">Kommentare</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byDriver.map(d => (
                      <tr key={d.driverId} className="border-t border-border">
                        <td className="px-4 py-2.5 text-sm font-medium">{d.driverName ?? d.driverId.slice(0, 8)}</td>
                        <td className="px-4 py-2.5 text-sm tabular-nums">{d.totalRatings}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold">{d.avgRating.toFixed(1)}</span>
                            <StarBadge rating={d.avgRating} />
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-sm">
                          <span className={cn('font-bold', d.positiveRate >= 80 ? 'text-matcha-700' : d.positiveRate >= 60 ? 'text-amber-600' : 'text-red-600')}>
                            {d.positiveRate}%
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-sm tabular-nums text-muted-foreground">{d.withComment}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Neueste Kommentare */}
          {data.recentComments.length > 0 && (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-matcha-700" />
                <span className="font-semibold text-sm">Neueste Kommentare</span>
              </div>
              <div className="divide-y divide-border">
                {data.recentComments.slice(0, 10).map((c, i) => (
                  <div key={i} className="px-4 py-3 flex items-start gap-3">
                    <RatingPill rating={c.rating} />
                    <p className="text-sm text-muted-foreground flex-1 min-w-0">{c.comment}</p>
                    <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                      {new Date(c.createdAt).toLocaleDateString('de-DE')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.totalRatings === 0 && (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              Noch keine Bewertungen für diesen Zeitraum.
            </div>
          )}
        </>
      )}
    </div>
  );
}
