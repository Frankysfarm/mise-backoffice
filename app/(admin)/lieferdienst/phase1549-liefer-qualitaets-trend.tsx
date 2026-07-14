'use client';

import React, { useEffect, useState } from 'react';

interface TagesMetrik {
  name: string;
  heute: number;
  gestern: number;
  einheit: string;
  trend: 'besser' | 'gleich' | 'schlechter';
  delta: number;
}

interface ApiData {
  metriken: TagesMetrik[];
  gesamt_trend: 'besser' | 'gleich' | 'schlechter';
  datum_heute: string;
}

interface Props {
  locationId?: string | null;
}

const TREND_ICON = { besser: '↑', gleich: '→', schlechter: '↓' };
const TREND_COLOR = {
  besser: 'text-green-600 dark:text-green-400',
  gleich: 'text-muted-foreground',
  schlechter: 'text-red-600 dark:text-red-400',
};

export function LieferdienstPhase1549LieferQualitaetsTrend({ locationId }: Props) {
  const [data, setData] = useState<ApiData | null>(null);

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (locationId) params.set('location_id', locationId);
      const res = await fetch(`/api/delivery/admin/tages-lieferleistung?${params}`);
      if (res.ok) setData(await res.json());
    } catch {}
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data) return null;

  const gesamt = data.gesamt_trend;
  const gesamtLabel = gesamt === 'besser' ? '📈 Besser' : gesamt === 'schlechter' ? '📉 Schlechter' : '➡ Stabil';

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <h3 className="text-sm font-semibold">Liefer-Qualität: Heute vs. Gestern</h3>
        </div>
        <span className={`text-xs font-bold ${TREND_COLOR[gesamt]}`}>{gesamtLabel}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {data.metriken.map(m => (
          <div key={m.name} className="rounded-lg bg-muted/30 border border-border p-3 space-y-1">
            <div className="text-[10px] text-muted-foreground">{m.name}</div>
            <div className={`text-lg font-bold font-mono ${TREND_COLOR[m.trend]}`}>
              {m.heute}{m.einheit}
            </div>
            <div className={`text-[11px] font-semibold ${TREND_COLOR[m.trend]}`}>
              {TREND_ICON[m.trend]} {m.delta > 0 ? '+' : ''}{m.delta}{m.einheit} vs. gestern
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">Daten für {data.datum_heute} · 5 Min Polling</p>
    </div>
  );
}
