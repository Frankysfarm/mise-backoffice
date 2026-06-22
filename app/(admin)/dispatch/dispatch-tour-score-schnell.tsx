'use client';

import { useState, useEffect } from 'react';
import { Trophy, Clock, CheckCircle2, ChevronDown, ChevronUp, MapPin, Truck, TrendingUp, Route } from 'lucide-react';
import { cn } from '@/lib/utils';

type BatchStop = {
  id: string;
  order_id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: { bestellnummer: string; kunde_name: string; kunde_adresse: string | null } | null;
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

function calcScore(batch: Batch, nowMs: number): number {
  const totalStops = batch.stops.length;
  const completedStops = batch.stops.filter((s) => s.geliefert_am !== null).length;

  const completionRate = totalStops > 0 ? (completedStops / totalStops) * 40 : 0;

  let timeEfficiency = 0;
  if (batch.startzeit && (batch.total_eta_min ?? 0) > 0) {
    const startMs = new Date(batch.startzeit).getTime();
    const elapsedMin = (nowMs - startMs) / 60000;
    const eta = batch.total_eta_min!;
    const raw = 100 - (elapsedMin - eta) * 5;
    timeEfficiency = Math.min(40, Math.max(0, raw));
  }

  const zoneBonus = batch.zone ? 20 : 0;

  return Math.round(completionRate + timeEfficiency + zoneBonus);
}

function getElapsedMin(startzeit: string | null | undefined, nowMs: number): number {
  if (!startzeit) return 0;
  return Math.floor((nowMs - new Date(startzeit).getTime()) / 60000);
}

function getEtaRemaining(batch: Batch, nowMs: number): number {
  if (!batch.startzeit || !batch.total_eta_min) return 0;
  const elapsed = getElapsedMin(batch.startzeit, nowMs);
  return Math.max(0, batch.total_eta_min - elapsed);
}

function scoreBadgeClass(score: number): string {
  if (score >= 80) return 'text-matcha-700 bg-matcha-100';
  if (score >= 60) return 'text-amber-700 bg-amber-100';
  return 'text-red-700 bg-red-100';
}

export function DispatchTourScoreSchnell({ batches }: { batches: Batch[] }) {
  const [now, setNow] = useState<number>(() => Date.now());
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const activeBatches = batches
    .map((b) => ({ batch: b, score: calcScore(b, now) }))
    .sort((a, z) => z.score - a.score)
    .slice(0, 6);

  return (
    <div className="rounded-2xl border border-matcha-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-matcha-50 hover:bg-matcha-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-matcha-600 shrink-0" />
          <span className="font-semibold text-matcha-700 text-sm">Tour-Score Übersicht</span>
          <span className="ml-1 inline-flex items-center justify-center rounded-full bg-matcha-500 text-white text-xs font-bold px-2 py-0.5 min-w-[1.5rem]">
            {activeBatches.length}
          </span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-matcha-500 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-matcha-500 shrink-0" />
        )}
      </button>

      {/* Body */}
      {open && (
        <div className="divide-y divide-gray-100">
          {activeBatches.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-gray-400">
              <Truck className="h-8 w-8" />
              <span className="text-sm">Keine aktiven Touren</span>
            </div>
          ) : (
            activeBatches.map(({ batch, score }, idx) => {
              const driverName =
                batch.fahrer
                  ? `${batch.fahrer.vorname} ${batch.fahrer.nachname}`.trim()
                  : 'Unbekannt';

              const totalStops = batch.stops.length;
              const completedStops = batch.stops.filter((s) => s.geliefert_am !== null).length;
              const progressPct = totalStops > 0 ? (completedStops / totalStops) * 100 : 0;

              const elapsedMin = getElapsedMin(batch.startzeit, now);
              const etaRemaining = getEtaRemaining(batch, now);

              return (
                <div key={batch.id} className="px-4 py-3 flex flex-col gap-2">
                  {/* Row 1: Rank + Driver + Score badge */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 w-5 shrink-0">
                      #{idx + 1}
                    </span>
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <Truck className="h-4 w-4 text-matcha-500 shrink-0" />
                      <span className="text-sm font-medium text-gray-800 truncate">
                        {driverName}
                      </span>
                    </div>
                    <span
                      className={cn(
                        'inline-flex items-center justify-center rounded-full text-xs font-bold px-2.5 py-0.5 shrink-0',
                        scoreBadgeClass(score),
                      )}
                    >
                      {score}
                    </span>
                  </div>

                  {/* Row 2: Progress bar */}
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-matcha-500 shrink-0" />
                    <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-matcha-500 transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 shrink-0 tabular-nums">
                      {completedStops}/{totalStops}
                    </span>
                  </div>

                  {/* Row 3: Zone + Time info */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {batch.zone ? (
                      <span className="inline-flex items-center gap-1 text-xs text-matcha-600 font-medium">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {batch.zone}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                        <Route className="h-3.5 w-3.5 shrink-0" />
                        Keine Zone
                      </span>
                    )}

                    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      {elapsedMin} Min vergangen
                    </span>

                    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                      <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                      ETA: {etaRemaining} Min
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
