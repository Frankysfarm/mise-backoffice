'use client';

import React, { useCallback, useEffect, useState } from 'react';

interface TourPrognose {
  driverId: string;
  driverName: string | null;
  driverVehicle: 'bike' | 'car';
  batchId: string | null;
  minutesUntilReturn: number;
  remainingStops: number;
  totalStops: number;
  confidence: number;
  residualCapacity: number;
  urgency: 'soon' | 'coming' | 'later';
}

interface ApiResponse {
  ok: boolean;
  prognosen: TourPrognose[];
  activeDrivers: number;
  returningWithin15Min: number;
  returningWithin30Min: number;
  avgMinutesUntilReturn: number;
}

const POLL_MS = 5 * 60 * 1000;

function KonfidenzBalken({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums w-7">{pct}%</span>
    </div>
  );
}

function UrgencyBadge({ urgency }: { urgency: TourPrognose['urgency'] }) {
  if (urgency === 'soon')   return <span className="rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 text-[10px] font-bold px-1.5 py-0.5">Gleich</span>;
  if (urgency === 'coming') return <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-[10px] font-bold px-1.5 py-0.5">Bald</span>;
  return <span className="rounded-full bg-muted text-muted-foreground text-[10px] font-bold px-1.5 py-0.5">Später</span>;
}

export function DispatchPhase1554FahrerRueckkehrPrognoseWidget() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/delivery/admin/fahrer-rueckkehr-prognose');
      if (res.ok) {
        const json = await res.json();
        if (json.ok) {
          setData(json);
          setLastUpdate(new Date());
          setError(false);
        } else {
          setError(true);
        }
      }
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-bold text-foreground">🔄 Fahrer-Rückkehr-Prognose</h3>
        {lastUpdate && (
          <span className="text-[10px] text-muted-foreground">
            {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {!data && !error && (
        <p className="text-xs text-muted-foreground animate-pulse">Lade Prognosen…</p>
      )}
      {error && (
        <p className="text-xs text-red-500">Fehler beim Laden.</p>
      )}

      {data && (
        <>
          {/* KPI-Zeile */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-muted/50 px-2 py-1.5 text-center">
              <p className="text-lg font-black tabular-nums text-foreground">{data.activeDrivers}</p>
              <p className="text-[10px] text-muted-foreground">Aktiv</p>
            </div>
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 px-2 py-1.5 text-center">
              <p className="text-lg font-black tabular-nums text-amber-700 dark:text-amber-400">{data.returningWithin15Min}</p>
              <p className="text-[10px] text-muted-foreground">≤15 Min</p>
            </div>
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1.5 text-center">
              <p className="text-lg font-black tabular-nums text-emerald-700 dark:text-emerald-400">{data.returningWithin30Min}</p>
              <p className="text-[10px] text-muted-foreground">≤30 Min</p>
            </div>
          </div>

          {/* Fahrer-Liste */}
          {data.prognosen.length === 0 ? (
            <p className="text-xs text-muted-foreground">Keine aktiven Touren.</p>
          ) : (
            <div className="space-y-2">
              {data.prognosen.map(p => (
                <div
                  key={p.driverId}
                  className="rounded-lg border border-border bg-muted/30 px-3 py-2 space-y-1.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{p.driverVehicle === 'bike' ? '🚴' : '🚗'}</span>
                    <span className="text-xs font-semibold text-foreground flex-1 truncate">
                      {p.driverName ?? 'Fahrer'}
                    </span>
                    <UrgencyBadge urgency={p.urgency} />
                    <span className="text-sm font-black tabular-nums text-foreground ml-1">
                      {p.minutesUntilReturn} Min
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                    <span>Stopps: {p.totalStops - p.remainingStops}/{p.totalStops}</span>
                    <span>+{p.residualCapacity} Kapazität</span>
                  </div>
                  <KonfidenzBalken value={p.confidence} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
