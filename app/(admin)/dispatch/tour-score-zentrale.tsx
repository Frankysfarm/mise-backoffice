'use client';

import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

type BatchStop = {
  id: string;
  order_id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    bestellnummer: string;
    kunde_name: string;
    eta_earliest: string | null;
  } | null;
};

type Batch = {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  total_distance_km: number | null;
  total_eta_min: number | null;
  zone: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: BatchStop[];
};

interface Props {
  batches: Batch[];
}

type Health = 'gut' | 'mittel' | 'schlecht';

interface BatchScore {
  batch: Batch;
  score: number;
  health: Health;
  progress: number;
  elapsedMin: number | null;
  completedStops: number;
  totalStops: number;
}

const ACTIVE_STATUSES = new Set(['unterwegs', 'on_route', 'assigned', 'pickup']);

const HEALTH_CONFIG: Record<Health, { color: string; bg: string; text: string; label: string }> = {
  gut:      { color: 'text-green-400', bg: 'bg-green-500', text: 'text-green-400', label: 'Gut' },
  mittel:   { color: 'text-amber-400',  bg: 'bg-amber-500',  text: 'text-amber-400',  label: 'Mittel' },
  schlecht: { color: 'text-red-400',   bg: 'bg-red-500',    text: 'text-red-400',    label: 'Schlecht' },
};

function computeScore(batch: Batch): BatchScore {
  const now = Date.now();
  const totalStops = batch.stops.length;
  const completedStops = batch.stops.filter(s => s.geliefert_am != null).length;
  const progress = totalStops > 0 ? (completedStops / totalStops) * 100 : 0;

  const elapsedMin = batch.startzeit
    ? Math.floor((now - new Date(batch.startzeit).getTime()) / 60000)
    : null;

  let score = 80;
  let allOnTime = true;
  for (const stop of batch.stops) {
    if (stop.geliefert_am) continue;
    if (stop.order?.eta_earliest && new Date(stop.order.eta_earliest).getTime() < now) {
      score -= 5;
      allOnTime = false;
    }
  }
  if (allOnTime && totalStops > 0) score += 5;
  score = Math.max(0, Math.min(100, score));

  const health: Health = score >= 80 ? 'gut' : score >= 60 ? 'mittel' : 'schlecht';

  return { batch, score, health, progress, elapsedMin, completedStops, totalStops };
}

export function DispatchTourScoreZentrale({ batches }: Props) {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT(n => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const active = batches.filter(b => ACTIVE_STATUSES.has(b.status));
  const scored = active.map(computeScore).sort((a, b) => b.score - a.score);

  const avgScore = scored.length > 0
    ? Math.round(scored.reduce((s, b) => s + b.score, 0) / scored.length)
    : null;
  const best = scored[0]?.score ?? null;
  const worst = scored[scored.length - 1]?.score ?? null;

  return (
    <div className="rounded-xl bg-matcha-900 border border-matcha-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-matcha-700">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-[#4AE68A]" />
          <span className="font-bold text-matcha-50 text-sm">Tour-Score Zentrale</span>
        </div>
        <span className="rounded-full bg-matcha-700 text-matcha-200 text-xs font-bold px-2 py-0.5">
          {active.length} aktiv
        </span>
      </div>

      {/* Summary strip */}
      {avgScore !== null && (
        <div className="flex items-center gap-4 px-4 py-2 bg-matcha-800/50 border-b border-matcha-700 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-matcha-400">Ø Score:</span>
            <span className="font-black text-matcha-50">{avgScore}</span>
          </div>
          {best !== null && (
            <div className="flex items-center gap-1">
              <span className="text-green-400">Beste:</span>
              <span className="font-bold text-green-300">{best}</span>
            </div>
          )}
          {worst !== null && best !== worst && (
            <div className="flex items-center gap-1">
              <span className="text-red-400">Letzte:</span>
              <span className="font-bold text-red-300">{worst}</span>
            </div>
          )}
        </div>
      )}

      {/* Batch list */}
      <div className="divide-y divide-matcha-800">
        {scored.length === 0 ? (
          <div className="px-4 py-6 text-center text-matcha-400 text-sm">
            Keine aktiven Touren
          </div>
        ) : (
          scored.map(({ batch, score, health, progress, elapsedMin, completedStops, totalStops }) => {
            const cfg = HEALTH_CONFIG[health];
            return (
              <div key={batch.id} className="px-4 py-3 flex items-center gap-3">
                {/* Score circle */}
                <div className={cn(
                  'h-10 w-10 rounded-full border-2 flex items-center justify-center shrink-0 font-black text-sm',
                  health === 'gut' ? 'border-green-500 text-green-400' :
                  health === 'mittel' ? 'border-amber-500 text-amber-400' :
                  'border-red-500 text-red-400',
                )}>
                  {score}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-matcha-100 truncate">
                      {batch.fahrer ? `${batch.fahrer.vorname} ${batch.fahrer.nachname}` : 'Kein Fahrer'}
                    </span>
                    {batch.zone && (
                      <span className="text-[10px] bg-matcha-700 text-matcha-300 rounded px-1.5 py-0.5 shrink-0">
                        {batch.zone}
                      </span>
                    )}
                  </div>
                  {/* Progress bar */}
                  <div className="h-1.5 bg-matcha-700 rounded-full overflow-hidden mb-1">
                    <div
                      className={cn('h-full rounded-full transition-all', cfg.bg)}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-matcha-400">
                    <span>{completedStops}/{totalStops} Stopps</span>
                    {elapsedMin !== null && <span>· {elapsedMin}min</span>}
                  </div>
                </div>

                {/* Health badge */}
                <span className={cn(
                  'text-[10px] font-bold shrink-0 rounded px-1.5 py-0.5',
                  health === 'gut' ? 'bg-green-950/60 text-green-400' :
                  health === 'mittel' ? 'bg-amber-950/60 text-amber-400' :
                  'bg-red-950/60 text-red-400',
                )}>
                  {cfg.label}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
