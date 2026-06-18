'use client';

import * as React from 'react';

interface HorizonData {
  label: string;
  predicted: number;
}

interface ApiResponse {
  horizons: Array<{ label: string; minutes: number; predicted: number }>;
}

function colorClass(count: number): string {
  if (count <= 2) return 'text-green-700 bg-green-50 border-green-200';
  if (count <= 5) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-red-700 bg-red-50 border-red-200';
}

function barColor(count: number): string {
  if (count <= 2) return 'bg-green-500';
  if (count <= 5) return 'bg-amber-500';
  return 'bg-red-500';
}

interface Props {
  locationId: string;
}

export function KitchenSchichtQueuePrognose({ locationId }: Props) {
  const [data, setData] = React.useState<HorizonData[]>([
    { label: '15 Min', predicted: 0 },
    { label: '30 Min', predicted: 0 },
    { label: '45 Min', predicted: 0 },
  ]);
  const [loading, setLoading] = React.useState(true);
  const maxCount = 10;

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(
        `/api/delivery/kitchen/queue-forecast?location_id=${encodeURIComponent(locationId)}`,
      );
      if (!res.ok) return;
      const json: ApiResponse = await res.json();
      if (json.horizons?.length) {
        setData(
          json.horizons.map((h) => ({ label: h.label, predicted: h.predicted })),
        );
      }
    } catch {
      // Netzwerk-Fehler — bisherige Daten behalten
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  React.useEffect(() => {
    void load();
    const iv = setInterval(() => void load(), 60_000);
    return () => clearInterval(iv);
  }, [load]);

  const highLoad = data[data.length - 1]?.predicted > 5;

  return (
    <div className="rounded-xl border border-matcha-200 bg-matcha-50 p-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-matcha-700">Queue-Prognose</span>
        {highLoad && (
          <span className="flex items-center gap-1 text-xs font-medium text-red-600">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Hohe Auslastung erwartet
          </span>
        )}
        {loading && (
          <span className="ml-auto text-xs text-matcha-400">Laden…</span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {data.map((horizon) => (
          <div
            key={horizon.label}
            className={`rounded-lg border p-3 flex flex-col gap-2 ${colorClass(horizon.predicted)}`}
          >
            <span className="text-xs font-medium opacity-75">{horizon.label}</span>
            <span className="text-2xl font-bold leading-none">{horizon.predicted}</span>
            <span className="text-xs opacity-75">Bestellungen</span>

            <div className="h-2 w-full bg-white/50 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColor(horizon.predicted)}`}
                style={{ width: `${Math.min((horizon.predicted / maxCount) * 100, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
