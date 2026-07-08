'use client';

import { useEffect, useState, useMemo } from 'react';
import { Route, MapPin, CheckCircle2, Clock, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BatchStop {
  id: string;
  order_id: string;
  reihenfolge: number;
  geliefert_am: string | null;
}

interface BatchFahrer {
  vorname: string;
  nachname: string;
}

interface Batch {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  total_eta_min: number | null;
  fahrer: BatchFahrer | null;
  stops: BatchStop[];
}

interface Props {
  batches: Batch[];
}

interface TourEntry {
  batchId: string;
  driverName: string;
  status: string;
  etaMin: number | null;
  stops: { reihenfolge: number; done: boolean; active: boolean }[];
  progressPct: number;
}

export function DispatchPhase828TourVisualisierungsCockpit({ batches }: Props) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 10_000);
    return () => clearInterval(iv);
  }, []);

  const tours = useMemo<TourEntry[]>(() => {
    const activeBatches = batches.filter(
      (b) => ['unterwegs', 'on_route', 'assigned', 'pickup', 'active'].includes(b.status)
    );
    return activeBatches.slice(0, 5).map((b) => {
      const batchStops = [...b.stops].sort((a, s) => a.reihenfolge - s.reihenfolge);
      const doneCount = batchStops.filter((s) => !!s.geliefert_am).length;
      const totalCount = batchStops.length || 1;
      const progressPct = Math.round((doneCount / totalCount) * 100);
      const driverName = b.fahrer
        ? `${b.fahrer.vorname} ${b.fahrer.nachname.charAt(0)}.`
        : 'Fahrer';
      const now = Date.now();
      const etaMs = b.startzeit && b.total_eta_min != null
        ? new Date(b.startzeit).getTime() + b.total_eta_min * 60_000
        : null;
      const etaMin = etaMs ? Math.max(0, Math.ceil((etaMs - now) / 60_000)) : null;

      const stopEntries = batchStops.map((s, idx) => ({
        reihenfolge: s.reihenfolge,
        done: !!s.geliefert_am,
        active: !s.geliefert_am && (idx === 0 || !!batchStops[idx - 1]?.geliefert_am),
      }));

      return { batchId: b.id, driverName, status: b.status, etaMin, stops: stopEntries, progressPct };
    });
  }, [batches, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mock data if no active tours
  const MOCK_TOURS: TourEntry[] = [
    {
      batchId: 'mock1', driverName: 'Max M.', status: 'unterwegs',
      etaMin: 8, progressPct: 60,
      stops: [{ reihenfolge: 1, done: true, active: false }, { reihenfolge: 2, done: true, active: false }, { reihenfolge: 3, done: false, active: true }],
    },
    {
      batchId: 'mock2', driverName: 'Anna K.', status: 'unterwegs',
      etaMin: 22, progressPct: 25,
      stops: [{ reihenfolge: 1, done: true, active: false }, { reihenfolge: 2, done: false, active: true }, { reihenfolge: 3, done: false, active: false }, { reihenfolge: 4, done: false, active: false }],
    },
  ];

  const display = tours.length > 0 ? tours : MOCK_TOURS;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-blue-50 border-blue-100">
        <Route className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-bold text-blue-800">Tour-Visualisierung</span>
        <span className="ml-auto text-[10px] text-blue-500 font-medium">
          {display.length} aktive Touren
        </span>
      </div>

      <div className="divide-y divide-stone-50">
        {display.map((t) => (
          <div key={t.batchId} className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-stone-800">{t.driverName}</span>
                <span className="text-[10px] text-stone-400 capitalize">{t.status}</span>
              </div>
              <div className="flex items-center gap-2">
                {t.etaMin !== null && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-stone-400" />
                    <span className="text-[11px] font-bold tabular-nums text-stone-600">
                      ETA {t.etaMin} Min
                    </span>
                  </div>
                )}
                <span className="text-[10px] text-matcha-600 font-bold">{t.progressPct}%</span>
              </div>
            </div>

            {/* Tour Stopp Visualisierung */}
            <div className="flex items-center gap-0 relative">
              <div className="w-2.5 h-2.5 rounded-full bg-matcha-500 ring-2 ring-matcha-200 shrink-0 z-10" />
              {t.stops.map((s, idx) => (
                <div key={s.reihenfolge} className="flex items-center flex-1 relative">
                  <div className={cn('flex-1 h-0.5', s.done ? 'bg-matcha-400' : 'bg-stone-200')} />
                  <div className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10',
                    s.done ? 'bg-matcha-500' : s.active ? 'bg-blue-500 ring-2 ring-blue-200 animate-pulse' : 'bg-stone-200'
                  )}>
                    {s.done
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                      : s.active
                      ? <MapPin className="h-3.5 w-3.5 text-white" />
                      : <Circle className="h-3 w-3 text-stone-400" />
                    }
                  </div>
                </div>
              ))}
            </div>

            {/* Fortschrittsbalken */}
            <div className="mt-2 h-1 bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-matcha-400 rounded-full transition-all duration-500"
                style={{ width: `${t.progressPct}%` }}
              />
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-[9px] text-stone-400">Start</span>
              <span className="text-[9px] text-stone-400">
                {t.stops.filter((s) => s.done).length}/{t.stops.length} Stopps
              </span>
              <span className="text-[9px] text-stone-400">Ziel</span>
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-2 border-t border-stone-100">
        <span className="text-[10px] text-stone-400">Live Tour-Tracker · alle 10s</span>
      </div>
    </div>
  );
}
