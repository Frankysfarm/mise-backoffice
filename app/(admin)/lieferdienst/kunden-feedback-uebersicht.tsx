'use client';

/**
 * KundenFeedbackUebersicht — Phase 201
 * Kompakte Kundenzufriedenheits-KPIs + letzte 3 Kommentare.
 * Nutzt GET /api/delivery/admin/satisfaction?location_id=...&days=14
 * Für den Lieferdienst-Stats-View als Schnellübersicht.
 */

import { useEffect, useState } from 'react';
import { Star, ThumbsUp, ThumbsDown, MessageSquare, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DriverStat {
  driverId: string;
  driverName: string | null;
  totalRatings: number;
  avgRating: number;
  positiveRate: number;
}

interface Comment {
  rating: number;
  comment: string;
  createdAt: string;
}

interface SatData {
  totalRatings: number;
  avgRating: number;
  positiveRate: number;
  negativeRate: number;
  withComment: number;
  byDriver: DriverStat[];
  recentComments: Comment[];
  _fallback?: boolean;
}

interface Props {
  locationId: string;
}

function StarRow({ avg, count }: { avg: number; count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star
          key={s}
          className={cn(
            'h-3 w-3',
            s <= Math.round(avg) ? 'fill-amber-400 text-amber-400' : 'text-stone-200',
          )}
        />
      ))}
      <span className="text-xs font-bold text-stone-700 ml-0.5">{avg.toFixed(1)}</span>
      <span className="text-[10px] text-stone-400">({count})</span>
    </div>
  );
}

function RatingBadge({ rating }: { rating: number }) {
  if (rating >= 4) return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-matcha-100 text-matcha-800 px-1.5 py-0.5 text-[10px] font-bold">
      <ThumbsUp className="h-2.5 w-2.5" />{rating}★
    </span>
  );
  if (rating === 3) return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[10px] font-bold">
      {rating}★
    </span>
  );
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 text-red-700 px-1.5 py-0.5 text-[10px] font-bold">
      <ThumbsDown className="h-2.5 w-2.5" />{rating}★
    </span>
  );
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 3600) return `vor ${Math.round(secs / 60)} Min`;
  if (secs < 86400) return `vor ${Math.round(secs / 3600)} Std`;
  return `vor ${Math.round(secs / 86400)} Tagen`;
}

export function KundenFeedbackUebersicht({ locationId }: Props) {
  const [data, setData] = useState<SatData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  useEffect(() => {
    if (!locationId) return;
    let mounted = true;
    setLoading(true);

    fetch(`/api/delivery/admin/satisfaction?location_id=${locationId}&days=14`)
      .then(r => r.ok ? r.json() : null)
      .then((d: SatData | null) => { if (mounted && d) setData(d); })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false); });

    return () => { mounted = false; };
  }, [locationId, lastRefresh]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-100 bg-white p-4 animate-pulse">
        <div className="h-4 w-44 bg-stone-100 rounded mb-4" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-stone-50 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!data || (data.totalRatings === 0 && !data._fallback)) return null;

  const topDriver = data.byDriver.sort((a, b) => b.avgRating - a.avgRating)[0];
  const comments = data.recentComments.filter(c => c.comment?.trim()).slice(0, 3);

  return (
    <div className="rounded-2xl border border-stone-100 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-50">
            <Star className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <div>
            <div className="text-sm font-bold text-stone-800">Kundenfeedback</div>
            <div className="text-[10px] text-stone-400">letzte 14 Tage</div>
          </div>
        </div>
        <button
          onClick={() => setLastRefresh(Date.now())}
          className="text-stone-400 hover:text-stone-600 transition"
          aria-label="Aktualisieren"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {data._fallback && data.totalRatings === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-stone-400">
          Noch keine Kundenbewertungen vorhanden.
        </div>
      ) : (
        <>
          {/* KPI Grid */}
          <div className="grid grid-cols-3 gap-3 p-4">
            <div className="rounded-xl bg-amber-50 p-3">
              <div className="text-[10px] font-semibold text-amber-600 mb-1">Ø Bewertung</div>
              <div className="text-xl font-black tabular-nums text-amber-700">{data.avgRating.toFixed(1)}</div>
              <StarRow avg={data.avgRating} count={data.totalRatings} />
            </div>
            <div className="rounded-xl bg-matcha-50 p-3">
              <div className="text-[10px] font-semibold text-matcha-600 mb-1">Positiv</div>
              <div className="text-xl font-black tabular-nums text-matcha-700">
                {Math.round(data.positiveRate * 100)}%
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <ThumbsUp className="h-3 w-3 text-matcha-500" />
                <span className="text-[10px] text-matcha-600">{data.totalRatings} Bew.</span>
              </div>
            </div>
            <div className="rounded-xl bg-blue-50 p-3">
              <div className="text-[10px] font-semibold text-blue-600 mb-1">Mit Kommentar</div>
              <div className="text-xl font-black tabular-nums text-blue-700">{data.withComment}</div>
              <div className="flex items-center gap-1 mt-0.5">
                <MessageSquare className="h-3 w-3 text-blue-500" />
                <span className="text-[10px] text-blue-600">Rückmeldungen</span>
              </div>
            </div>
          </div>

          {/* Top Fahrer */}
          {topDriver && topDriver.totalRatings >= 2 && (
            <div className="mx-4 mb-3 rounded-xl bg-stone-50 border border-stone-100 flex items-center gap-3 p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-matcha-100 text-matcha-700 text-xs font-black">
                #1
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-stone-800 truncate">
                  {topDriver.driverName ?? 'Unbekannt'} — bester Fahrer
                </div>
                <StarRow avg={topDriver.avgRating} count={topDriver.totalRatings} />
              </div>
            </div>
          )}

          {/* Letzte Kommentare */}
          {comments.length > 0 && (
            <div className="px-4 pb-4 space-y-2">
              <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">
                Letzte Kommentare
              </div>
              {comments.map((c, i) => (
                <div key={i} className="rounded-xl border border-stone-100 bg-white p-3">
                  <div className="flex items-start gap-2">
                    <RatingBadge rating={c.rating} />
                    <p className="text-xs text-stone-600 flex-1 leading-snug">&quot;{c.comment}&quot;</p>
                  </div>
                  <div className="mt-1 text-[10px] text-stone-400 text-right">
                    {timeAgo(c.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
