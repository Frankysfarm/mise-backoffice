'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Star, MessageSquare, TrendingUp, Clock, Award } from 'lucide-react';

/**
 * Phase 939 — Kundenzufriedenheits-Verlauf (Fahrer-App)
 *
 * Letzte 10 Kundenbewertungen als Timeline mit Sterne + Kommentar-Snippet.
 * Nur sichtbar wenn isOnline=true.
 */

interface Bewertung {
  id: string;
  rating: number;
  kommentar: string | null;
  created_at: string;
  order_bestellnummer: string | null;
}

interface ApiResponse {
  bewertungen: Bewertung[];
  avg_rating: number;
  count: number;
}

interface Props {
  driverId: string;
  isOnline: boolean;
}

function StarRow({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) {
  const iconClass = size === 'lg' ? 'w-4 h-4' : 'w-3 h-3';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn(iconClass, s <= rating ? 'text-amber-400 fill-amber-400' : 'text-stone-300')}
        />
      ))}
    </div>
  );
}

function formatRelTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `vor ${min} Min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} Std`;
  return `vor ${Math.floor(h / 24)} Tagen`;
}

function ratingColor(rating: number): string {
  if (rating >= 5) return 'text-matcha-600';
  if (rating >= 4) return 'text-blue-600';
  if (rating >= 3) return 'text-amber-600';
  return 'text-red-600';
}

function ratingBg(rating: number): string {
  if (rating >= 5) return 'bg-matcha-50 border-matcha-200';
  if (rating >= 4) return 'bg-blue-50 border-blue-200';
  if (rating >= 3) return 'bg-amber-50 border-amber-200';
  return 'bg-red-50 border-red-200';
}

export function FahrerPhase939KundenzufriedenheitsVerlauf({ driverId, isOnline }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOnline) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/driver/kundenzufriedenheit?driver_id=${driverId}`);
        if (!res.ok) return;
        const json = await res.json() as ApiResponse;
        if (!cancelled) setData(json);
      } catch {
        // silent fallback
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const t = setInterval(load, 10 * 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [driverId, isOnline]);

  if (!isOnline || (!loading && !data)) return null;
  if (loading && !data) {
    return (
      <div className="rounded-2xl bg-white border border-stone-100 p-4 text-center text-sm text-stone-400">
        Bewertungen laden…
      </div>
    );
  }
  if (!data || data.count === 0) return null;

  const { bewertungen, avg_rating, count } = data;

  const avgColor = avg_rating >= 4.5 ? 'text-matcha-600' : avg_rating >= 3.5 ? 'text-blue-600' : avg_rating >= 2.5 ? 'text-amber-600' : 'text-red-600';
  const fiveStarCount = bewertungen.filter((b) => b.rating === 5).length;

  return (
    <div className="rounded-2xl bg-white border border-stone-100 overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-stone-100 bg-gradient-to-r from-amber-50 to-white">
        <div className="flex items-center gap-2 mb-2">
          <Award className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-bold text-stone-800">Kundenzufriedenheit</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className={cn('text-3xl font-black tabular-nums', avgColor)}>{avg_rating.toFixed(1)}</div>
            <StarRow rating={Math.round(avg_rating)} size="lg" />
            <div className="text-[10px] text-stone-400 mt-0.5">Ø aus {count} Bewertungen</div>
          </div>

          <div className="flex-1 space-y-1">
            {[5, 4, 3].map((stars) => {
              const starCount = bewertungen.filter((b) => b.rating === stars).length;
              const pct = count > 0 ? Math.round((starCount / count) * 100) : 0;
              return (
                <div key={stars} className="flex items-center gap-2">
                  <span className="text-[10px] text-stone-500 w-3 text-right">{stars}</span>
                  <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400 shrink-0" />
                  <div className="flex-1 h-1.5 rounded-full bg-stone-100 overflow-hidden">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] text-stone-400 w-5 text-right">{starCount}</span>
                </div>
              );
            })}
          </div>
        </div>

        {fiveStarCount >= 3 && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-matcha-700 bg-matcha-50 rounded-lg px-2.5 py-1.5">
            <TrendingUp className="w-3 h-3" />
            <span className="font-semibold">{fiveStarCount}× 5 Sterne heute — Großartige Arbeit!</span>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="divide-y divide-stone-50">
        {bewertungen.map((b, idx) => (
          <div key={b.id} className={cn('px-4 py-2.5 flex items-start gap-3', ratingBg(b.rating), 'border-l-2')}>
            {/* Index bubble */}
            <div className="shrink-0 w-5 h-5 rounded-full bg-white border border-stone-200 flex items-center justify-center text-[9px] font-black text-stone-400 mt-0.5">
              {idx + 1}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <StarRow rating={b.rating} />
                <span className={cn('text-[10px] font-bold', ratingColor(b.rating))}>
                  {b.rating === 5 ? '⭐ Perfekt' : b.rating === 4 ? 'Sehr gut' : b.rating === 3 ? 'Ok' : b.rating === 2 ? 'Ausbaufähig' : 'Enttäuschend'}
                </span>
              </div>

              {b.kommentar && (
                <div className="flex items-start gap-1 mt-1">
                  <MessageSquare className="w-2.5 h-2.5 text-stone-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-stone-600 leading-snug line-clamp-2">{b.kommentar}</p>
                </div>
              )}
            </div>

            {/* Timestamp */}
            <div className="shrink-0 text-right">
              <div className="flex items-center gap-1 text-[9px] text-stone-400">
                <Clock className="w-2.5 h-2.5" />
                <span>{formatRelTime(b.created_at)}</span>
              </div>
              {b.order_bestellnummer && (
                <div className="text-[9px] text-stone-400 mt-0.5">#{b.order_bestellnummer}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-stone-50 border-t border-stone-100 text-xs text-stone-400 flex items-center gap-1">
        <Clock className="w-3 h-3" />
        <span>Aktualisiert alle 10 Min</span>
      </div>
    </div>
  );
}
