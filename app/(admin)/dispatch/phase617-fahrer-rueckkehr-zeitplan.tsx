'use client';

import { useEffect, useState, useCallback } from 'react';
import { Bike, Clock, CheckCircle2 } from 'lucide-react';

interface FahrerRueckkehr {
  driverId: string;
  name: string;
  vehicle: string;
  state: string;
  offeneStopps: number;
  geschaetzteRueckkehrMin: number;
  rueckkehrZeit: string;
}

interface Props {
  locationId: string | null;
}

const MOCK: FahrerRueckkehr[] = [
  { driverId: 'mock-1', name: 'Max M.', vehicle: 'Fahrrad', state: 'on_route', offeneStopps: 2, geschaetzteRueckkehrMin: 18, rueckkehrZeit: '' },
  { driverId: 'mock-2', name: 'Sara K.', vehicle: 'Auto', state: 'on_route', offeneStopps: 1, geschaetzteRueckkehrMin: 10, rueckkehrZeit: '' },
  { driverId: 'mock-3', name: 'Tim H.', vehicle: 'Motorrad', state: 'at_restaurant', offeneStopps: 3, geschaetzteRueckkehrMin: 28, rueckkehrZeit: '' },
];

const STATE_LABEL: Record<string, string> = {
  on_route: 'Unterwegs',
  at_restaurant: 'Im Restaurant',
  assigned: 'Zugewiesen',
};

export function DispatchPhase617FahrerRueckkehrZeitplan({ locationId }: Props) {
  const [fahrer, setFahrer] = useState<FahrerRueckkehr[]>([]);
  const [useMock, setUseMock] = useState(false);

  const laden = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(
        `/api/delivery/admin/fahrer-rueckkehr-zeitplan?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error('API error');
      const json = await res.json();
      if (json.ok && Array.isArray(json.fahrer) && json.fahrer.length > 0) {
        setFahrer(json.fahrer);
        setUseMock(false);
      } else {
        setFahrer(MOCK);
        setUseMock(true);
      }
    } catch {
      setFahrer(MOCK);
      setUseMock(true);
    }
  }, [locationId]);

  useEffect(() => {
    laden();
    const id = setInterval(laden, 30_000);
    return () => clearInterval(id);
  }, [laden]);

  if (!locationId || fahrer.length === 0) return null;

  return (
    <div className="mb-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Bike className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          <span className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300">
            Fahrer-Rückkehr-Zeitplan
          </span>
        </div>
        {useMock && (
          <span className="text-[10px] text-gray-400 dark:text-gray-500">Demo</span>
        )}
      </div>

      <div className="space-y-2">
        {fahrer.map((f) => {
          const dringend = f.geschaetzteRueckkehrMin <= 10;
          const bald = f.geschaetzteRueckkehrMin <= 20;
          const farbe = dringend
            ? 'text-green-600 dark:text-green-400'
            : bald
            ? 'text-amber-600 dark:text-amber-400'
            : 'text-blue-600 dark:text-blue-400';

          return (
            <div
              key={f.driverId}
              className="flex items-center gap-3 rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {f.name}
                  </span>
                  <span className="shrink-0 text-[10px] text-gray-500 dark:text-gray-400">
                    {f.vehicle}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">
                    {STATE_LABEL[f.state] ?? f.state}
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">·</span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">
                    {f.offeneStopps} Stopp{f.offeneStopps !== 1 ? 's' : ''} offen
                  </span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className={`flex items-center gap-1 text-sm font-black tabular-nums ${farbe}`}>
                  <Clock className="h-3.5 w-3.5" />
                  ~{f.geschaetzteRueckkehrMin} Min
                </div>
                {f.offeneStopps === 0 && (
                  <div className="flex items-center gap-0.5 text-[10px] text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-3 w-3" />
                    Gleich da
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
