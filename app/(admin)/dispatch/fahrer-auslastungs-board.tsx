'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  locationId: string;
}

interface FahrerEntry {
  name: string;
  activeStops: number;
}

interface CapacitySnapshot {
  online?: number;
  busy?: number;
  available?: number;
  drivers?: Array<{ name?: string; active_stops?: number }>;
}

const MOCK_FAHRER: FahrerEntry[] = [
  { name: 'Max Müller', activeStops: 1 },
  { name: 'Anna Schmidt', activeStops: 4 },
  { name: 'Tom Wagner', activeStops: 6 },
];

function getBarColor(stops: number): { bar: string; badge: string; label: string } {
  if (stops <= 2) return { bar: '#5c7a4e', badge: 'bg-matcha-100 text-matcha-700', label: 'Verfügbar' };
  if (stops <= 4) return { bar: '#d97706', badge: 'bg-amber-100 text-amber-700', label: 'Ausgelastet' };
  return { bar: '#ef4444', badge: 'bg-red-100 text-red-700', label: 'Überlastet' };
}

export function DispatchFahrerAuslastungsBoard({ locationId }: Props) {
  const [fahrer, setFahrer] = useState<FahrerEntry[]>(MOCK_FAHRER);
  const [loading, setLoading] = useState(true);
  const [useMock, setUseMock] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/delivery/admin/capacity-signal?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error('fetch failed');
      const data: { snapshot?: CapacitySnapshot } = await res.json();

      const snapshot = data.snapshot;
      if (snapshot?.drivers && snapshot.drivers.length > 0) {
        const mapped: FahrerEntry[] = snapshot.drivers.map((d) => ({
          name: d.name ?? 'Fahrer',
          activeStops: d.active_stops ?? 0,
        }));
        setFahrer(mapped);
        setUseMock(false);
      } else {
        setFahrer(MOCK_FAHRER);
        setUseMock(true);
      }
    } catch {
      setFahrer(MOCK_FAHRER);
      setUseMock(true);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 20_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const maxStops = Math.max(...fahrer.map((f) => f.activeStops), 1);

  return (
    <div className="rounded-xl border border-matcha-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-matcha-100 bg-matcha-50">
        <span className="text-base">🚗</span>
        <h2 className="text-sm font-semibold text-matcha-700">Fahrer-Auslastung</h2>
        {useMock && (
          <span className="ml-auto text-xs text-amber-500">(Demo)</span>
        )}
        {!useMock && (
          <span className="ml-auto text-xs text-stone-400">{fahrer.length} Fahrer</span>
        )}
      </div>

      <div className="px-4 py-3 space-y-2.5">
        {loading ? (
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 bg-stone-100 rounded-lg animate-pulse" />
            ))}
          </>
        ) : fahrer.length === 0 ? (
          <div className="text-xs text-stone-400 text-center py-3">Keine Fahrer aktiv</div>
        ) : (
          fahrer.map((f) => {
            const style = getBarColor(f.activeStops);
            const widthPct = (f.activeStops / Math.max(maxStops, 6)) * 100;
            return (
              <div key={f.name} className="flex items-center gap-3">
                {/* Name */}
                <span className="w-28 text-xs font-medium text-stone-700 truncate flex-shrink-0">
                  {f.name}
                </span>

                {/* Bar */}
                <div className="flex-1 h-4 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${widthPct}%`, backgroundColor: style.bar }}
                  />
                </div>

                {/* Count */}
                <span className="w-5 text-xs font-bold tabular-nums text-stone-600 flex-shrink-0 text-right">
                  {f.activeStops}
                </span>

                {/* Badge */}
                <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0', style.badge)}>
                  {style.label}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 px-4 pb-3 text-[9px] text-stone-400">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#5c7a4e]" />0–2 Stopps
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-500" />3–4
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500" />5+
        </span>
      </div>
    </div>
  );
}
