'use client';

/**
 * Phase 556 Storefront — Wetter-Verzögerungshinweis
 *
 * Automatischer Banner im Erfolgs-Screen wenn schlechtes Wetter erwartet wird
 * und Lieferzeit erhöht ist.
 *
 * 3-Level: keine Anzeige / leichte Verzögerung / starke Verzögerung
 */

import { useEffect, useState } from 'react';
import { CloudRain, CloudSnow, Wind, CloudLightning, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WeatherInfo {
  etaFactor: number;
  difficultyScore: number;
  weatherDesc: string | null;
  precipMm: number | null;
  windKmh: number | null;
  isDangerous: boolean;
  alertMessage: string | null;
}

type Level = 'none' | 'leicht' | 'stark';

interface Props {
  locationId: string;
  etaMin?: number | null;
}

function levelFromInfo(info: WeatherInfo): Level {
  if (info.isDangerous || info.etaFactor >= 1.25) return 'stark';
  if (info.etaFactor >= 1.08 || info.difficultyScore >= 40) return 'leicht';
  return 'none';
}

function extraMin(etaFactor: number, baseMin: number): number {
  return Math.max(0, Math.round((etaFactor - 1) * baseMin));
}

function WeatherIcon({ desc, size = 16 }: { desc: string | null; size?: number }) {
  const d = (desc ?? '').toLowerCase();
  if (d.includes('schnee') || d.includes('eis')) return <CloudSnow size={size} />;
  if (d.includes('gewitter'))                      return <CloudLightning size={size} />;
  if (d.includes('wind'))                          return <Wind size={size} />;
  return <CloudRain size={size} />;
}

const LEVEL_CFG = {
  leicht: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    iconBg: 'bg-amber-100 text-amber-600',
    heading: 'text-amber-800',
    body: 'text-amber-700',
    sub: 'text-amber-600',
    label: 'Leichte Wetterbedingte Verzögerung',
  },
  stark: {
    bg: 'bg-red-50',
    border: 'border-red-300',
    iconBg: 'bg-red-100 text-red-600',
    heading: 'text-red-800',
    body: 'text-red-700',
    sub: 'text-red-600',
    label: 'Schlechtwetterwarnung',
  },
};

export function WetterVerzoegerungshinweis({ locationId, etaMin }: Props) {
  const [info, setInfo] = useState<WeatherInfo | null>(null);

  useEffect(() => {
    if (!locationId) return;
    let mounted = true;

    async function load() {
      try {
        const res = await fetch(
          `/api/delivery/admin/weather-intelligence?action=dashboard&location_id=${locationId}`
        );
        if (!res.ok || !mounted) return;
        const json = await res.json();
        const cur = json.current;
        if (!cur || !mounted) return;
        setInfo({
          etaFactor:      cur.etaFactor      ?? 1.0,
          difficultyScore: cur.difficultyScore ?? 0,
          weatherDesc:    cur.weatherDesc    ?? null,
          precipMm:       cur.precipMm       ?? null,
          windKmh:        cur.windKmh        ?? null,
          isDangerous:    cur.isDangerous    ?? false,
          alertMessage:   cur.alertMessage   ?? null,
        });
      } catch { /* ignore */ }
    }

    load();
    const iv = setInterval(load, 10 * 60_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [locationId]);

  if (!info) return null;
  const level = levelFromInfo(info);
  if (level === 'none') return null;

  const cfg  = LEVEL_CFG[level];
  const base = etaMin ?? 30;
  const xtra = extraMin(info.etaFactor, base);

  return (
    <div className={cn('flex items-start gap-3 rounded-xl border px-4 py-3 text-sm', cfg.bg, cfg.border)}>
      <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', cfg.iconBg)}>
        {level === 'stark'
          ? <AlertTriangle size={16} />
          : <WeatherIcon desc={info.weatherDesc} />
        }
      </div>
      <div className="flex-1">
        <div className={cn('font-semibold', cfg.heading)}>{cfg.label}</div>
        <div className={cn('mt-1', cfg.body)}>
          {info.weatherDesc ? `${info.weatherDesc}. ` : ''}
          {xtra > 0
            ? `Deine Lieferzeit kann sich um ca. ${xtra} Min verlängern.`
            : 'Lieferzeiten können sich wetterbedingt verlängern.'}
        </div>
        {info.alertMessage && (
          <div className={cn('mt-1 text-xs font-medium', cfg.sub)}>
            {info.alertMessage}
          </div>
        )}
        <div className={cn('mt-2 flex items-center gap-1 text-xs', cfg.sub)}>
          <Clock size={11} />
          Wir halten dich auf dem Laufenden.
        </div>
      </div>
      {info.windKmh && info.windKmh > 30 && (
        <div className="shrink-0 text-right">
          <div className={cn('font-mono text-xs font-bold tabular-nums', cfg.heading)}>
            {Math.round(info.windKmh)} km/h
          </div>
          <div className="text-[9px] text-muted-foreground">Wind</div>
        </div>
      )}
    </div>
  );
}
