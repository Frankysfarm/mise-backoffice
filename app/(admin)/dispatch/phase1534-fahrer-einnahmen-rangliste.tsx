'use client';

import React, { useEffect, useState } from 'react';

interface FahrerEinnahmen {
  fahrer_id: string;
  name: string;
  verdienst_heute_cents: number;
  trinkgeld_cents: number;
  stopps_heute: number;
  trend_7d: 'steigend' | 'stabil' | 'fallend';
  verdienst_7d_cents: number[];
}

interface ApiData {
  fahrer: FahrerEinnahmen[];
  generiert_um: string;
}

const TREND_ICON: Record<string, string> = {
  steigend: '↑',
  stabil: '→',
  fallend: '↓',
};
const TREND_COLOR: Record<string, string> = {
  steigend: 'text-green-600 dark:text-green-400',
  stabil: 'text-muted-foreground',
  fallend: 'text-red-600 dark:text-red-400',
};

function formatEur(cents: number) {
  return (cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function DispatchPhase1534FahrerEinnahmenRangliste() {
  const [data, setData] = useState<ApiData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const load = async () => {
    try {
      const res = await fetch('/api/delivery/admin/fahrer-einnahmen');
      if (res.ok) {
        setData(await res.json());
        setLastUpdate(new Date());
      }
    } catch {}
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  if (!data) return (
    <div className="rounded-xl border border-border bg-card p-4 animate-pulse">
      <div className="h-4 w-44 bg-muted rounded mb-3" />
      <div className="space-y-2">
        {[1, 2, 3].map(i => <div key={i} className="h-10 bg-muted rounded" />)}
      </div>
    </div>
  );

  const maxVerdienst = Math.max(...data.fahrer.map(f => f.verdienst_heute_cents), 1);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Fahrer-Einnahmen Heute</h3>
        {lastUpdate && (
          <span className="text-[10px] text-muted-foreground">
            {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
          </span>
        )}
      </div>

      <div className="space-y-2">
        {data.fahrer.map((f, idx) => {
          const pct = Math.round((f.verdienst_heute_cents / maxVerdienst) * 100);
          const trinkgeldPct = f.verdienst_heute_cents > 0
            ? Math.round((f.trinkgeld_cents / f.verdienst_heute_cents) * 100)
            : 0;
          const rankColor = idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-gray-400' : idx === 2 ? 'text-amber-600' : 'text-muted-foreground';

          return (
            <div key={f.fahrer_id} className="rounded-lg bg-muted/40 p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${rankColor}`}>#{idx + 1}</span>
                  <span className="text-sm font-medium text-foreground">{f.name}</span>
                  <span className={`text-xs font-bold ${TREND_COLOR[f.trend_7d]}`}>
                    {TREND_ICON[f.trend_7d]}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-right">
                  <div>
                    <div className="text-sm font-bold text-foreground">{formatEur(f.verdienst_heute_cents)} €</div>
                    <div className="text-[10px] text-muted-foreground">{f.stopps_heute} Stopps</div>
                  </div>
                </div>
              </div>

              {/* Verdienst-Balken */}
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-500"
                  style={{ width: `${pct}%` }}
                />
              </div>

              {/* Trinkgeld-Balken */}
              {f.trinkgeld_cents > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground w-12 flex-shrink-0">Trinkgeld</span>
                  <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-green-400"
                      style={{ width: `${Math.min(trinkgeldPct, 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">
                    {formatEur(f.trinkgeld_cents)} € ({trinkgeldPct}%)
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
