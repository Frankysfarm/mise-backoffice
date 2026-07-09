'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { MessageSquare, Star, Heart } from 'lucide-react';

/**
 * Phase 969 — Kundenkommentar-Vorschau (Fahrer-App)
 *
 * Letzte 3 Kunden-Kommentare der aktuellen Schicht als Motivations-Widget.
 * Nur sichtbar wenn isOnline=true und Kommentare vorhanden.
 * 10-Min-Polling. Nutzt bestehende /api/delivery/driver/kundenzufriedenheit API.
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

function formatRelTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min`;
  const h = Math.floor(min / 60);
  return `vor ${h} Std`;
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn(
            'h-3 w-3',
            s <= rating ? 'text-amber-400 fill-amber-400' : 'text-stone-300',
          )}
        />
      ))}
    </div>
  );
}

const MOTIVATIONS_EMOJIS: Record<number, string> = {
  5: '🌟',
  4: '😊',
  3: '👍',
  2: '😐',
  1: '😕',
};

export function FahrerPhase969KundenkommentarVorschau({ driverId, isOnline }: Props) {
  const [kommentare, setKommentare] = useState<Bewertung[]>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);

  useEffect(() => {
    if (!isOnline || !driverId) return;

    const laden = async () => {
      try {
        const res = await fetch(`/api/delivery/driver/kundenzufriedenheit?driver_id=${driverId}`);
        if (!res.ok) return;
        const json: ApiResponse = await res.json();
        // Only show last 3 with a comment
        const mitKommentar = (json.bewertungen ?? []).filter((b) => b.kommentar);
        setKommentare(mitKommentar.slice(0, 3));
        setAvgRating(json.avg_rating ?? null);
      } catch {
        // silent
      }
    };

    laden();
    const interval = setInterval(laden, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [driverId, isOnline]);

  if (!isOnline || kommentare.length === 0) return null;

  const allePositiv = kommentare.every((k) => k.rating >= 4);

  return (
    <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 dark:border-amber-800 dark:from-amber-950/30 dark:to-orange-950/20 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Heart className={cn('h-4 w-4', allePositiv ? 'text-red-500 fill-red-500' : 'text-amber-600')} />
          <span className="font-bold text-sm text-amber-900 dark:text-amber-100">
            Kunden-Stimmen
          </span>
          {avgRating !== null && (
            <span className="rounded-full bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-200">
              ⌀ {avgRating.toFixed(1)} ★
            </span>
          )}
        </div>
        <MessageSquare className="h-3.5 w-3.5 text-amber-500" />
      </div>

      <div className="space-y-2.5">
        {kommentare.map((k) => (
          <div
            key={k.id}
            className={cn(
              'rounded-xl border px-3 py-2.5',
              k.rating >= 5 && 'border-amber-200 bg-amber-50/80 dark:border-amber-800 dark:bg-amber-950/20',
              k.rating === 4 && 'border-matcha-200 bg-matcha-50/80 dark:border-matcha-800 dark:bg-matcha-950/20',
              k.rating <= 3 && 'border-stone-200 bg-white dark:border-stone-700 dark:bg-zinc-900',
            )}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5">
                <span className="text-base leading-none">
                  {MOTIVATIONS_EMOJIS[k.rating] ?? '💬'}
                </span>
                <StarRow rating={k.rating} />
              </div>
              <span className="text-[9px] text-muted-foreground shrink-0">
                {formatRelTime(k.created_at)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed italic">
              „{k.kommentar}"
            </p>
            {k.order_bestellnummer && (
              <p className="mt-1 text-[9px] text-muted-foreground/60 font-mono">
                Bestellung #{k.order_bestellnummer}
              </p>
            )}
          </div>
        ))}
      </div>

      {allePositiv && (
        <div className="mt-3 rounded-lg bg-amber-100 dark:bg-amber-900/30 px-3 py-2 text-center">
          <p className="text-xs font-bold text-amber-800 dark:text-amber-200">
            🎉 Weiter so — deine Kunden sind begeistert!
          </p>
        </div>
      )}
    </div>
  );
}
