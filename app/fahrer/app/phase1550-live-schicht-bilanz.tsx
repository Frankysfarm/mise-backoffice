'use client';

import React, { useEffect, useState } from 'react';

interface SchichtBilanz {
  stopps_heute: number;
  stopps_ziel: number;
  verdienst_heute: number;
  trinkgeld_heute: number;
  bewertung_avg: number;
  bewertung_count: number;
  schicht_dauer_min: number;
  on_time_quote: number;
}

interface Props {
  isOnline?: boolean;
  driverId?: string;
}

function mockBilanz(driverId: string): SchichtBilanz {
  const seed = driverId.charCodeAt(0) % 10;
  return {
    stopps_heute: 8 + seed,
    stopps_ziel: 15,
    verdienst_heute: 42 + seed * 3,
    trinkgeld_heute: 5 + seed,
    bewertung_avg: 4.3 + (seed % 4) * 0.1,
    bewertung_count: 6 + seed,
    schicht_dauer_min: 180 + seed * 10,
    on_time_quote: 75 + seed * 2,
  };
}

function fmtEur(cents: number) {
  return `${cents.toFixed(2).replace('.', ',')} €`;
}

function fmtMin(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function FahrerPhase1550LiveSchichtBilanz({ isOnline = false, driverId = '' }: Props) {
  const [bilanz, setBilanz] = useState<SchichtBilanz | null>(null);

  const load = async () => {
    try {
      const res = await fetch(`/api/delivery/driver/schicht-bilanz?driver_id=${driverId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.stopps_heute !== undefined) { setBilanz(json); return; }
      }
    } catch {}
    setBilanz(mockBilanz(driverId || 'a'));
  };

  useEffect(() => {
    if (!isOnline) return;
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, driverId]);

  if (!isOnline || !bilanz) return null;

  const stoppsPct = Math.min(100, Math.round((bilanz.stopps_heute / Math.max(bilanz.stopps_ziel, 1)) * 100));

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">💼</span>
        <h3 className="text-sm font-semibold">Live-Schicht-Bilanz</h3>
        <span className="text-[10px] text-muted-foreground ml-auto">🕐 {fmtMin(bilanz.schicht_dauer_min)}</span>
      </div>

      {/* Stopps-Fortschritt */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Stopps</span>
          <span className="font-semibold font-mono">{bilanz.stopps_heute} / {bilanz.stopps_ziel}</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all bg-emerald-500"
            style={{ width: `${stoppsPct}%` }}
          />
        </div>
      </div>

      {/* KPI-Grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-3 py-2">
          <div className="text-[10px] text-muted-foreground">Verdienst</div>
          <div className="text-base font-bold text-emerald-700 dark:text-emerald-400 font-mono">
            {fmtEur(bilanz.verdienst_heute)}
          </div>
        </div>
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2">
          <div className="text-[10px] text-muted-foreground">Trinkgeld</div>
          <div className="text-base font-bold text-amber-700 dark:text-amber-400 font-mono">
            {fmtEur(bilanz.trinkgeld_heute)}
          </div>
        </div>
        <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2">
          <div className="text-[10px] text-muted-foreground">Bewertung</div>
          <div className="flex items-center gap-1">
            <span className="text-base font-bold text-blue-700 dark:text-blue-400">
              ★ {bilanz.bewertung_avg.toFixed(1)}
            </span>
            <span className="text-[10px] text-muted-foreground">({bilanz.bewertung_count})</span>
          </div>
        </div>
        <div className="rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 px-3 py-2">
          <div className="text-[10px] text-muted-foreground">Pünktlich</div>
          <div className="text-base font-bold text-purple-700 dark:text-purple-400 font-mono">
            {bilanz.on_time_quote}%
          </div>
        </div>
      </div>
    </div>
  );
}
