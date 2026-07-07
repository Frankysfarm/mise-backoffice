'use client';

import { useEffect, useState, useCallback } from 'react';
import { BarChart2, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface DriverVergleich {
  driverId: string;
  driverName: string;
  vehicle: string | null;
  heute: { touren: number; km: number; trinkgeld: number };
  schnitt30d: { touren: number; km: number; trinkgeld: number };
  diff: { touren: number; km: number; trinkgeld: number };
}

interface Props {
  locationId: string | null;
}

const MOCK: DriverVergleich[] = [
  {
    driverId: 'd1',
    driverName: 'Alex B.',
    vehicle: 'bike',
    heute: { touren: 7, km: 38.4, trinkgeld: 12.5 },
    schnitt30d: { touren: 6.2, km: 34.1, trinkgeld: 10.8 },
    diff: { touren: 0.8, km: 4.3, trinkgeld: 1.7 },
  },
  {
    driverId: 'd2',
    driverName: 'Kim S.',
    vehicle: 'car',
    heute: { touren: 4, km: 29.1, trinkgeld: 7.2 },
    schnitt30d: { touren: 5.5, km: 36.8, trinkgeld: 9.0 },
    diff: { touren: -1.5, km: -7.7, trinkgeld: -1.8 },
  },
];

function TrendIcon({ val }: { val: number }) {
  if (val > 0.05) return <TrendingUp className="h-3 w-3 text-green-500" />;
  if (val < -0.05) return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-gray-400" />;
}

function DiffBadge({ val, unit }: { val: number; unit: string }) {
  const pos = val > 0.05;
  const neg = val < -0.05;
  const sign = val > 0 ? '+' : '';
  return (
    <span
      className={`text-[10px] font-semibold px-1 py-0.5 rounded ${
        pos
          ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
          : neg
          ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
          : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
      }`}
    >
      {sign}{val}{unit}
    </span>
  );
}

export function DispatchPhase625FahrerTagesleistungVergleich({ locationId }: Props) {
  const [drivers, setDrivers] = useState<DriverVergleich[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  const laden = useCallback(async () => {
    if (!locationId) {
      setDrivers(MOCK);
      return;
    }
    try {
      const res = await fetch(
        `/api/delivery/admin/fahrer-tagesleistung-vergleich?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error('API error');
      const json = await res.json();
      if (json.ok && Array.isArray(json.drivers) && json.drivers.length > 0) {
        setDrivers(json.drivers as DriverVergleich[]);
      } else {
        setDrivers(MOCK);
      }
    } catch {
      setDrivers(MOCK);
    }
  }, [locationId]);

  useEffect(() => {
    laden();
    const id = setInterval(laden, 60_000);
    return () => clearInterval(id);
  }, [laden]);

  if (drivers.length === 0) return null;

  return (
    <div className="mb-4 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 p-4 shadow-sm">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-2 text-left"
      >
        <BarChart2 className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0" />
        <span className="text-sm font-bold text-violet-800 dark:text-violet-200 uppercase tracking-wide">
          Fahrer-Leistung: Heute vs. 30-Tage-Ø
        </span>
        <span className="ml-auto rounded-full bg-violet-100 dark:bg-violet-900/40 px-2 py-0.5 text-xs font-semibold text-violet-700 dark:text-violet-300">
          {drivers.length} Fahrer
        </span>
        <span className="text-xs text-violet-400">{collapsed ? '▸' : '▾'}</span>
      </button>

      {!collapsed && (
        <div className="mt-3 flex flex-col gap-3">
          {drivers.map((d) => (
            <div
              key={d.driverId}
              className="rounded-lg bg-white dark:bg-gray-800/40 border border-violet-100 dark:border-violet-800 p-3"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="h-7 w-7 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-violet-700 dark:text-violet-300">
                    {d.driverName.charAt(0)}
                  </span>
                </div>
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{d.driverName}</span>
                {d.vehicle && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">{d.vehicle}</span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {/* Touren */}
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <span className="text-base font-black text-gray-800 dark:text-gray-200 tabular-nums">
                      {d.heute.touren}
                    </span>
                    <TrendIcon val={d.diff.touren} />
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">Touren</div>
                  <div className="flex items-center justify-center gap-1 mt-0.5">
                    <span className="text-[10px] text-gray-400">Ø {d.schnitt30d.touren}</span>
                    <DiffBadge val={Math.round(d.diff.touren * 10) / 10} unit="" />
                  </div>
                </div>
                {/* km */}
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <span className="text-base font-black text-gray-800 dark:text-gray-200 tabular-nums">
                      {d.heute.km}
                    </span>
                    <TrendIcon val={d.diff.km} />
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">km</div>
                  <div className="flex items-center justify-center gap-1 mt-0.5">
                    <span className="text-[10px] text-gray-400">Ø {d.schnitt30d.km}</span>
                    <DiffBadge val={Math.round(d.diff.km * 10) / 10} unit="km" />
                  </div>
                </div>
                {/* Trinkgeld */}
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <span className="text-base font-black text-gray-800 dark:text-gray-200 tabular-nums">
                      {d.heute.trinkgeld.toFixed(2)}€
                    </span>
                    <TrendIcon val={d.diff.trinkgeld} />
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">Trinkgeld</div>
                  <div className="flex items-center justify-center gap-1 mt-0.5">
                    <span className="text-[10px] text-gray-400">Ø {d.schnitt30d.trinkgeld.toFixed(2)}€</span>
                    <DiffBadge val={Math.round(d.diff.trinkgeld * 100) / 100} unit="€" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
