'use client';

import * as React from 'react';

// Mock — API-Anbindung folgt
interface HorizonData {
  label: string;
  predicted: number;
}

function getMockData(): HorizonData[] {
  const base = Math.floor(Math.random() * 4) + 1;
  return [
    { label: '15 Min', predicted: base },
    { label: '30 Min', predicted: base + Math.floor(Math.random() * 4) + 1 },
    { label: '45 Min', predicted: base + Math.floor(Math.random() * 6) + 3 },
  ];
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

export function KitchenSchichtQueuePrognose({ locationId: _locationId }: Props) {
  const [data, setData] = React.useState<HorizonData[]>(() => getMockData());
  const highLoad = data[data.length - 1]?.predicted > 5;
  const maxCount = 10;

  React.useEffect(() => {
    const iv = setInterval(() => setData(getMockData()), 60_000);
    return () => clearInterval(iv);
  }, []);

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

            {/* Sparkline-Balken */}
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
