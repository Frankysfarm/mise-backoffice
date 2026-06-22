'use client';

import { useEffect, useState } from 'react';
import { Bike, CheckCircle2, Clock, MapPin, Navigation, AlertTriangle, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TourTimelineBoardProps {
  batches: Array<{
    id: string;
    status: string;
    started_at: string | null;
    total_eta_min: number | null;
    score?: number | null;
    fahrer: { vorname: string; nachname: string } | null;
    stops: Array<{
      id: string;
      reihenfolge: number;
      geliefert_am: string | null;
      angekommen_am: string | null;
      order: {
        bestellnummer: string;
        kunde_name: string;
        kunde_adresse: string | null;
        eta_earliest: string | null;
      } | null;
    }>;
  }>;
}

function useTick(intervalMs = 1000) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return tick;
}

function formatCountdown(targetIso: string | null): string {
  if (!targetIso) return '--';
  const diff = Math.floor((new Date(targetIso).getTime() - Date.now()) / 1000);
  if (diff <= 0) return 'Jetzt';
  const m = Math.floor(diff / 60);
  const s = diff % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function isLate(stop: { geliefert_am: string | null; order: { eta_earliest: string | null } | null }): boolean {
  if (!stop.geliefert_am || !stop.order?.eta_earliest) return false;
  return new Date(stop.geliefert_am) > new Date(stop.order.eta_earliest);
}

function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return null;
  const color =
    score >= 80
      ? 'bg-green-500/20 text-green-400 border-green-500/40'
      : score >= 60
        ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
        : 'bg-red-500/20 text-red-400 border-red-500/40';
  return (
    <span className={cn('flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold', color)}>
      <Trophy className="h-3 w-3" />
      {score}
    </span>
  );
}

function StopNode({
  stop,
  isCurrent,
  tick,
}: {
  stop: TourTimelineBoardProps['batches'][0]['stops'][0];
  isCurrent: boolean;
  tick: number;
}) {
  void tick; // consumed to trigger re-render for countdown
  const delivered = !!stop.geliefert_am;
  const late = delivered && isLate(stop as { geliefert_am: string | null; order: { eta_earliest: string | null } | null });
  const label = stop.order?.kunde_name ?? stop.order?.bestellnummer ?? `#${stop.reihenfolge}`;
  const eta = isCurrent ? formatCountdown(stop.order?.eta_earliest ?? null) : null;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative flex items-center justify-center">
        {isCurrent && (
          <span className="absolute inline-flex h-8 w-8 animate-ping rounded-full bg-matcha-600 opacity-40" />
        )}
        <div
          className={cn(
            'relative flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors',
            delivered && !late && 'border-matcha-600 bg-matcha-600 text-white',
            delivered && late && 'border-red-500 bg-red-500 text-white',
            isCurrent && !delivered && 'border-matcha-600 bg-matcha-900 text-matcha-400',
            !isCurrent && !delivered && 'border-matcha-700 bg-transparent text-matcha-600',
          )}
          title={label}
        >
          {delivered ? (
            late ? (
              <AlertTriangle className="h-3.5 w-3.5" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )
          ) : isCurrent ? (
            <Navigation className="h-3.5 w-3.5" />
          ) : (
            <MapPin className="h-3 w-3" />
          )}
        </div>
      </div>
      <span className="max-w-[60px] truncate text-center text-[10px] leading-tight text-matcha-600/80">{label}</span>
      {eta && (
        <span className="flex items-center gap-0.5 text-[10px] font-medium text-amber-400">
          <Clock className="h-2.5 w-2.5" />
          {eta}
        </span>
      )}
    </div>
  );
}

function TourSwimlane({ batch, tick }: { batch: TourTimelineBoardProps['batches'][0]; tick: number }) {
  const sorted = [...batch.stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const currentIdx = sorted.findIndex((s) => !s.geliefert_am);
  const driverName = batch.fahrer
    ? `${batch.fahrer.vorname} ${batch.fahrer.nachname}`
    : 'Unbekannt';

  return (
    <div className="rounded-xl border border-matcha-700/50 bg-matcha-900/50 px-4 py-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
          </span>
          <Bike className="h-4 w-4 text-matcha-500" />
          <span className="text-sm font-semibold text-matcha-200">{driverName}</span>
        </div>
        <div className="flex items-center gap-2">
          {batch.total_eta_min != null && (
            <span className="flex items-center gap-1 text-xs text-matcha-500">
              <Clock className="h-3 w-3" />
              {batch.total_eta_min} min
            </span>
          )}
          <ScoreBadge score={batch.score} />
        </div>
      </div>

      <div className="relative flex items-start gap-0">
        {sorted.map((stop, idx) => (
          <div key={stop.id} className="flex flex-1 items-center">
            <StopNode stop={stop} isCurrent={idx === currentIdx} tick={tick} />
            {idx < sorted.length - 1 && (
              <div
                className={cn(
                  'mx-1 h-0.5 flex-1',
                  idx < currentIdx ? 'bg-matcha-600' : 'bg-matcha-700/50',
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TourTimelineBoard({ batches }: TourTimelineBoardProps) {
  const tick = useTick();

  if (batches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-matcha-700/50 bg-matcha-900/50 py-16 text-matcha-600">
        <Bike className="h-10 w-10 opacity-40" />
        <p className="text-sm">Keine aktiven Touren</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {batches.map((batch) => (
        <TourSwimlane key={batch.id} batch={batch} tick={tick} />
      ))}
    </div>
  );
}
