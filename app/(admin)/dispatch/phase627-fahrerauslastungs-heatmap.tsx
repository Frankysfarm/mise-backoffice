'use client';

import { useEffect, useState, useCallback } from 'react';
import { Grid3X3, Users } from 'lucide-react';

interface HeatmapCell {
  hour: number;
  driverName: string;
  auslastungPct: number;
}

interface Props {
  locationId: string | null;
}

const STUNDEN = Array.from({ length: 16 }, (_, i) => i + 8); // 08:00–23:00

// Deterministic mock based on hour+driver index
function mockAuslastung(hour: number, driverIdx: number): number {
  const base = [20, 15, 10, 25, 55, 70, 85, 90, 75, 60, 45, 80, 95, 70, 50, 30];
  const variation = ((hour * 7 + driverIdx * 13) % 30) - 10;
  return Math.max(0, Math.min(100, (base[hour % base.length] ?? 50) + variation));
}

const MOCK_DRIVERS = ['Alex B.', 'Kim S.', 'Jan M.', 'Sara L.'];

function cellColor(pct: number): string {
  if (pct >= 90) return 'bg-red-600 dark:bg-red-500';
  if (pct >= 70) return 'bg-orange-400 dark:bg-orange-400';
  if (pct >= 50) return 'bg-amber-300 dark:bg-amber-400';
  if (pct >= 25) return 'bg-green-300 dark:bg-green-500';
  return 'bg-gray-100 dark:bg-gray-700';
}

function textColor(pct: number): string {
  if (pct >= 70) return 'text-white';
  if (pct >= 25) return 'text-gray-800';
  return 'text-gray-400 dark:text-gray-500';
}

export function DispatchPhase627FahrerauslastungsHeatmap({ locationId }: Props) {
  const [cells, setCells] = useState<HeatmapCell[]>([]);
  const [driverNames, setDriverNames] = useState<string[]>([]);
  const [currentHour, setCurrentHour] = useState<number>(new Date().getHours());

  const laden = useCallback(async () => {
    const nowHour = new Date().getHours();
    setCurrentHour(nowHour);

    if (!locationId) {
      // Mock data
      const mockCells: HeatmapCell[] = [];
      for (const h of STUNDEN) {
        for (let d = 0; d < MOCK_DRIVERS.length; d++) {
          mockCells.push({ hour: h, driverName: MOCK_DRIVERS[d], auslastungPct: mockAuslastung(h, d) });
        }
      }
      setCells(mockCells);
      setDriverNames([...MOCK_DRIVERS]);
      return;
    }

    try {
      const res = await fetch(
        `/api/delivery/admin/fahrer-schicht-auslastung?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error('API error');
      const json = await res.json();

      const drivers: Array<{ driverName: string; auslastungPct: number }> = (json.drivers ?? []).map(
        (d: Record<string, unknown>) => ({
          driverName: String(d.driverName ?? 'Fahrer'),
          auslastungPct: Number(d.auslastungPct ?? 0),
        }),
      );

      if (drivers.length === 0) throw new Error('no drivers');

      const names = drivers.map((d) => d.driverName);
      setDriverNames(names);

      const mockCells: HeatmapCell[] = [];
      for (const h of STUNDEN) {
        for (let di = 0; di < drivers.length; di++) {
          // Past hours: mock; current hour: live auslastungPct; future: projected
          let pct: number;
          if (h === nowHour) {
            pct = drivers[di].auslastungPct;
          } else if (h < nowHour) {
            pct = mockAuslastung(h, di);
          } else {
            // Future: lower based on current
            pct = Math.max(0, mockAuslastung(h, di) - 10);
          }
          mockCells.push({ hour: h, driverName: names[di], auslastungPct: pct });
        }
      }
      setCells(mockCells);
    } catch {
      const mockCells: HeatmapCell[] = [];
      for (const h of STUNDEN) {
        for (let d = 0; d < MOCK_DRIVERS.length; d++) {
          mockCells.push({ hour: h, driverName: MOCK_DRIVERS[d], auslastungPct: mockAuslastung(h, d) });
        }
      }
      setCells(mockCells);
      setDriverNames([...MOCK_DRIVERS]);
    }
  }, [locationId]);

  useEffect(() => {
    laden();
    const id = setInterval(laden, 60_000);
    return () => clearInterval(id);
  }, [laden]);

  if (cells.length === 0 || driverNames.length === 0) return null;

  // Group cells by driver → hours map
  const byDriver = new Map<string, Map<number, number>>();
  for (const c of cells) {
    if (!byDriver.has(c.driverName)) byDriver.set(c.driverName, new Map());
    byDriver.get(c.driverName)!.set(c.hour, c.auslastungPct);
  }

  return (
    <div className="mb-4 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 p-4 shadow-sm overflow-x-auto">
      <div className="mb-3 flex items-center gap-2">
        <Grid3X3 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
        <span className="text-sm font-bold text-indigo-800 dark:text-indigo-200 uppercase tracking-wide">
          Auslastungs-Heatmap heute
        </span>
        <Users className="ml-auto h-3.5 w-3.5 text-indigo-400" />
        <span className="text-xs text-indigo-600 dark:text-indigo-400">{driverNames.length} Fahrer</span>
      </div>

      <div className="min-w-max">
        {/* Header row: hours */}
        <div className="flex gap-0.5 mb-0.5 pl-20">
          {STUNDEN.map((h) => (
            <div
              key={h}
              className={`w-8 text-center text-[10px] font-semibold ${
                h === currentHour
                  ? 'text-indigo-700 dark:text-indigo-300'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              {String(h).padStart(2, '0')}
            </div>
          ))}
        </div>

        {/* Rows: drivers */}
        {driverNames.map((name) => {
          const hourMap = byDriver.get(name) ?? new Map();
          return (
            <div key={name} className="flex items-center gap-0.5 mb-0.5">
              <div className="w-20 shrink-0 text-xs text-gray-700 dark:text-gray-300 truncate pr-2 text-right">
                {name}
              </div>
              {STUNDEN.map((h) => {
                const pct = hourMap.get(h) ?? 0;
                const isNow = h === currentHour;
                return (
                  <div
                    key={h}
                    title={`${name} ${String(h).padStart(2, '0')}:00 — ${pct}%`}
                    className={`w-8 h-6 rounded-sm flex items-center justify-center ${cellColor(pct)} ${
                      isNow ? 'ring-2 ring-indigo-500 dark:ring-indigo-300' : ''
                    }`}
                  >
                    <span className={`text-[9px] font-bold tabular-nums ${textColor(pct)}`}>
                      {pct > 0 ? pct : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Legend */}
        <div className="mt-2 flex items-center gap-2 pl-20 flex-wrap">
          {[
            { label: '<25%', cls: 'bg-gray-100 dark:bg-gray-700' },
            { label: '25–49%', cls: 'bg-green-300 dark:bg-green-500' },
            { label: '50–69%', cls: 'bg-amber-300 dark:bg-amber-400' },
            { label: '70–89%', cls: 'bg-orange-400' },
            { label: '≥90%', cls: 'bg-red-600 dark:bg-red-500' },
          ].map(({ label, cls }) => (
            <div key={label} className="flex items-center gap-1">
              <div className={`w-3 h-3 rounded-sm ${cls}`} />
              <span className="text-[10px] text-gray-500 dark:text-gray-400">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
