'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Trophy, MapPin, ChevronDown, ChevronUp, Star, Zap, Clock, CheckCircle2 } from 'lucide-react';

/**
 * Phase 1525 — Tour-Score-Live-Kommando (Dispatch)
 *
 * Zeigt alle aktiven Touren mit:
 *   - Fahrer-Score (0-100, farbkodiert)
 *   - Tour-Fortschritts-Balken (Stops abgeschlossen vs. gesamt)
 *   - ETA-Ampel (Grün/Gelb/Rot)
 *   - Nächste Stop-Info
 *
 * Props-basiert — kein eigener API-Aufruf.
 */

interface Stop {
  id: string;
  batch_id?: string | null;
  status?: string | null;
  estimated_arrival_at?: string | null;
  kunde_name?: string | null;
  adresse?: string | null;
  sequence?: number | null;
}

interface Driver {
  id: string;
  vorname?: string | null;
  nachname?: string | null;
  status?: { ist_online?: boolean; score?: number } | null;
}

interface Batch {
  id: string;
  driver_id?: string | null;
  status?: string | null;
  created_at?: string | null;
  stops?: Stop[] | null;
}

interface Props {
  batches: Batch[];
  drivers: Driver[];
  stops?: Stop[];
}

const ACTIVE_BATCH_STATUSES = new Set(['aktiv', 'active', 'in_progress', 'unterwegs']);
const DONE_STOP_STATUSES    = new Set(['geliefert', 'delivered', 'abgeschlossen', 'abgeholt']);

function scoreColor(score: number): { text: string; bg: string; ring: string } {
  if (score >= 80) return { text: 'text-matcha-700 dark:text-matcha-300', bg: 'bg-matcha-100 dark:bg-matcha-900/30', ring: 'ring-matcha-400' };
  if (score >= 60) return { text: 'text-yellow-700 dark:text-yellow-300', bg: 'bg-yellow-50 dark:bg-yellow-900/20', ring: 'ring-yellow-400' };
  if (score >= 40) return { text: 'text-orange-700 dark:text-orange-300', bg: 'bg-orange-50 dark:bg-orange-900/20', ring: 'ring-orange-400' };
  return               { text: 'text-red-700 dark:text-red-300',    bg: 'bg-red-50 dark:bg-red-900/20',     ring: 'ring-red-500' };
}

function etaLabel(stops: Stop[]): { label: string; color: string } {
  const nextStop = stops.find(s => !DONE_STOP_STATUSES.has(s.status ?? ''));
  if (!nextStop?.estimated_arrival_at) return { label: '–', color: 'text-muted-foreground' };
  const diffMin = Math.round((new Date(nextStop.estimated_arrival_at).getTime() - Date.now()) / 60_000);
  if (diffMin > 15) return { label: `~${diffMin} Min`, color: 'text-matcha-600' };
  if (diffMin > 5)  return { label: `~${diffMin} Min`, color: 'text-amber-600' };
  return                   { label: diffMin <= 0 ? 'Jetzt' : `~${diffMin} Min`, color: 'text-red-600' };
}

export function DispatchPhase1525TourScoreLiveKommando({ batches, drivers, stops = [] }: Props) {
  const [open, setOpen] = useState(true);

  const activeTours = useMemo(() => {
    return batches
      .filter(b => ACTIVE_BATCH_STATUSES.has(b.status ?? ''))
      .map(b => {
        const driver = drivers.find(d => d.id === b.driver_id);
        const batchStops = [...(b.stops ?? []), ...stops.filter(s => s.batch_id === b.id)]
          .sort((a, z) => (a.sequence ?? 0) - (z.sequence ?? 0));
        const doneCount  = batchStops.filter(s => DONE_STOP_STATUSES.has(s.status ?? '')).length;
        const totalCount = batchStops.length;
        const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
        const score = driver?.status?.score ?? 0;
        const eta   = etaLabel(batchStops);
        const nextStop = batchStops.find(s => !DONE_STOP_STATUSES.has(s.status ?? ''));
        return { batch: b, driver, batchStops, doneCount, totalCount, pct, score, eta, nextStop };
      });
  }, [batches, drivers, stops]);

  if (activeTours.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold">Tour-Score Live-Kommando</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
            {activeTours.length} Touren
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t divide-y">
          {activeTours.map(({ batch, driver, doneCount, totalCount, pct, score, eta, nextStop }) => {
            const sc = scoreColor(score);
            return (
              <div key={batch.id} className="px-4 py-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-2 text-sm font-black tabular-nums', sc.ring, sc.bg, sc.text)}>
                      {score}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">
                        {driver ? `${driver.vorname ?? ''} ${driver.nachname ?? ''}`.trim() || 'Fahrer' : 'Unbekannt'}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Star className="h-2.5 w-2.5" />
                        Score {score}/100
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={cn('text-sm font-bold tabular-nums', eta.color)}>
                      {eta.label}
                    </div>
                    <div className="text-[10px] text-muted-foreground">nächster Stop</div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      {doneCount}/{totalCount} Stops
                    </span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        pct >= 80 ? 'bg-matcha-500' : pct >= 50 ? 'bg-yellow-400' : 'bg-orange-500',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {nextStop && (
                  <div className="flex items-start gap-1.5 rounded-lg bg-muted/40 px-2.5 py-1.5 text-[11px]">
                    <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="truncate text-muted-foreground">
                      {nextStop.kunde_name ? `${nextStop.kunde_name} · ` : ''}
                      {nextStop.adresse ?? 'Adresse unbekannt'}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
