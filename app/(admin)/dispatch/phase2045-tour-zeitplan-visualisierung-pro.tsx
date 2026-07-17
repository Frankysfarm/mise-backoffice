'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Route, ChevronDown, ChevronUp, Clock } from 'lucide-react';

interface Batch {
  id: string;
  driver_id?: string;
  status?: string;
  zone?: string;
  created_at?: string;
  expected_end?: string;
  stops?: {
    id: string;
    reihenfolge?: number;
    geliefert_am?: string | null;
    angekommen_am?: string | null;
    order?: { kunde_adresse?: string };
  }[];
}

interface Driver {
  id: string;
  name?: string;
  vorname?: string;
}

interface Props {
  batches: Batch[];
  drivers: Driver[];
  className?: string;
}

interface GanttRow {
  batchId: string;
  driverName: string;
  zone: string;
  startMin: number;
  durationMin: number;
  elapsedMin: number;
  stopsDone: number;
  stopsTotal: number;
  isLate: boolean;
  statusLabel: string;
}

const ACTIVE = new Set(['dispatched', 'on_route', 'active', 'in_progress', 'collecting']);
const EXPECTED_MIN = 45;

export function DispatchPhase2045TourZeitplanVisualisierungPro({ batches, drivers, className }: Props) {
  const [open, setOpen] = useState(true);

  const { rows, maxMin } = useMemo(() => {
    const driverMap = new Map(drivers.map(d => [d.id, d.vorname ?? d.name ?? 'Fahrer']));
    const now = Date.now();
    const nowMin = now / 60_000;

    const list: GanttRow[] = batches
      .filter(b => ACTIVE.has(b.status ?? '') && b.created_at)
      .map(b => {
        const startMs = new Date(b.created_at!).getTime();
        const startMin = startMs / 60_000;
        const elapsedMin = Math.floor((now - startMs) / 60_000);
        const stops = b.stops ?? [];
        const stopsDone = stops.filter(s => s.geliefert_am).length;
        const durationMin = b.expected_end
          ? Math.round((new Date(b.expected_end).getTime() - startMs) / 60_000)
          : EXPECTED_MIN;
        const isLate = elapsedMin > durationMin;

        return {
          batchId: b.id,
          driverName: driverMap.get(b.driver_id ?? '') ?? 'Unbekannt',
          zone: b.zone ?? '—',
          startMin,
          durationMin,
          elapsedMin,
          stopsDone,
          stopsTotal: stops.length,
          isLate,
          statusLabel: isLate ? `+${elapsedMin - durationMin}m Verzögerung` : `${durationMin - elapsedMin}m verbleibend`,
        };
      });

    const maxDuration = Math.max(...list.map(r => r.elapsedMin + 5), EXPECTED_MIN);
    return { rows: list, maxMin: maxDuration };
  }, [batches, drivers]);

  const lateCount = rows.filter(r => r.isLate).length;

  return (
    <div className={cn('rounded-xl border border-gray-800 bg-gray-900 overflow-hidden', className)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-100 hover:bg-gray-800 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Route className="w-4 h-4 text-teal-400" />
          Tour-Zeitplan-Visualisierung
          {lateCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-xs bg-red-900 text-red-300">
              {lateCount} verspätet
            </span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2.5">
          {rows.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-3">Keine aktiven Touren</p>
          ) : (
            rows.map(r => (
              <div key={r.batchId} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-gray-200">
                    <span className="font-semibold">{r.driverName}</span>
                    <span className="text-gray-500">Zone {r.zone}</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px]">
                    <Clock className="w-3 h-3 text-gray-500" />
                    <span className={cn(r.isLate ? 'text-red-400 font-bold' : 'text-gray-400')}>
                      {r.statusLabel}
                    </span>
                  </span>
                </div>

                {/* Gantt-ähnlicher Balken */}
                <div className="relative h-5 bg-gray-800 rounded-full overflow-hidden">
                  {/* Erwartete Dauer */}
                  <div
                    className="absolute top-0 left-0 h-full bg-teal-900/60 rounded-full"
                    style={{ width: `${Math.min((r.durationMin / maxMin) * 100, 100)}%` }}
                  />
                  {/* Tatsächlicher Verlauf */}
                  <div
                    className={cn(
                      'absolute top-0 left-0 h-full rounded-full transition-all',
                      r.isLate ? 'bg-red-500' : 'bg-teal-500',
                    )}
                    style={{ width: `${Math.min((r.elapsedMin / maxMin) * 100, 100)}%` }}
                  />
                  <div className="absolute inset-0 flex items-center px-2 justify-between text-[9px] font-bold">
                    <span className="text-white">{r.elapsedMin}m</span>
                    <span className={cn(r.stopsDone === r.stopsTotal ? 'text-green-300' : 'text-white')}>
                      {r.stopsDone}/{r.stopsTotal}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}

          {rows.length > 0 && (
            <div className="flex items-center gap-4 text-[10px] text-gray-500 pt-1">
              <span className="flex items-center gap-1"><div className="w-3 h-2 rounded bg-teal-900/60" /> Plan</span>
              <span className="flex items-center gap-1"><div className="w-3 h-2 rounded bg-teal-500" /> Verlauf (pünktlich)</span>
              <span className="flex items-center gap-1"><div className="w-3 h-2 rounded bg-red-500" /> Verlauf (verspätet)</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
