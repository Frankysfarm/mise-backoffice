'use client';

// Phase 344: DispatchSchichtBatchBilanz — Schlüsselkennzahlen aller Batches dieser Schicht

import React, { useMemo } from 'react';
import { BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

type Stop = { geliefert_am: string | null };
type Batch = {
  id: string;
  status: string;
  total_eta_min: number | null;
  stops: Array<Stop>;
};

interface Props {
  batches: Array<Batch>;
}

export function DispatchSchichtBatchBilanz({ batches }: Props) {
  const metrics = useMemo(() => {
    if (batches.length === 0) return null;
    const relevant = batches.filter(
      (b) => b.status === 'aktiv' || b.status === 'abgeschlossen' || b.status === 'completed' || b.status === 'active'
    );
    if (relevant.length === 0) return null;
    const completed = relevant.filter(
      (b) => b.status === 'abgeschlossen' || b.status === 'completed'
    );
    const totalStops = relevant.reduce((sum, b) => sum + b.stops.length, 0);
    const avgStops = relevant.length > 0 ? Math.round((totalStops / relevant.length) * 10) / 10 : 0;
    const pctCompleted = Math.round((completed.length / relevant.length) * 100);
    const etaBatches = relevant.filter((b) => b.total_eta_min !== null);
    const avgEta =
      etaBatches.length > 0
        ? Math.round(
            etaBatches.reduce((sum, b) => sum + (b.total_eta_min ?? 0), 0) / etaBatches.length
          )
        : null;
    return { total: relevant.length, avgStops, pctCompleted, avgEta };
  }, [batches]);

  if (!metrics) return null;

  const kpiGreen = 'bg-green-50 border-green-200 text-green-800';
  const kpiAmber = 'bg-amber-50 border-amber-200 text-amber-800';

  return (
    <Card className="p-4 bg-white border border-matcha-100">
      <div className="flex items-center gap-2 mb-3">
        <BarChart2 className="h-4 w-4 text-matcha-600" />
        <span className="font-semibold text-sm text-gray-800">Schicht-Batch-Bilanz</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className={cn('rounded-lg border p-3', kpiGreen)}>
          <div className="text-xs font-medium opacity-70">Batches gesamt</div>
          <div className="text-2xl font-bold mt-0.5">{metrics.total}</div>
        </div>
        <div className={cn('rounded-lg border p-3', metrics.avgStops >= 3 ? kpiGreen : kpiAmber)}>
          <div className="text-xs font-medium opacity-70">Ø Stops/Batch</div>
          <div className="text-2xl font-bold mt-0.5">{metrics.avgStops}</div>
        </div>
        <div className={cn('rounded-lg border p-3', metrics.pctCompleted >= 50 ? kpiGreen : kpiAmber)}>
          <div className="text-xs font-medium opacity-70">Abgeschlossen</div>
          <div className="text-2xl font-bold mt-0.5">{metrics.pctCompleted}%</div>
        </div>
        <div className={cn('rounded-lg border p-3', metrics.avgEta !== null && metrics.avgEta <= 35 ? kpiGreen : kpiAmber)}>
          <div className="text-xs font-medium opacity-70">Ø ETA</div>
          <div className="text-2xl font-bold mt-0.5">
            {metrics.avgEta !== null ? `${metrics.avgEta} min` : '–'}
          </div>
        </div>
      </div>
    </Card>
  );
}
