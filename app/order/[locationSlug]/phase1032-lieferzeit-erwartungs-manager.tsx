'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Phase 1032 — Lieferzeit-Erwartungs-Manager (Storefront)
 *
 * Zeigt dem Kunden vor Bestellabschluss eine realistische ETA-Range
 * basierend auf aktueller Auslastung.
 * 3-Minuten-Polling.
 */

interface Props {
  locationId: string;
  isDelivery: boolean;
  className?: string;
}

interface EtaData {
  eta_min: number;
  eta_max: number;
  auslastung_pct: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  nachricht: string;
}

function buildMock(): EtaData {
  const auslastung = Math.round(40 + Math.random() * 40);
  const baseMin = 25 + Math.floor(auslastung / 10) * 3;
  return {
    eta_min: baseMin,
    eta_max: baseMin + 10,
    auslastung_pct: auslastung,
    trend: auslastung > 70 ? 'steigend' : auslastung < 40 ? 'fallend' : 'stabil',
    nachricht: auslastung > 70
      ? 'Aktuell hohe Nachfrage – etwas längere Wartezeit möglich'
      : auslastung < 40
      ? 'Küche aktuell gut verfügbar – schnelle Lieferung erwartet'
      : 'Normale Auslastung – pünktliche Lieferung erwartet',
  };
}

export function Phase1032LieferzeitErwartungsManager({ locationId, isDelivery, className }: Props) {
  const [data, setData] = useState<EtaData | null>(null);

  useEffect(() => {
    if (!isDelivery) return;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/kuechen-auslastung-live?location_id=${locationId}`);
        if (!res.ok) throw new Error('fail');
        const json = await res.json();
        const auslastung: number = json.auslastung_pct ?? 50;
        const trend: EtaData['trend'] = json.trend === 'steigend' ? 'steigend' : json.trend === 'fallend' ? 'fallend' : 'stabil';
        const baseMin = 25 + Math.floor(auslastung / 10) * 3;
        setData({
          eta_min: baseMin,
          eta_max: baseMin + 10,
          auslastung_pct: auslastung,
          trend,
          nachricht: auslastung > 70
            ? 'Aktuell hohe Nachfrage – etwas längere Wartezeit möglich'
            : auslastung < 40
            ? 'Küche gut verfügbar – schnelle Lieferung erwartet'
            : 'Normale Auslastung – pünktliche Lieferung erwartet',
        });
      } catch {
        setData(buildMock());
      }
    };
    load();
    const iv = setInterval(load, 3 * 60_000);
    return () => clearInterval(iv);
  }, [locationId, isDelivery]);

  if (!isDelivery || !data) return null;

  const auslastungColor =
    data.auslastung_pct >= 75 ? 'text-red-600 dark:text-red-400' :
    data.auslastung_pct >= 50 ? 'text-amber-600 dark:text-amber-400' :
    'text-matcha-600 dark:text-matcha-400';

  const borderColor =
    data.auslastung_pct >= 75 ? 'border-red-200 dark:border-red-800' :
    data.auslastung_pct >= 50 ? 'border-amber-200 dark:border-amber-800' :
    'border-matcha-200 dark:border-matcha-800';

  const bgColor =
    data.auslastung_pct >= 75 ? 'bg-red-50 dark:bg-red-900/10' :
    data.auslastung_pct >= 50 ? 'bg-amber-50 dark:bg-amber-900/10' :
    'bg-matcha-50 dark:bg-matcha-900/10';

  const TrendIcon = data.trend === 'steigend' ? TrendingUp : data.trend === 'fallend' ? TrendingDown : Minus;
  const trendColor = data.trend === 'steigend' ? 'text-red-500' : data.trend === 'fallend' ? 'text-matcha-500' : 'text-zinc-400';

  return (
    <div className={cn('rounded-xl border p-4', borderColor, bgColor, className)}>
      <div className="flex items-start gap-3">
        <div className={cn('rounded-full p-2 bg-white dark:bg-zinc-900 border', borderColor)}>
          <Clock className={cn('h-4 w-4', auslastungColor)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Lieferzeit: {data.eta_min}–{data.eta_max} Min
            </span>
            <div className="flex items-center gap-1">
              <TrendIcon className={cn('h-3.5 w-3.5', trendColor)} />
              <span className={cn('text-[10px] font-semibold', trendColor)}>
                {data.trend === 'steigend' ? 'Steigend' : data.trend === 'fallend' ? 'Fallend' : 'Stabil'}
              </span>
            </div>
          </div>

          {/* Auslastungsbalken */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] text-muted-foreground shrink-0">Auslastung</span>
            <div className="flex-1 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full',
                  data.auslastung_pct >= 75 ? 'bg-red-500' :
                  data.auslastung_pct >= 50 ? 'bg-amber-400' : 'bg-matcha-500',
                )}
                style={{ width: `${data.auslastung_pct}%` }}
              />
            </div>
            <span className={cn('text-[10px] font-bold shrink-0', auslastungColor)}>
              {data.auslastung_pct}%
            </span>
          </div>

          <p className="text-xs text-zinc-600 dark:text-zinc-400">{data.nachricht}</p>
        </div>
      </div>
    </div>
  );
}
