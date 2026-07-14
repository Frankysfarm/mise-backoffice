'use client';

import React, { useEffect, useState } from 'react';

interface KuechenDurchsatzData {
  stunden: { stunde: number; bestellungen: number; avgPrepMin: number }[];
  currentHour: number;
  totalToday: number;
  avgPrepMinToday: number;
  zielPrepMin: number;
  kapazitaetsStatus: 'gut' | 'normal' | 'kritisch';
}

const STATUS_CONFIG = {
  gut: { label: 'Gut', color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/30', border: 'border-green-200 dark:border-green-800' },
  normal: { label: 'Normal', color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-950/30', border: 'border-yellow-200 dark:border-yellow-800' },
  kritisch: { label: 'Kritisch', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800' },
};

export function DispatchPhase1529KuechenDurchsatzWidget() {
  const [data, setData] = useState<KuechenDurchsatzData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const load = async () => {
    try {
      const res = await fetch('/api/delivery/admin/kuechen-durchsatz');
      if (res.ok) {
        setData(await res.json());
        setLastUpdate(new Date());
      }
    } catch {}
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  if (!data) return (
    <div className="rounded-xl border border-border bg-card p-4 animate-pulse">
      <div className="h-4 w-40 bg-muted rounded mb-3" />
      <div className="h-16 bg-muted rounded" />
    </div>
  );

  const cfg = STATUS_CONFIG[data.kapazitaetsStatus];
  const maxBestellungen = Math.max(...data.stunden.map(s => s.bestellungen), 1);
  const last6 = data.stunden.filter(s => s.stunde >= Math.max(0, data.currentHour - 5) && s.stunde <= data.currentHour);
  const overTarget = data.avgPrepMinToday > data.zielPrepMin;

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Küchen-Durchsatz</h3>
        <span className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <div className="text-lg font-bold text-foreground">{data.totalToday}</div>
          <div className="text-[10px] text-muted-foreground">Bestellungen heute</div>
        </div>
        <div className="text-center">
          <div className={`text-lg font-bold ${overTarget ? 'text-red-600' : 'text-green-600'}`}>{data.avgPrepMinToday} Min</div>
          <div className="text-[10px] text-muted-foreground">Ø Zubereitung</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-foreground">{data.zielPrepMin} Min</div>
          <div className="text-[10px] text-muted-foreground">Ziel</div>
        </div>
      </div>

      {/* Stunden-Balken (letzte 6h) */}
      {last6.length > 0 && (
        <div>
          <div className="text-[10px] text-muted-foreground mb-1">Letzte Stunden</div>
          <div className="flex items-end gap-1 h-10">
            {last6.map(s => {
              const h = Math.max(2, Math.round((s.bestellungen / maxBestellungen) * 36));
              const isCurrent = s.stunde === data.currentHour;
              return (
                <div key={s.stunde} className="flex flex-col items-center flex-1">
                  <div
                    className={`w-full rounded-t ${isCurrent ? 'bg-blue-500' : 'bg-indigo-400'} opacity-80`}
                    style={{ height: `${h}px` }}
                  />
                  <span className="text-[9px] text-muted-foreground mt-0.5">{String(s.stunde).padStart(2, '0')}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Kapazitäts-Warnung */}
      {data.kapazitaetsStatus === 'kritisch' && (
        <div className="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/50 px-3 py-2">
          <p className="text-xs text-red-700 dark:text-red-400 font-medium">
            ⚠ Küche überlastet — Ø {data.avgPrepMinToday} Min (Ziel: {data.zielPrepMin} Min). Kapazität erhöhen oder Bestelleingang drosseln.
          </p>
        </div>
      )}

      {lastUpdate && (
        <div className="text-[10px] text-muted-foreground text-right">
          Aktualisiert {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
        </div>
      )}
    </div>
  );
}
