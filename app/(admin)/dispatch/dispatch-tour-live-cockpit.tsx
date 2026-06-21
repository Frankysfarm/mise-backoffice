'use client';

/**
 * DispatchTourLiveCockpit
 * Einheitliche Live-Tour-Ansicht: Alle aktiven Touren mit Fahrer, Stops, Score und ETA.
 * Zeigt Dispatch-Score, Fortschrittsbalken und nächsten Stop auf einen Blick.
 */

import { useEffect, useState, useMemo } from 'react';
import { cn, euro } from '@/lib/utils';
import {
  Bike, MapPin, Clock, CheckCircle2, AlertTriangle,
  TrendingUp, Navigation, Package, Star, ChevronRight, Zap,
} from 'lucide-react';

type Stop = {
  id: string;
  order_id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    eta_earliest: string | null;
    eta_latest: string | null;
  } | null;
};

type Batch = {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  total_distance_km: number | null;
  total_eta_min: number | null;
  dispatch_score?: number | null;
  zone: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: Stop[];
};

interface Props {
  batches: Batch[];
  compact?: boolean;
}

function useTick() {
  const [, setN] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setN(n => n + 1), 5000);
    return () => clearInterval(iv);
  }, []);
}

function elapsedMin(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
}

function etaCountdown(iso: string | null): string | null {
  if (!iso) return null;
  const secs = Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
  if (secs < -3600) return 'Überfällig';
  const sign = secs < 0 ? '-' : '';
  const abs = Math.abs(secs);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
}

function ScorePill({ score }: { score: number | null | undefined }) {
  if (score == null) return null;
  const pct = Math.min(100, Math.max(0, score));
  const color = pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative h-1.5 w-16 overflow-hidden rounded-full bg-gray-200">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn('text-[10px] font-black tabular-nums', pct >= 75 ? 'text-emerald-700' : pct >= 50 ? 'text-amber-700' : 'text-red-700')}>
        {Math.round(pct)}
      </span>
    </div>
  );
}

export function DispatchTourLiveCockpit({ batches, compact = false }: Props) {
  useTick();

  const activeBatches = useMemo(() =>
    batches.filter(b => ['zugewiesen', 'pickup', 'unterwegs', 'assigned', 'at_restaurant', 'on_route'].includes(b.status)),
    [batches]
  );

  if (activeBatches.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <Package className="h-4 w-4" />
        Keine aktiven Touren
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activeBatches.map(batch => {
        const stops = [...batch.stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
        const delivered = stops.filter(s => s.geliefert_am).length;
        const total = stops.length;
        const nextStop = stops.find(s => !s.geliefert_am);
        const elapsed = elapsedMin(batch.startzeit);
        const etaTotal = batch.total_eta_min ?? 0;
        const progressPct = total > 0 ? Math.round((delivered / total) * 100) : 0;
        const isLate = elapsed > etaTotal + 5 && etaTotal > 0;
        const driverName = batch.fahrer
          ? `${batch.fahrer.vorname} ${batch.fahrer.nachname}`
          : 'Fahrer';

        const statusLabel: Record<string, string> = {
          zugewiesen: 'Zugewiesen',
          pickup: 'Abholung',
          unterwegs: 'Unterwegs',
          assigned: 'Zugewiesen',
          at_restaurant: 'Im Restaurant',
          on_route: 'Unterwegs',
        };

        return (
          <div
            key={batch.id}
            className={cn(
              'rounded-2xl border bg-white shadow-sm overflow-hidden',
              isLate && 'border-red-300',
            )}
          >
            {/* Header row */}
            <div className={cn(
              'flex items-center gap-3 px-4 py-2.5',
              isLate ? 'bg-red-50' : 'bg-matcha-50',
            )}>
              <div className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                isLate ? 'bg-red-500' : 'bg-matcha-500',
              )}>
                <Bike className="h-4 w-4 text-white" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm font-black text-matcha-900 truncate">
                    {driverName}
                  </span>
                  {isLate && (
                    <span className="flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-black text-red-700 animate-pulse">
                      <AlertTriangle size={8} /> Verspätet
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="font-medium">{statusLabel[batch.status] ?? batch.status}</span>
                  {batch.zone && <span>· Zone {batch.zone}</span>}
                  {elapsed > 0 && <span>· {elapsed} Min unterwegs</span>}
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-0.5">
                <ScorePill score={batch.dispatch_score} />
                <span className="text-[9px] text-muted-foreground">
                  {delivered}/{total} Stops
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-gray-100">
              <div
                className={cn('h-full transition-all duration-1000', isLate ? 'bg-red-400' : 'bg-matcha-400')}
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* Next stop */}
            {nextStop?.order && !compact && (
              <div className="flex items-start gap-3 border-t border-dashed px-4 py-3">
                <Navigation className="mt-0.5 h-4 w-4 shrink-0 text-matcha-600" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-matcha-600">
                      Nächster Stop
                    </span>
                    <span className="rounded-full bg-matcha-100 px-1.5 py-0.5 text-[9px] font-black text-matcha-700">
                      #{nextStop.reihenfolge}
                    </span>
                  </div>
                  <div className="mt-0.5 text-sm font-bold text-gray-900 truncate">
                    {nextStop.order.kunde_name}
                  </div>
                  {nextStop.order.kunde_adresse && (
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                      <MapPin size={9} />
                      {nextStop.order.kunde_adresse}
                    </div>
                  )}
                </div>

                {nextStop.order.eta_earliest && (
                  <div className="shrink-0 text-right">
                    <div className="text-[9px] uppercase tracking-wide text-muted-foreground">ETA</div>
                    <div className={cn(
                      'text-sm font-black tabular-nums',
                      (() => {
                        const s = Math.floor((new Date(nextStop.order.eta_earliest).getTime() - Date.now()) / 1000);
                        return s < 0 ? 'text-red-600' : s < 300 ? 'text-amber-600' : 'text-matcha-700';
                      })()
                    )}>
                      {etaCountdown(nextStop.order.eta_earliest)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* All stops mini-list */}
            {!compact && stops.length > 1 && (
              <div className="border-t px-4 pb-3">
                <div className="mt-2 space-y-1">
                  {stops.map((s, idx) => (
                    <div key={s.id} className="flex items-center gap-2 text-[10px]">
                      <div className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-black',
                        s.geliefert_am
                          ? 'bg-matcha-500 text-white'
                          : idx === stops.findIndex(x => !x.geliefert_am)
                          ? 'bg-amber-400 text-white'
                          : 'bg-gray-200 text-gray-500',
                      )}>
                        {s.geliefert_am ? '✓' : s.reihenfolge}
                      </div>
                      <span className={cn(
                        'truncate',
                        s.geliefert_am ? 'text-muted-foreground line-through' : 'text-gray-800 font-medium',
                      )}>
                        {s.order?.kunde_name ?? `Stop ${s.reihenfolge}`}
                      </span>
                      {s.order?.bestellnummer && (
                        <span className="ml-auto shrink-0 text-muted-foreground">
                          #{s.order.bestellnummer}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
