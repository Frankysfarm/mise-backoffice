'use client';

/**
 * Phase 683 — Liefer-Qualitäts-Versprechen-Widget
 * Ø Bewertung + Pünktlichkeitsquote + aktueller Küchenstatus live.
 * Props: locationId: string
 */

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Star, Clock, ChefHat, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';

type QualityData = {
  rating: number | null;
  ratingAnzahl: number;
  punctualityPct: number | null;
  puenktlichAnzahl: number;
  gesamtLieferungen: number;
  kueche: 'frei' | 'knapp' | 'ausgelastet';
  offeneBestellungen: number;
};

const KUECHE_STYLE = {
  frei:        { dot: 'bg-matcha-500',  text: 'text-matcha-700 dark:text-matcha-300',  label: 'Küche frei',      bg: 'bg-matcha-50 dark:bg-matcha-950/20'   },
  knapp:       { dot: 'bg-amber-500',   text: 'text-amber-700 dark:text-amber-300',    label: 'Küche etwas ausgelastet', bg: 'bg-amber-50 dark:bg-amber-950/20' },
  ausgelastet: { dot: 'bg-red-500',     text: 'text-red-700 dark:text-red-300',        label: 'Küche sehr ausgelastet',  bg: 'bg-red-50 dark:bg-red-950/20'    },
};

function StarRow({ rating, count }: { rating: number | null; count: number }) {
  if (rating === null) return <span className="text-xs text-muted-foreground">Noch keine Bewertungen</span>;
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.5;
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            'h-3.5 w-3.5',
            i < full
              ? 'fill-amber-400 text-amber-400'
              : i === full && hasHalf
              ? 'fill-amber-200 text-amber-400'
              : 'fill-muted text-muted-foreground/30',
          )}
        />
      ))}
      <span className="text-xs font-bold ml-1">{rating.toFixed(1)}</span>
      <span className="text-xs text-muted-foreground">({count} Bew.)</span>
    </div>
  );
}

export function Phase683LieferQualitaetsVersprechen({ locationId }: { locationId: string }) {
  const [data, setData] = useState<QualityData | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    let active = true;

    const load = async () => {
      try {
        const res = await fetch(
          `/api/delivery/admin/liefer-qualitaets-versprechen?location_id=${locationId}`,
          { cache: 'no-store' },
        );
        if (!res.ok || !active) return;
        const json = await res.json() as QualityData & { ok?: boolean };
        if (active) setData(json);
      } catch {
        // silently ignore
      }
    };

    load();
    const id = setInterval(load, 90_000);
    return () => { active = false; clearInterval(id); };
  }, [locationId]);

  if (!data) return null;

  const kuecheStyle = KUECHE_STYLE[data.kueche];

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition"
        onClick={() => setOpen((p) => !p)}
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-matcha-600" />
          <span className="font-semibold text-sm">Unser Liefer-Versprechen</span>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Bewertung */}
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <Star className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold mb-1">Kundenbewertung (30 Tage)</p>
              <StarRow rating={data.rating} count={data.ratingAnzahl} />
            </div>
          </div>

          {/* Pünktlichkeit */}
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <Clock className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-semibold mb-1">Pünktlichkeitsquote</p>
              {data.punctualityPct !== null ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">{data.punctualityPct}%</span>
                    <span className="text-xs text-muted-foreground">
                      {data.puenktlichAnzahl} / {data.gesamtLieferungen} Lieferungen
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        data.punctualityPct >= 80
                          ? 'bg-matcha-500'
                          : data.punctualityPct >= 60
                          ? 'bg-amber-400'
                          : 'bg-red-500',
                      )}
                      style={{ width: `${data.punctualityPct}%` }}
                    />
                  </div>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Noch keine Daten</span>
              )}
            </div>
          </div>

          {/* Küchenstatus */}
          <div className={cn('flex items-center gap-3 rounded-lg px-3 py-2.5', kuecheStyle.bg)}>
            <ChefHat className={cn('h-4 w-4 shrink-0', kuecheStyle.text)} />
            <div>
              <p className={cn('text-xs font-semibold', kuecheStyle.text)}>
                Küchenstatus jetzt
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={cn('h-2 w-2 rounded-full animate-pulse', kuecheStyle.dot)} />
                <span className={cn('text-xs font-medium', kuecheStyle.text)}>
                  {kuecheStyle.label} · {data.offeneBestellungen} Bestellungen in Zubereitung
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
