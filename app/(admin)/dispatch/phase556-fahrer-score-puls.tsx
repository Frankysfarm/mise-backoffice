'use client';

/**
 * Phase 556 — Fahrer-Score-Puls-Board
 *
 * Live-Übersicht aller aktiven Fahrer mit ihrem aktuellen Dispatch-Score:
 * - Score 0–100 als farbige Fortschrittsleiste (rot/amber/grün)
 * - Kompakte Metriken: Stops erledigt, nächste Adresse
 * - Sortierung: schlechtester Score zuerst (Handlungsbedarf oben)
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Bike, MapPin } from 'lucide-react';

interface Driver {
  id: string;
  vorname: string;
  nachname: string;
  fahrzeug?: string | null;
}

interface BatchStop {
  geliefert_am: string | null;
  order: { kunde_adresse: string | null } | null;
}

interface Batch {
  id: string;
  fahrer_id: string | null;
  status: string;
  dispatch_score?: number | null;
  stops: BatchStop[];
}

interface Props {
  drivers: Driver[];
  batches: Batch[];
}

type ScoreBand = 'high' | 'mid' | 'low';

function scoreBand(s: number): ScoreBand {
  if (s >= 75) return 'high';
  if (s >= 50) return 'mid';
  return 'low';
}

const BAND_STYLES: Record<ScoreBand, { bar: string; text: string; leftBorder: string }> = {
  high: { bar: 'bg-matcha-500', text: 'text-matcha-700', leftBorder: 'border-l-matcha-400' },
  mid:  { bar: 'bg-amber-400',  text: 'text-amber-700',  leftBorder: 'border-l-amber-400'  },
  low:  { bar: 'bg-red-500',    text: 'text-red-700',    leftBorder: 'border-l-red-400'    },
};

const ACTIVE_STATES = new Set(['assigned', 'at_restaurant', 'on_route', 'en_route', 'accepted']);

export function DispatchPhase556FahrerScorePuls({ drivers, batches }: Props) {
  const cards = useMemo(() => {
    const activeBatches = batches.filter(b => ACTIVE_STATES.has(b.status));
    return drivers
      .map(d => {
        const batch = activeBatches.find(b => b.fahrer_id === d.id) ?? null;
        if (!batch) return null;
        const score = batch.dispatch_score != null ? Math.round(batch.dispatch_score) : null;
        const completedStops = batch.stops.filter(s => s.geliefert_am != null).length;
        const totalStops = batch.stops.length;
        const nextStop = batch.stops.find(s => !s.geliefert_am)?.order?.kunde_adresse ?? null;
        return { driver: d, score, completedStops, totalStops, nextStop };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => (a.score ?? 100) - (b.score ?? 100));
  }, [drivers, batches]);

  if (!cards.length) return null;

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Bike className="h-4 w-4 text-muted-foreground" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Fahrer-Score-Puls
          </span>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
          {cards.length} aktiv
        </span>
      </div>

      <div className="divide-y">
        {cards.map(({ driver, score, completedStops, totalStops, nextStop }) => {
          const band = score != null ? scoreBand(score) : 'mid';
          const style = BAND_STYLES[band];
          return (
            <div
              key={driver.id}
              className={cn(
                'flex items-center gap-3 px-4 py-3 border-l-4 transition-colors hover:bg-muted/30',
                style.leftBorder,
              )}
            >
              {/* Avatar */}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted font-bold text-sm text-muted-foreground uppercase">
                {driver.vorname[0]}{driver.nachname[0]}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm truncate">
                    {driver.vorname} {driver.nachname}
                  </span>
                  {driver.fahrzeug && (
                    <span className="rounded bg-muted px-1 py-0.5 text-[9px] text-muted-foreground uppercase">
                      {driver.fahrzeug}
                    </span>
                  )}
                </div>

                {/* Score Bar */}
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-1000', style.bar)}
                      style={{ width: `${score ?? 50}%` }}
                    />
                  </div>
                  <span className={cn('text-[11px] font-black tabular-nums w-7 text-right', style.text)}>
                    {score != null ? score : '—'}
                  </span>
                </div>

                {nextStop && (
                  <div className="flex items-center gap-1 mt-1">
                    <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground truncate">{nextStop}</span>
                  </div>
                )}
              </div>

              {/* Stops */}
              <div className="shrink-0 text-center">
                <div className="text-sm font-black tabular-nums text-foreground">
                  {completedStops}/{totalStops}
                </div>
                <div className="text-[9px] text-muted-foreground">Stops</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
