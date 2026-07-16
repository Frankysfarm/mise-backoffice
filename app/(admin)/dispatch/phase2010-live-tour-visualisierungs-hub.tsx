'use client';

import { useState, useEffect } from 'react';
import { Route, MapPin, Gauge, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Tour {
  batch_id: string;
  fahrer_name: string;
  status: 'unterwegs' | 'abgeschlossen' | 'warten';
  stopps_gesamt: number;
  stopps_done: number;
  eta_min: number;
  zone: string;
}

const MOCK: Tour[] = [
  { batch_id: 'b1', fahrer_name: 'Max Müller',   status: 'unterwegs',     stopps_gesamt: 12, stopps_done: 7,  eta_min: 23, zone: 'Nord'  },
  { batch_id: 'b2', fahrer_name: 'Lisa Schmidt',  status: 'abgeschlossen', stopps_gesamt: 10, stopps_done: 10, eta_min: 0,  zone: 'Süd'   },
  { batch_id: 'b3', fahrer_name: 'Tom Wagner',    status: 'warten',        stopps_gesamt: 8,  stopps_done: 0,  eta_min: 45, zone: 'Mitte' },
];

const STATUS_STIL: Record<Tour['status'], { ampel: string; label: string; badge: string }> = {
  unterwegs:     { ampel: 'bg-blue-500',  label: 'Unterwegs',     badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'   },
  abgeschlossen: { ampel: 'bg-green-500', label: 'Abgeschlossen', badge: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' },
  warten:        { ampel: 'bg-amber-500', label: 'Warten',        badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' },
};

export function DispatchPhase2010LiveTourVisualisierungsHub({
  locationId,
  className,
}: {
  locationId: string | null;
  className?: string;
}) {
  const [daten, setDaten] = useState<Tour[] | null>(null);
  const [offen, setOffen] = useState(true);

  const laden = async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/batch-monitor?location_id=${locationId}`);
      if (!res.ok) { setDaten(MOCK); return; }
      setDaten(await res.json());
    } catch {
      setDaten(MOCK);
    }
  };

  useEffect(() => {
    laden();
    const id = setInterval(laden, 30 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!locationId) return null;

  const anzeige = daten ?? MOCK;

  return (
    <div className={cn('rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Route className="w-4 h-4 text-blue-500" />
          <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">Live-Tour-Hub</span>
          <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">
            {anzeige.length} aktiv
          </span>
        </div>
        {offen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {offen && (
        <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-3 space-y-3">
          {anzeige.map((tour) => {
            const stil = STATUS_STIL[tour.status];
            const pct = tour.stopps_gesamt > 0 ? Math.round((tour.stopps_done / tour.stopps_gesamt) * 100) : 0;
            return (
              <div key={tour.batch_id} className="rounded-lg border border-slate-100 dark:border-slate-700 p-3 space-y-2">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', stil.ampel)} />
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{tour.fahrer_name}</span>
                    <span className="flex items-center gap-0.5 text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-full shrink-0">
                      <MapPin className="w-2.5 h-2.5" />
                      {tour.zone}
                    </span>
                  </div>
                  <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ml-2', stil.badge)}>{stil.label}</span>
                </div>

                {/* Fortschrittsbalken */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>{tour.stopps_done} / {tour.stopps_gesamt} Stopps</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', stil.ampel)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* ETA */}
                {tour.status !== 'abgeschlossen' && (
                  <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                    <Gauge className="w-3 h-3" />
                    <span>ETA: <span className="font-semibold text-slate-700 dark:text-slate-200">{tour.eta_min} Min.</span></span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
