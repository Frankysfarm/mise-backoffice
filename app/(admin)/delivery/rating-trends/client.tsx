'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Star, TrendingUp, TrendingDown, Minus, RefreshCw, Users, MapPin } from 'lucide-react';

interface Bucket {
  label: string;
  from: string;
  to: string;
  avgRating: number;
  count: number;
  pct5: number;
  pct4: number;
  pct3: number;
  pct2: number;
  pct1: number;
}

interface DriverStat {
  driverId: string;
  driverName: string | null;
  avgRating: number;
  count: number;
  trend: number;
}

interface ZoneStat {
  zone: string;
  avgRating: number;
  count: number;
}

interface TrendsData {
  buckets: Bucket[];
  overall: { avgRating: number; totalRatings: number; trend: number };
  byDriver: DriverStat[];
  byZone: ZoneStat[];
  granularity: 'week' | 'month';
  _fallback?: boolean;
}

const WEEKS_OPTIONS = [8, 12, 24] as const;
const GRANULARITY_OPTIONS = [
  { value: 'week' as const, label: 'Wöchentlich' },
  { value: 'month' as const, label: 'Monatlich' },
];

function starColor(rating: number): string {
  if (rating >= 4.5) return 'text-matcha-700';
  if (rating >= 3.5) return 'text-amber-500';
  return 'text-red-500';
}

function ratingBg(rating: number): string {
  if (rating >= 4.5) return 'bg-matcha-100 text-matcha-800';
  if (rating >= 3.5) return 'bg-amber-50 text-amber-700';
  return 'bg-red-50 text-red-700';
}

function TrendBadge({ value }: { value: number }) {
  if (Math.abs(value) < 0.05) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
        <Minus className="h-2.5 w-2.5" /> stabil
      </span>
    );
  }
  if (value > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-matcha-700">
        <TrendingUp className="h-3 w-3" /> +{value.toFixed(2)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-red-600">
      <TrendingDown className="h-3 w-3" /> {value.toFixed(2)}
    </span>
  );
}

function StarRating({ value }: { value: number }) {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={cn(
            'h-3.5 w-3.5',
            i <= full
              ? 'fill-amber-400 text-amber-400'
              : i === full + 1 && half
              ? 'fill-amber-200 text-amber-400'
              : 'text-muted-foreground/20',
          )}
        />
      ))}
    </div>
  );
}

function BarChart({ buckets, maxRating = 5 }: { buckets: Bucket[]; maxRating?: number }) {
  const maxCount = Math.max(...buckets.map(b => b.count), 1);
  const hasData = buckets.some(b => b.count > 0);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        Noch keine Bewertungsdaten vorhanden.
      </div>
    );
  }

  return (
    <div className="flex items-end gap-1.5 h-40 overflow-x-auto pb-2">
      {buckets.map((b) => {
        const heightPct = b.count === 0 ? 0 : Math.max(4, (b.avgRating / maxRating) * 100);
        const volumePct = b.count === 0 ? 0 : (b.count / maxCount) * 100;
        const color =
          b.avgRating >= 4.5
            ? 'bg-matcha-500'
            : b.avgRating >= 3.5
            ? 'bg-amber-400'
            : b.avgRating > 0
            ? 'bg-red-400'
            : 'bg-muted/40';

        return (
          <div key={b.label} className="flex flex-col items-center gap-1 min-w-[36px] flex-1 group relative">
            {/* Tooltip */}
            {b.count > 0 && (
              <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                <div className="rounded-lg bg-foreground text-background text-[10px] px-2 py-1.5 whitespace-nowrap shadow-lg">
                  <div className="font-bold">{b.label}</div>
                  <div>Ø {b.avgRating.toFixed(1)} · {b.count} Bewertungen</div>
                  <div className="text-[9px] opacity-70 mt-0.5">
                    ★★★★★ {b.pct5}% · ★★★★ {b.pct4}% · ★★★ {b.pct3}%
                  </div>
                </div>
                <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-foreground" />
              </div>
            )}
            {/* Volume indicator (small dot) */}
            <div
              className="w-full rounded-t-sm transition-all"
              style={{
                height: `${heightPct}%`,
                opacity: b.count === 0 ? 0.2 : 0.3 + 0.7 * (volumePct / 100),
              }}
            >
              <div className={cn('w-full h-full rounded-t-sm', color)} />
            </div>
            {/* Label */}
            <span className="text-[9px] text-muted-foreground whitespace-nowrap rotate-45 origin-left translate-y-2 translate-x-1">
              {b.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function StackedBarChart({ bucket }: { bucket: Bucket }) {
  if (bucket.count === 0) return null;
  const segments = [
    { label: '★★★★★', pct: bucket.pct5, cls: 'bg-matcha-500' },
    { label: '★★★★', pct: bucket.pct4, cls: 'bg-matcha-300' },
    { label: '★★★', pct: bucket.pct3, cls: 'bg-amber-300' },
    { label: '★★', pct: bucket.pct2, cls: 'bg-orange-400' },
    { label: '★', pct: bucket.pct1, cls: 'bg-red-400' },
  ].filter(s => s.pct > 0);

  return (
    <div className="flex h-5 rounded-full overflow-hidden gap-px w-full">
      {segments.map(s => (
        <div
          key={s.label}
          className={cn('h-full transition-all', s.cls)}
          style={{ width: `${s.pct}%` }}
          title={`${s.label}: ${s.pct}%`}
        />
      ))}
    </div>
  );
}

export function RatingTrendsClient({ locationId }: { locationId: string }) {
  const [weeks, setWeeks] = useState<8 | 12 | 24>(12);
  const [granularity, setGranularity] = useState<'week' | 'month'>('week');
  const [data, setData] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch(
      `/api/delivery/admin/rating-trends?location_id=${locationId}&weeks=${weeks}&granularity=${granularity}`,
    )
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setData(d as TrendsData); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId, weeks, granularity]);

  useEffect(() => { load(); }, [load]);

  const activeBuckets = data?.buckets.filter(b => b.count > 0) ?? [];
  const latestBucket = activeBuckets[activeBuckets.length - 1];

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 rounded-xl border bg-card p-1">
          {GRANULARITY_OPTIONS.map(g => (
            <button
              key={g.value}
              onClick={() => setGranularity(g.value)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-semibold transition',
                granularity === g.value
                  ? 'bg-matcha-700 text-white'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 rounded-xl border bg-card p-1">
          {WEEKS_OPTIONS.map(w => (
            <button
              key={w}
              onClick={() => setWeeks(w)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-semibold transition',
                weeks === w
                  ? 'bg-matcha-700 text-white'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {w} {granularity === 'week' ? 'Wochen' : 'Monate'}
            </button>
          ))}
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="ml-auto flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-sm bg-card border-border text-muted-foreground hover:bg-muted transition disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </button>
      </div>

      {/* KPIs */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border bg-card p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Gesamtbewertung</div>
            <div className={cn('font-display text-2xl font-black', starColor(data.overall.avgRating))}>
              {data.overall.avgRating > 0 ? data.overall.avgRating.toFixed(2) : '—'}
            </div>
            <StarRating value={data.overall.avgRating} />
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Bewertungen gesamt</div>
            <div className="font-display text-2xl font-black">{data.overall.totalRatings}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">im gewählten Zeitraum</div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Trend</div>
            <div className="font-display text-2xl font-black">
              <TrendBadge value={data.overall.trend} />
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">letzte vs. vorletzte Periode</div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Aktuelle Periode</div>
            <div className={cn('font-display text-2xl font-black', latestBucket ? starColor(latestBucket.avgRating) : '')}>
              {latestBucket?.avgRating.toFixed(2) ?? '—'}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {latestBucket ? `${latestBucket.count} Bewertungen` : 'keine Daten'}
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
          Lade Bewertungs-Trends…
        </div>
      )}

      {/* Trend-Chart */}
      {!loading && data && (
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-400" />
              Ø-Bewertung über Zeit
            </h2>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-matcha-500 inline-block" /> ≥ 4.5</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-400 inline-block" /> ≥ 3.5</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-400 inline-block" /> &lt; 3.5</span>
            </div>
          </div>
          <BarChart buckets={data.buckets} />

          {data._fallback && (
            <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Hinweis: customer_ratings-Tabelle nicht gefunden — Näherungswerte aus Dispatch-Scores angezeigt.
            </p>
          )}
        </div>
      )}

      {/* Bewertungsverteilung der letzten Periode */}
      {!loading && latestBucket && latestBucket.count > 0 && (
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h2 className="font-semibold text-sm">Verteilung — {latestBucket.label}</h2>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map(star => {
              const pct = star === 5 ? latestBucket.pct5
                : star === 4 ? latestBucket.pct4
                : star === 3 ? latestBucket.pct3
                : star === 2 ? latestBucket.pct2
                : latestBucket.pct1;
              return (
                <div key={star} className="flex items-center gap-2">
                  <span className="text-xs font-medium w-6 text-right">{star}★</span>
                  <div className="flex-1 h-4 bg-muted/40 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        star >= 4 ? 'bg-matcha-400' : star === 3 ? 'bg-amber-300' : 'bg-red-400',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-8 text-right tabular-nums">{pct}%</span>
                </div>
              );
            })}
          </div>
          <StackedBarChart bucket={latestBucket} />
        </div>
      )}

      {/* Alle Buckets als Tabelle */}
      {!loading && data && data.buckets.some(b => b.count > 0) && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <h2 className="font-semibold text-sm">{granularity === 'week' ? 'Wöchentliche' : 'Monatliche'} Übersicht</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border">
                  <th className="text-left px-4 py-2">Periode</th>
                  <th className="text-left px-4 py-2">Ø Bewertung</th>
                  <th className="text-left px-4 py-2">Anzahl</th>
                  <th className="text-left px-4 py-2 hidden md:table-cell">Verteilung</th>
                  <th className="text-left px-4 py-2 hidden md:table-cell">5★ / 1★</th>
                </tr>
              </thead>
              <tbody>
                {[...data.buckets].reverse().map(b => (
                  <tr key={b.label} className="border-t border-border hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 text-sm font-medium tabular-nums">{b.label}</td>
                    <td className="px-4 py-2.5">
                      {b.count > 0 ? (
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', ratingBg(b.avgRating))}>
                          {b.avgRating.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">–</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground tabular-nums">
                      {b.count > 0 ? b.count : '–'}
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell">
                      {b.count > 0 ? (
                        <div className="w-32">
                          <StackedBarChart bucket={b} />
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell text-xs text-muted-foreground tabular-nums">
                      {b.count > 0 ? `${b.pct5}% / ${b.pct1}%` : '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pro Fahrer */}
      {!loading && data && data.byDriver.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm">Bewertungen nach Fahrer</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border">
                  <th className="text-left px-4 py-2">Fahrer</th>
                  <th className="text-left px-4 py-2">Ø Bewertung</th>
                  <th className="text-left px-4 py-2">Bewertungen</th>
                  <th className="text-left px-4 py-2">Trend</th>
                </tr>
              </thead>
              <tbody>
                {data.byDriver.map(d => (
                  <tr key={d.driverId} className="border-t border-border hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 text-sm font-medium">
                      {d.driverName ?? d.driverId.slice(0, 8)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', ratingBg(d.avgRating))}>
                          {d.avgRating.toFixed(2)}
                        </span>
                        <StarRating value={d.avgRating} />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground tabular-nums">{d.count}</td>
                    <td className="px-4 py-2.5"><TrendBadge value={d.trend} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pro Zone */}
      {!loading && data && data.byZone.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm">Bewertungen nach Zone</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border">
                  <th className="text-left px-4 py-2">Zone</th>
                  <th className="text-left px-4 py-2">Ø Bewertung</th>
                  <th className="text-left px-4 py-2">Bewertungen</th>
                </tr>
              </thead>
              <tbody>
                {data.byZone.map(z => (
                  <tr key={z.zone} className="border-t border-border hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 text-sm font-medium">{z.zone}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', ratingBg(z.avgRating))}>
                        {z.avgRating.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground tabular-nums">{z.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && data && data.overall.totalRatings === 0 && (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
          <Star className="h-4 w-4 mr-2" />
          Noch keine Bewertungen für den gewählten Zeitraum.
        </div>
      )}
    </div>
  );
}
