'use client';

import React, { useEffect, useState } from 'react';

interface ZoneBelastung {
  zone: string;
  aktive_fahrer: number;
  wartende_bestellungen: number;
  avg_wartezeit_min: number;
  status: 'überlastet' | 'normal' | 'frei';
}

interface ApiData {
  zonen: ZoneBelastung[];
  generiert_um: string;
}

const STATUS_STYLE: Record<string, string> = {
  überlastet: 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30',
  normal: 'border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950/30',
  frei: 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30',
};

const STATUS_BADGE: Record<string, string> = {
  überlastet: 'bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-300',
  normal: 'bg-yellow-200 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300',
  frei: 'bg-green-200 dark:bg-green-900/50 text-green-800 dark:text-green-300',
};

export function DispatchPhase1539ZonenBelastungsMonitor() {
  const [data, setData] = useState<ApiData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const load = async () => {
    try {
      const res = await fetch('/api/delivery/admin/zonen-belastung');
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
      <div className="h-4 w-44 bg-muted rounded mb-3" />
      <div className="grid grid-cols-2 gap-2">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-muted rounded" />)}
      </div>
    </div>
  );

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🗺</span>
          <h3 className="text-sm font-semibold">Zonen-Belastung</h3>
        </div>
        {lastUpdate && (
          <span className="text-[10px] text-muted-foreground">
            {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {data.zonen.map(z => (
          <div key={z.zone} className={`rounded-lg border p-3 space-y-1.5 ${STATUS_STYLE[z.status]}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">Zone {z.zone}</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_BADGE[z.status]}`}>
                {z.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[11px]">
              <div>
                <div className="font-semibold">{z.aktive_fahrer}</div>
                <div className="text-muted-foreground">Fahrer aktiv</div>
              </div>
              <div>
                <div className="font-semibold">{z.wartende_bestellungen}</div>
                <div className="text-muted-foreground">Wartend</div>
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground">
              Ø Wartezeit: <span className="font-semibold text-foreground">{z.avg_wartezeit_min} Min</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
