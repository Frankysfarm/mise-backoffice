'use client';

/**
 * EtaAccuracyLive
 *
 * Live-Anzeige der ETA-Genauigkeit im Dispatch-Board.
 * Zeigt wie präzise die Lieferzeitschätzungen heute waren:
 * - Pünktlichkeitsrate (grün/gelb/rot)
 * - Durchschnittliche Abweichung in Minuten
 * - Zonen-Aufschlüsselung
 *
 * Holt Daten von /api/delivery/eta-accuracy alle 60s.
 */

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Target, TrendingUp, TrendingDown, Minus, RefreshCw, AlertTriangle } from 'lucide-react';

type ZoneData = {
  zone: string;
  vehicle: string;
  completedDeliveries: number;
  onTimeRate: number;
  avgErrorMin: number;
};

type AccuracyData = {
  overall: {
    completedDeliveries: number;
    onTimeRate: number;
    avgErrorMin: number;
  };
  byZone: ZoneData[];
  _fallback?: boolean;
};

function GaugeRing({ pct, size = 60, stroke = 6 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = pct >= 85 ? '#16a34a' : pct >= 70 ? '#f59e0b' : '#dc2626';

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#e5e7eb" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        stroke={color} strokeWidth={stroke} fill="none"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
    </svg>
  );
}

export function EtaAccuracyLive({ locationId: _locationId }: { locationId: string | null }) {
  const [data, setData] = useState<AccuracyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [expanded, setExpanded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = React.useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/eta-accuracy`, {
        signal: abortRef.current.signal,
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as AccuracyData;
      setData(json);
      setLastUpdate(new Date());
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        // Behalte alten State
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => {
      clearInterval(iv);
      abortRef.current?.abort();
    };
  }, [load]);

  if (!data) {
    return (
      <div className="rounded-xl border border-matcha-200 bg-matcha-50 px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Target className="h-4 w-4 text-matcha-500 shrink-0" />
        <span>ETA-Genauigkeit wird geladen…</span>
        <RefreshCw className={cn('h-3 w-3 ml-auto', loading && 'animate-spin')} />
      </div>
    );
  }

  const { overall } = data;
  const pct = Math.round(overall.onTimeRate * 100);
  const avgErr = overall.avgErrorMin;
  const isGood = pct >= 85;
  const isWarn = pct >= 70 && pct < 85;

  const headerColor = isGood
    ? 'border-matcha-300 bg-matcha-50'
    : isWarn
    ? 'border-amber-300 bg-amber-50'
    : 'border-red-300 bg-red-50';

  const rateColor = isGood ? 'text-matcha-700' : isWarn ? 'text-amber-700' : 'text-red-700';

  const TrendIcon = avgErr <= 2 ? TrendingUp : avgErr <= 5 ? Minus : TrendingDown;
  const trendColor = avgErr <= 2 ? 'text-matcha-600' : avgErr <= 5 ? 'text-amber-600' : 'text-red-600';

  // Top zones by delivery count
  const topZones = [...(data.byZone ?? [])]
    .filter((z) => z.completedDeliveries > 0)
    .sort((a, b) => b.completedDeliveries - a.completedDeliveries)
    .slice(0, 5);

  return (
    <div className={cn('rounded-xl border p-3 transition-all', headerColor)}>
      <button
        className="w-full flex items-center gap-3 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Gauge */}
        <div className="relative shrink-0">
          <GaugeRing pct={pct} size={52} stroke={5} />
          <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
            <span className={cn('text-[11px] font-black tabular-nums', rateColor)}>{pct}%</span>
          </div>
        </div>

        {/* Summary */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Target className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              ETA-Genauigkeit heute
            </span>
            {data._fallback && (
              <span className="rounded-full bg-amber-200 px-1.5 text-[9px] font-bold text-amber-800">Demo</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className={cn('font-bold', rateColor)}>
              {pct}% pünktlich
            </span>
            <span className="flex items-center gap-0.5 text-muted-foreground">
              <TrendIcon className={cn('h-3 w-3', trendColor)} />
              Ø {avgErr >= 0 ? '+' : ''}{avgErr.toFixed(1)} Min
            </span>
            <span className="text-muted-foreground">
              {overall.completedDeliveries} Lieferungen
            </span>
          </div>
        </div>

        {/* Status badge + refresh */}
        <div className="flex items-center gap-2 shrink-0">
          {!isGood && !isWarn && (
            <AlertTriangle className="h-4 w-4 text-red-500" />
          )}
          <span className={cn(
            'rounded-full px-2 py-0.5 text-[9px] font-black',
            isGood ? 'bg-matcha-200 text-matcha-800' :
            isWarn ? 'bg-amber-200 text-amber-800' :
            'bg-red-200 text-red-800',
          )}>
            {isGood ? 'Gut' : isWarn ? 'OK' : 'Verbesserung nötig'}
          </span>
          <RefreshCw
            className={cn('h-3 w-3 text-muted-foreground cursor-pointer hover:text-foreground', loading && 'animate-spin')}
            onClick={(e) => { e.stopPropagation(); load(); }}
          />
        </div>
      </button>

      {/* Expanded Zone Breakdown */}
      {expanded && topZones.length > 0 && (
        <div className="mt-3 border-t border-current/10 pt-3 space-y-1.5">
          <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Zonen-Aufschlüsselung
          </div>
          {topZones.map((z) => {
            const zonePct = Math.round(z.onTimeRate * 100);
            const zoneBar = isGood ? 'bg-matcha-500' : zonePct >= 70 ? 'bg-amber-400' : 'bg-red-500';
            return (
              <div key={`${z.zone}-${z.vehicle}`} className="flex items-center gap-2 text-[11px]">
                <span className="w-20 truncate font-medium text-foreground">{z.zone || 'Unbekannt'}</span>
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className={cn('h-full rounded-full', zoneBar)} style={{ width: `${zonePct}%` }} />
                </div>
                <span className={cn(
                  'w-10 text-right font-bold tabular-nums',
                  zonePct >= 85 ? 'text-matcha-700' : zonePct >= 70 ? 'text-amber-700' : 'text-red-700',
                )}>
                  {zonePct}%
                </span>
                <span className="w-12 text-right text-muted-foreground tabular-nums text-[9px]">
                  {z.completedDeliveries}×
                </span>
              </div>
            );
          })}
          {lastUpdate && (
            <div className="text-[9px] text-muted-foreground mt-1">
              Zuletzt: {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
