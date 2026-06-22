'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, Clock, AlertTriangle } from 'lucide-react';

type BatchStop = {
  id: string;
  geliefert_am: string | null;
  angekommen_am: string | null;
};

type Batch = {
  id: string;
  fahrer_id: string;
  status: string;
  started_at: string | null;
  total_eta_min: number | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: BatchStop[];
};

interface Props {
  batches: Batch[];
  orders: Array<{ id: string; bestellnummer: string; status: string }>;
}

const ACTIVE_STATUSES = ['unterwegs', 'on_route', 'aktiv', 'assigned'];

function calcEtaMinRemaining(batch: Batch): number | null {
  if (!batch.started_at || batch.total_eta_min == null) return null;
  const startMs = new Date(batch.started_at).getTime();
  const totalMs = batch.total_eta_min * 60_000;
  const endMs = startMs + totalMs;

  const totalStops = batch.stops.length;
  const completedStops = batch.stops.filter((s) => s.geliefert_am != null).length;

  // Fraction of tour already done by completed stops reduces remaining ETA
  const fraction = totalStops > 0 ? completedStops / totalStops : 0;
  const elapsedMs = Date.now() - startMs;
  const progressMs = fraction * totalMs;
  const adjustedEndMs = endMs - progressMs + Math.max(0, elapsedMs - progressMs);

  const minsLeft = Math.floor((endMs - Date.now()) / 60_000);
  return minsLeft;
}

type Urgency = 'green' | 'amber' | 'red';

function urgencyFromMin(min: number | null): Urgency {
  if (min === null) return 'green';
  if (min > 10) return 'green';
  if (min >= 5) return 'amber';
  return 'red';
}

const URGENCY_STYLE: Record<Urgency, { card: string; badge: string; text: string }> = {
  green: { card: 'border-matcha-200 bg-matcha-50', badge: 'bg-matcha-100 text-matcha-700', text: 'text-matcha-700' },
  amber: { card: 'border-amber-200 bg-amber-50',   badge: 'bg-amber-100 text-amber-700',   text: 'text-amber-700'   },
  red:   { card: 'border-red-200 bg-red-50',       badge: 'bg-red-100 text-red-700',       text: 'text-red-700'     },
};

export function FahrerPickupEtaAnzeige({ batches }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(iv);
  }, []);

  const activeBatches = batches.filter((b) => ACTIVE_STATUSES.includes(b.status));
  if (activeBatches.length === 0) return null;

  const enriched = activeBatches
    .map((b) => {
      const etaMin = calcEtaMinRemaining(b);
      const urgency = urgencyFromMin(etaMin);
      const name = b.fahrer ? `${b.fahrer.vorname} ${b.fahrer.nachname[0]}.` : 'Fahrer';
      const completedStops = b.stops.filter((s) => s.geliefert_am != null).length;
      const totalStops = b.stops.length;
      return { batch: b, etaMin, urgency, name, completedStops, totalStops };
    })
    .sort((a, b) => {
      const aMin = a.etaMin ?? 999;
      const bMin = b.etaMin ?? 999;
      return aMin - bMin;
    });

  const redCount = enriched.filter((e) => e.urgency === 'red').length;
  const amberCount = enriched.filter((e) => e.urgency === 'amber').length;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-matcha-900/5">
        <Bike className="h-4 w-4 text-matcha-600" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Fahrer-Ankunft
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {redCount > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700 animate-pulse">
              {redCount} kritisch
            </span>
          )}
          {amberCount > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              {amberCount} bald
            </span>
          )}
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
            {activeBatches.length} aktiv
          </span>
        </div>
      </div>

      {/* Driver cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3">
        {enriched.map(({ batch, etaMin, urgency, name, completedStops, totalStops }) => {
          const s = URGENCY_STYLE[urgency];
          return (
            <div
              key={batch.id}
              className={cn(
                'rounded-lg border px-3 py-2.5 flex items-center gap-3 transition-all duration-300',
                s.card,
                urgency === 'red' && 'ring-1 ring-red-400',
              )}
            >
              {/* Bike icon */}
              <div className={cn(
                'h-9 w-9 rounded-full flex items-center justify-center shrink-0',
                urgency === 'green' ? 'bg-matcha-100' : urgency === 'amber' ? 'bg-amber-100' : 'bg-red-100',
              )}>
                <Bike className={cn('h-4 w-4', s.text)} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className={cn('font-bold text-sm truncate', s.text)}>{name}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {completedStops}/{totalStops} Stopps abgeschlossen
                </div>
              </div>

              {/* ETA badge */}
              <div className="shrink-0 flex flex-col items-end gap-1">
                {etaMin !== null ? (
                  <span className={cn(
                    'flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-black tabular-nums',
                    s.badge,
                  )}>
                    <Clock size={9} />
                    {etaMin <= 0 ? 'Jetzt' : `${etaMin} Min`}
                  </span>
                ) : (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                    —
                  </span>
                )}
                {urgency === 'red' && (
                  <AlertTriangle size={11} className="text-red-500 animate-pulse" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 border-t border-border/50 bg-muted/30">
        <p className="text-[9px] text-muted-foreground text-center uppercase tracking-widest font-bold">
          Echtzeit-Ankunfts-ETA · Aktualisierung alle 30s
        </p>
      </div>
    </div>
  );
}
