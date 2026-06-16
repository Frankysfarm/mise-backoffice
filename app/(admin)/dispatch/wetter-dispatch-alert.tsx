'use client';

import { useEffect, useState } from 'react';
import { CloudRain, Wind, AlertTriangle, Bike, Car, ThumbsUp } from 'lucide-react';
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
  } | null;
  minutesAgo: number | null;
}

function vehicleRecommendation(data: WeatherData['current']): {
  label: string; icon: React.ReactNode; color: string;
} {
  if (!data) return { label: 'Keine Daten', icon: null, color: '' };
  if (data.isDangerous)
    return { label: 'Auto empfohlen — gefährliche Bedingungen', icon: <Car className="h-4 w-4" />, color: 'text-red-700' };
  const hasPrecip = (data.precipMm ?? 0) > 2;
  const hasWind = (data.windKmh ?? 0) > 30;
  if (hasPrecip || hasWind || data.difficultyScore >= 50)
    return { label: 'Auto bevorzugt', icon: <Car className="h-4 w-4" />, color: 'text-amber-700' };
  return { label: 'Bike/Auto beides OK', icon: <Bike className="h-4 w-4" />, color: 'text-matcha-700' };
}

export function WetterDispatchAlert({ locationId }: { locationId: string | null }) {
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
  // Only show when weather matters for dispatch decisions
  if (cur.difficultyScore < 20 && !cur.isDangerous) return null;

  const isDanger = cur.isDangerous;
  const isWarn = !isDanger && cur.difficultyScore >= 40;
  const rec = vehicleRecommendation(cur);

  const diffBar = Math.min(100, cur.difficultyScore);

  return (
    <div className={cn(
      'rounded-xl border p-4 space-y-3',
      isDanger ? 'bg-red-50 border-red-200' : isWarn ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200',
    )}>
      <div className="flex items-center gap-2">
        <div className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          isDanger ? 'bg-red-100 text-red-600' : isWarn ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600',
        )}>
          {isDanger ? <AlertTriangle className="h-4 w-4" /> : <CloudRain className="h-4 w-4" />}
        </div>
        <div>
          <div className={cn('text-sm font-bold', isDanger ? 'text-red-800' : isWarn ? 'text-amber-800' : 'text-blue-800')}>
            {isDanger ? '⚠ Gefährliche Wetterlage' : '🌧 Wetter-Dispatch-Hinweis'}
          </div>
          {cur.weatherDesc && (
            <div className="text-xs text-muted-foreground">{cur.weatherDesc}</div>
          )}
        </div>
      </div>

      {/* Difficulty Score Bar */}
      <div>
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="font-medium text-muted-foreground">Schwierigkeitsgrad</span>
          <span className={cn(
            'font-bold',
            diffBar >= 60 ? 'text-red-700' : diffBar >= 40 ? 'text-amber-700' : 'text-matcha-700',
          )}>
            {cur.difficultyScore}/100
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              diffBar >= 60 ? 'bg-red-500' : diffBar >= 40 ? 'bg-amber-400' : 'bg-matcha-500',
            )}
            style={{ width: `${diffBar}%` }}
          />
        </div>
      </div>

      {/* Stats Row */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {cur.windKmh != null && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Wind className="h-3 w-3" />
            {cur.windKmh.toFixed(0)} km/h
          </span>
        )}
        {cur.precipMm != null && cur.precipMm > 0 && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <CloudRain className="h-3 w-3" />
            {cur.precipMm.toFixed(1)} mm
          </span>
        )}
        <span className={cn(
          'ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 font-bold',
          isDanger ? 'bg-red-200 text-red-800' : isWarn ? 'bg-amber-200 text-amber-800' : 'bg-blue-200 text-blue-800',
        )}>
          ETA ×{cur.etaFactor.toFixed(1)}
        </span>
      </div>

      {/* Vehicle recommendation */}
      <div className={cn('flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold',
        isDanger ? 'bg-red-100 border-red-200' : isWarn ? 'bg-amber-100 border-amber-200' : 'bg-matcha-50 border-matcha-200',
      )}>
        <span className={rec.color}>{rec.icon}</span>
        <span className={rec.color}>{rec.label}</span>
      </div>

      {cur.alertMessage && (
        <p className="text-xs text-muted-foreground">{cur.alertMessage}</p>
      )}
    </div>
  );
}
