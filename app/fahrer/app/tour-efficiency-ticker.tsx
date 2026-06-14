'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

type Stop = {
  id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
  order: {
    eta_earliest: string | null;
    gesamtbetrag: number;
  } | null;
};

type Props = {
  stops: Stop[];
  batchStartedAt?: string | null;
};

function computeMetrics(stops: Stop[], batchStartedAt?: string | null) {
  const completed = stops.filter((s) => s.geliefert_am !== null);
  if (completed.length === 0) return null;

  // Pünktlichkeit: geliefert_am < eta_earliest
  const onTimeCount = completed.filter((s) => {
    if (!s.geliefert_am || !s.order?.eta_earliest) return false;
    return new Date(s.geliefert_am) <= new Date(s.order.eta_earliest);
  }).length;
  const onTimePct = Math.round((onTimeCount / completed.length) * 100);

  // Ø Minuten pro Stopp seit Batch-Start
  let avgDeliveryMin: number | null = null;
  if (batchStartedAt) {
    const startMs = new Date(batchStartedAt).getTime();
    const lastDeliveredMs = completed
      .map((s) => new Date(s.geliefert_am!).getTime())
      .reduce((a, b) => Math.max(a, b), startMs);
    const elapsedMin = (lastDeliveredMs - startMs) / 60_000;
    avgDeliveryMin = elapsedMin > 0 ? Math.round(elapsedMin / completed.length) : null;
  }

  // Prognose: jetzt + (verbleibende Stopps × avgDeliveryMin)
  let currentPace: string | null = null;
  if (avgDeliveryMin !== null) {
    const remaining = stops.filter((s) => s.geliefert_am === null).length;
    const finishMs = Date.now() + remaining * avgDeliveryMin * 60_000;
    const finishDate = new Date(finishMs);
    currentPace = finishDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }

  return { onTimePct, avgDeliveryMin, currentPace };
}

export function TourEfficiencyTicker({ stops, batchStartedAt }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, []);

  // Recalculate on tick
  void now;
  const metrics = computeMetrics(stops, batchStartedAt);

  if (!metrics) return null;

  const { onTimePct, avgDeliveryMin, currentPace } = metrics;

  const punctualityColor =
    onTimePct >= 80
      ? 'text-matcha-400'
      : onTimePct >= 60
        ? 'text-amber-400'
        : 'text-red-400';

  return (
    <div className="flex items-center gap-0 rounded-lg bg-matcha-900/80 border border-matcha-700/50 overflow-hidden text-xs h-10">
      {/* Pünktlichkeit */}
      <div className="flex items-center gap-1.5 px-3 h-full border-r border-matcha-700/50">
        <span className="text-matcha-400/70 whitespace-nowrap">Pünktlichkeit</span>
        <span className={cn('font-bold tabular-nums', punctualityColor)}>
          {onTimePct}%
        </span>
      </div>

      {/* Ø Stopp */}
      <div className="flex items-center gap-1.5 px-3 h-full border-r border-matcha-700/50">
        <span className="text-matcha-400/70 whitespace-nowrap">Ø Stopp</span>
        <span className="font-bold tabular-nums text-matcha-50">
          {avgDeliveryMin !== null ? `${avgDeliveryMin} Min` : '—'}
        </span>
      </div>

      {/* Prognose */}
      <div className="flex items-center gap-1.5 px-3 h-full">
        <span className="text-matcha-400/70 whitespace-nowrap">Prognose</span>
        <span className="font-bold tabular-nums text-matcha-50">
          {currentPace ?? '—'}
        </span>
      </div>
    </div>
  );
}
