'use client';

import React, { useEffect, useState } from 'react';

interface TrinkgeldData {
  heute_cents: number;
  stopps_heute: number;
  avg_pro_stopp_cents: number;
  vorwoche_heute_cents: number;
}

interface Props {
  isOnline?: boolean;
  driverId?: string;
}

function formatEur(cents: number) {
  return (cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function FahrerPhase1535TrinkgeldTracker({ isOnline = false, driverId }: Props) {
  const [data, setData] = useState<TrinkgeldData | null>(null);

  const load = async () => {
    try {
      const url = driverId
        ? `/api/delivery/driver/trinkgeld?driver_id=${encodeURIComponent(driverId)}`
        : '/api/delivery/driver/trinkgeld';
      const res = await fetch(url);
      if (res.ok) setData(await res.json());
    } catch {}
  };

  useEffect(() => {
    if (!isOnline) return;
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [isOnline, driverId]);

  if (!isOnline || !data) return null;

  const delta = data.heute_cents - data.vorwoche_heute_cents;
  const deltaPositive = delta >= 0;
  const deltaPct = data.vorwoche_heute_cents > 0
    ? Math.round(Math.abs(delta) / data.vorwoche_heute_cents * 100)
    : 0;

  return (
    <div className="rounded-xl border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xl">💚</span>
        <h3 className="text-sm font-semibold text-green-800 dark:text-green-300">Trinkgeld Heute</h3>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-white/70 dark:bg-black/20 p-2.5 text-center">
          <div className="text-xl font-bold text-green-700 dark:text-green-400">{formatEur(data.heute_cents)} €</div>
          <div className="text-[10px] text-muted-foreground">Gesamt heute</div>
        </div>
        <div className="rounded-lg bg-white/70 dark:bg-black/20 p-2.5 text-center">
          <div className="text-xl font-bold text-foreground">{formatEur(data.avg_pro_stopp_cents)} €</div>
          <div className="text-[10px] text-muted-foreground">Ø je Stopp</div>
        </div>
        <div className="rounded-lg bg-white/70 dark:bg-black/20 p-2.5 text-center">
          <div className="text-xl font-bold text-foreground">{data.stopps_heute}</div>
          <div className="text-[10px] text-muted-foreground">Stopps</div>
        </div>
      </div>

      {data.vorwoche_heute_cents > 0 && (
        <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium
          ${deltaPositive
            ? 'bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-400'
            : 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400'}`}
        >
          <span>{deltaPositive ? '↑' : '↓'}</span>
          <span>
            {deltaPositive ? '+' : '-'}{formatEur(Math.abs(delta))} € ({deltaPct}%) vs. gleicher Tag Vorwoche
          </span>
        </div>
      )}
    </div>
  );
}
