'use client';

import { useEffect, useState } from 'react';
import { CloudRain, Wind, Thermometer, AlertTriangle, Cloud, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WeatherData {
  current: {
    tempC: number | null;
    precipMm: number | null;
    windKmh: number | null;
    weatherDesc: string | null;
    difficultyScore: number;
    etaFactor: number;
    isDangerous: boolean;
    alertMessage: string | null;
    capturedAt: string;
  } | null;
  minutesAgo: number | null;
}

function weatherIcon(desc: string | null) {
  if (!desc) return <Cloud className="h-4 w-4" />;
  const d = desc.toLowerCase();
  if (d.includes('regen') || d.includes('niesel') || d.includes('schauer')) return <CloudRain className="h-4 w-4" />;
  if (d.includes('wind') || d.includes('sturm')) return <Wind className="h-4 w-4" />;
  if (d.includes('klar') || d.includes('sonnig')) return <Sun className="h-4 w-4" />;
  return <Cloud className="h-4 w-4" />;
}

export function KitchenWetterEinflussBanner({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<WeatherData | null>(null);

  useEffect(() => {
    if (!locationId) return;
    let mounted = true;

    async function load() {
      try {
        const res = await fetch(`/api/delivery/admin/weather-intelligence?action=dashboard&location_id=${locationId}`);
        if (!res.ok || !mounted) return;
        const json = await res.json();
        if (mounted) setData({ current: json.current, minutesAgo: json.minutesAgo });
      } catch { /* ignore */ }
    }

    load();
    const iv = setInterval(load, 10 * 60_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [locationId]);

  const cur = data?.current;
  if (!cur) return null;

  // Only show if weather has meaningful impact
  if (cur.etaFactor < 1.05 && !cur.isDangerous) return null;

  const isDanger = cur.isDangerous;
  const isWarn = !isDanger && cur.etaFactor >= 1.1;

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm transition-all',
        isDanger
          ? 'bg-red-50 border-red-200 text-red-800'
          : isWarn
          ? 'bg-amber-50 border-amber-200 text-amber-800'
          : 'bg-blue-50 border-blue-200 text-blue-800',
      )}
    >
      <div className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
        isDanger ? 'bg-red-100' : isWarn ? 'bg-amber-100' : 'bg-blue-100',
      )}>
        {isDanger ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          weatherIcon(cur.weatherDesc)
        )}
      </div>

      <div className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-0.5">
        <span className="font-semibold">
          {isDanger ? '⚠ Gefährliche Wetterlage' : '🌦 Wetter beeinflusst Lieferzeiten'}
        </span>

        <div className="flex items-center gap-3 text-xs font-medium opacity-90">
          {cur.weatherDesc && (
            <span className="flex items-center gap-1">
              {weatherIcon(cur.weatherDesc)}
              {cur.weatherDesc}
            </span>
          )}
          {cur.tempC != null && (
            <span className="flex items-center gap-1">
              <Thermometer className="h-3 w-3" />
              {cur.tempC.toFixed(0)} °C
            </span>
          )}
          {cur.windKmh != null && cur.windKmh > 20 && (
            <span className="flex items-center gap-1">
              <Wind className="h-3 w-3" />
              {cur.windKmh.toFixed(0)} km/h
            </span>
          )}
        </div>

        <div className={cn(
          'ml-auto flex items-center gap-2 rounded-full px-3 py-0.5 text-xs font-bold',
          isDanger ? 'bg-red-200 text-red-900' : isWarn ? 'bg-amber-200 text-amber-900' : 'bg-blue-200 text-blue-900',
        )}>
          ETA ×{cur.etaFactor.toFixed(1)}
          {cur.etaFactor > 1 && (
            <span className="opacity-75">
              (+{Math.round((cur.etaFactor - 1) * 30)} Min bei 30 Min Basis)
            </span>
          )}
        </div>
      </div>

      {cur.alertMessage && (
        <div className="mt-1 w-full pl-11 text-xs opacity-80">{cur.alertMessage}</div>
      )}
    </div>
  );
}
