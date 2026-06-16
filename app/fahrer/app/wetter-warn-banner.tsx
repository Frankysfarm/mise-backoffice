'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CloudRain, Wind, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WeatherInfo {
  weatherDesc: string | null;
  tempC: number | null;
  windKmh: number | null;
  precipMm: number | null;
  etaFactor: number;
  isDangerous: boolean;
  alertMessage: string | null;
  difficultyScore: number;
}

export function FahrerWetterWarnBanner({ locationId }: { locationId: string | null }) {
  const [info, setInfo] = useState<WeatherInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    let mounted = true;

    async function load() {
      try {
        const res = await fetch(`/api/delivery/admin/weather-intelligence?action=dashboard&location_id=${locationId}`);
        if (!res.ok || !mounted) return;
        const json = await res.json();
        const cur = json.current;
        if (!cur || !mounted) return;
        setInfo({
          weatherDesc: cur.weatherDesc,
          tempC: cur.tempC,
          windKmh: cur.windKmh,
          precipMm: cur.precipMm,
          etaFactor: cur.etaFactor,
          isDangerous: cur.isDangerous,
          alertMessage: cur.alertMessage,
          difficultyScore: cur.difficultyScore,
        });
        // Reset dismissal on new dangerous condition
        if (cur.isDangerous) setDismissed(false);
      } catch { /* ignore */ }
    }

    load();
    const iv = setInterval(load, 15 * 60_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [locationId]);

  if (!info || dismissed) return null;
  // Only show when meaningful
  if (info.difficultyScore < 25 && !info.isDangerous) return null;

  const isDanger = info.isDangerous;
  const isWarn = !isDanger && info.difficultyScore >= 40;

  return (
    <div className={cn(
      'relative rounded-xl border p-3 text-sm',
      isDanger
        ? 'bg-red-50 border-red-200 text-red-800'
        : isWarn
        ? 'bg-amber-50 border-amber-200 text-amber-800'
        : 'bg-blue-50 border-blue-200 text-blue-800',
    )}>
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-2 top-2 rounded-md p-0.5 opacity-60 hover:opacity-100"
        aria-label="Schließen"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="flex items-start gap-2 pr-6">
        <div className={cn(
          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
          isDanger ? 'bg-red-100' : isWarn ? 'bg-amber-100' : 'bg-blue-100',
        )}>
          {isDanger
            ? <AlertTriangle className="h-4 w-4" />
            : <CloudRain className="h-4 w-4" />
          }
        </div>

        <div className="flex-1 space-y-1">
          <div className="font-bold leading-tight">
            {isDanger ? '⚠ Achtung: Gefährliche Wetterlage!' : '🌦 Schlechtes Wetter — Vorsicht!'}
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs opacity-90">
            {info.weatherDesc && <span>{info.weatherDesc}</span>}
            {info.tempC != null && <span>{info.tempC.toFixed(0)} °C</span>}
            {info.windKmh != null && info.windKmh > 15 && (
              <span className="flex items-center gap-1">
                <Wind className="h-3 w-3" />
                {info.windKmh.toFixed(0)} km/h Wind
              </span>
            )}
            {info.precipMm != null && info.precipMm > 0 && (
              <span className="flex items-center gap-1">
                <CloudRain className="h-3 w-3" />
                {info.precipMm.toFixed(1)} mm
              </span>
            )}
          </div>

          {info.alertMessage && (
            <p className="text-xs font-medium leading-tight">{info.alertMessage}</p>
          )}

          <div className="text-xs font-semibold">
            Lieferzeit-Faktor: ×{info.etaFactor.toFixed(1)} — bitte vorsichtig fahren
          </div>
        </div>
      </div>
    </div>
  );
}
