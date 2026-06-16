'use client';

import { useEffect, useState } from 'react';
import { CloudRain, Wind, Thermometer, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WeatherDashboard {
  current: {
    tempC: number | null;
    precipMm: number | null;
    windKmh: number | null;
    weatherDesc: string | null;
    difficultyScore: number;
    etaFactor: number;
    demandImpact: number;
    isDangerous: boolean;
    alertMessage: string | null;
    capturedAt: string;
  } | null;
  minutesAgo: number | null;
}

function DemandIcon({ impact }: { impact: number }) {
  if (impact >= 1.1) return <TrendingUp className="h-4 w-4 text-matcha-600" />;
  if (impact <= 0.9) return <TrendingDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function diffColor(score: number) {
  if (score >= 60) return 'text-red-700 bg-red-100';
  if (score >= 40) return 'text-amber-700 bg-amber-100';
  return 'text-matcha-700 bg-matcha-100';
}

export function WetterKpiKarte({ locationId }: { locationId: string }) {
  const [data, setData] = useState<WeatherDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const res = await fetch(`/api/delivery/admin/weather-intelligence?action=dashboard&location_id=${locationId}`);
        if (!res.ok || !mounted) return;
        const json = await res.json();
        if (mounted) { setData(json); setLoading(false); }
      } catch { if (mounted) setLoading(false); }
    }

    load();
    const iv = setInterval(load, 10 * 60_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [locationId]);

  const cur = data?.current;

  return (
    <div className="rounded-2xl border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
          <CloudRain className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-bold">Wetter-Einfluss</div>
          {data?.minutesAgo != null && (
            <div className="text-[10px] text-muted-foreground">vor {data.minutesAgo} Min aktualisiert</div>
          )}
        </div>
        {cur?.isDangerous && (
          <div className="ml-auto flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
            <AlertTriangle className="h-3 w-3" />
            Gefährlich
          </div>
        )}
      </div>

      {loading && (
        <div className="text-sm text-muted-foreground">Lade Wetterdaten…</div>
      )}

      {!loading && !cur && (
        <div className="text-sm text-muted-foreground">Keine Wetterdaten verfügbar.</div>
      )}

      {cur && (
        <>
          {/* Condition row */}
          <div className="flex items-center gap-2 text-sm">
            {cur.weatherDesc && (
              <span className="font-medium">{cur.weatherDesc}</span>
            )}
            {cur.tempC != null && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Thermometer className="h-3.5 w-3.5" />
                {cur.tempC.toFixed(0)} °C
              </span>
            )}
            {cur.windKmh != null && cur.windKmh > 10 && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Wind className="h-3.5 w-3.5" />
                {cur.windKmh.toFixed(0)} km/h
              </span>
            )}
          </div>

          {/* KPI chips */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-muted/60 p-2 text-center">
              <div className="text-[10px] text-muted-foreground font-medium uppercase">Schwierigkeit</div>
              <div className={cn('mt-0.5 rounded-full px-2 py-0.5 text-xs font-black inline-block', diffColor(cur.difficultyScore))}>
                {cur.difficultyScore}/100
              </div>
            </div>
            <div className="rounded-lg bg-muted/60 p-2 text-center">
              <div className="text-[10px] text-muted-foreground font-medium uppercase">ETA-Faktor</div>
              <div className={cn(
                'mt-0.5 text-sm font-black',
                cur.etaFactor > 1.2 ? 'text-red-700' : cur.etaFactor > 1.05 ? 'text-amber-700' : 'text-matcha-700',
              )}>
                ×{cur.etaFactor.toFixed(2)}
              </div>
            </div>
            <div className="rounded-lg bg-muted/60 p-2 text-center">
              <div className="text-[10px] text-muted-foreground font-medium uppercase">Nachfrage</div>
              <div className="mt-0.5 flex items-center justify-center gap-1">
                <DemandIcon impact={cur.demandImpact} />
                <span className={cn(
                  'text-sm font-black',
                  cur.demandImpact >= 1.1 ? 'text-matcha-700' : cur.demandImpact <= 0.9 ? 'text-red-600' : 'text-muted-foreground',
                )}>
                  {(cur.demandImpact >= 1 ? '+' : '') + ((cur.demandImpact - 1) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>

          {/* Difficulty bar */}
          <div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  cur.difficultyScore >= 60 ? 'bg-red-500' : cur.difficultyScore >= 40 ? 'bg-amber-400' : 'bg-matcha-500',
                )}
                style={{ width: `${Math.min(100, cur.difficultyScore)}%` }}
              />
            </div>
          </div>

          {cur.alertMessage && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800 font-medium">
              {cur.alertMessage}
            </div>
          )}
        </>
      )}
    </div>
  );
}
