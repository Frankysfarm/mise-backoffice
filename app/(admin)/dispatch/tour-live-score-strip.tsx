'use client';

import { useMemo } from 'react';
import { Clock, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

type BatchStop = {
  id: string;
  order_id: string;
  reihenfolge: number;
  geliefert_am: string | null;
};

type Batch = {
  id: string;
  status: string;
  fahrer_id: string | null;
  started_at: string | null;
  total_eta_min: number | null;
  stops: BatchStop[];
  fahrer: { vorname: string; nachname: string } | null;
};

interface Props {
  batches: Batch[];
}

function computeScore(batch: Batch): number {
  const elapsedMin = batch.started_at
    ? (Date.now() - new Date(batch.started_at).getTime()) / 60_000
    : 0;
  const totalEta = batch.total_eta_min ?? 30;
  const stopsRemaining = batch.stops.filter((s) => s.geliefert_am === null).length;
  const score = Math.max(
    0,
    100 - (elapsedMin / totalEta) * 100 * 0.5 - stopsRemaining * 5,
  );
  return Math.round(score);
}

function scoreColor(score: number) {
  if (score >= 80) return 'bg-emerald-500 text-white';
  if (score >= 60) return 'bg-amber-500 text-white';
  return 'bg-red-500 text-white';
}

function scoreRing(score: number) {
  if (score >= 80) return 'border-emerald-400';
  if (score >= 60) return 'border-amber-400';
  return 'border-red-400';
}

function elapsedLabel(startedAt: string | null): string {
  if (!startedAt) return '–';
  const min = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60_000);
  if (min < 60) return `${min} Min`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

export function TourLiveScoreStrip({ batches }: Props) {
  const active = useMemo(
    () => batches.filter((b) => b.status === 'unterwegs' || b.status === 'pickup'),
    [batches],
  );

  if (active.length === 0) return null;

  return (
    <div className="bg-card border rounded-xl p-3">
      <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2.5">
        Live-Score — Aktive Touren
      </div>
      <div className="flex flex-wrap gap-2">
        {active.map((batch) => {
          const score = computeScore(batch);
          const stopsLeft = batch.stops.filter((s) => s.geliefert_am === null).length;
          const driverName = batch.fahrer
            ? `${batch.fahrer.vorname} ${batch.fahrer.nachname.charAt(0)}.`
            : 'Fahrer';

          return (
            <div
              key={batch.id}
              className={cn(
                'flex items-center gap-2.5 rounded-xl border px-3 py-2',
                scoreRing(score),
              )}
            >
              {/* Score badge */}
              <div
                className={cn(
                  'h-10 w-10 rounded-full flex items-center justify-center font-display font-black text-sm shrink-0',
                  scoreColor(score),
                )}
              >
                {score}
              </div>

              {/* Info */}
              <div className="min-w-0">
                <div className="text-sm font-bold leading-tight truncate">{driverName}</div>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-0.5">
                    <Clock className="h-3 w-3" />
                    {elapsedLabel(batch.started_at)}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <MapPin className="h-3 w-3" />
                    {stopsLeft} Stop{stopsLeft !== 1 ? 's' : ''} übrig
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
