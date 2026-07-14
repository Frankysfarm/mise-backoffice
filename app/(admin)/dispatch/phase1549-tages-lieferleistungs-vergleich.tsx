'use client';

import React, { useEffect, useState } from 'react';

interface TagesMetrik {
  name: string;
  heute: number;
  gestern: number;
  einheit: string;
  trend: 'besser' | 'gleich' | 'schlechter';
  delta: number;
  hoeherIstBesser: boolean;
}

interface ApiData {
  metriken: TagesMetrik[];
  gesamt_trend: 'besser' | 'gleich' | 'schlechter';
  datum_heute: string;
}

interface Props {
  locationId?: string | null;
}

const TREND_STYLE = {
  besser: { text: 'text-green-600 dark:text-green-400', arrow: '↑', bg: 'bg-green-100 dark:bg-green-900/30' },
  gleich: { text: 'text-muted-foreground', arrow: '→', bg: 'bg-muted/50' },
  schlechter: { text: 'text-red-600 dark:text-red-400', arrow: '↓', bg: 'bg-red-100 dark:bg-red-900/30' },
};

const GESAMT_STYLE = {
  besser: 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30',
  gleich: 'border-border bg-muted/20',
  schlechter: 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30',
};

export function DispatchPhase1549TagesLieferleistungsVergleich({ locationId }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (locationId) params.set('location_id', locationId);
      const res = await fetch(`/api/delivery/admin/tages-lieferleistung?${params}`);
      if (res.ok) setData(await res.json());
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (loading) return (
    <div className="rounded-xl border border-border bg-card p-4 animate-pulse">
      <div className="h-4 w-56 bg-muted rounded mb-3" />
      <div className="grid grid-cols-2 gap-2">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-muted rounded" />)}
      </div>
    </div>
  );
  if (!data) return null;

  const gesamt = data.gesamt_trend;
  const label = gesamt === 'besser' ? '📈 Besser als gestern' : gesamt === 'schlechter' ? '📉 Schlechter als gestern' : '➡ Gleich wie gestern';

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${GESAMT_STYLE[gesamt]}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <h3 className="text-sm font-semibold">Tages-Lieferleistung</h3>
        </div>
        <span className={`text-[11px] font-semibold ${TREND_STYLE[gesamt].text}`}>{label}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {data.metriken.map(m => {
          const ts = TREND_STYLE[m.trend];
          const deltaStr = m.delta > 0 ? `+${m.delta}` : String(m.delta);
          return (
            <div key={m.name} className="rounded-lg border border-border bg-card/80 p-3 space-y-1">
              <div className="text-[11px] text-muted-foreground font-medium">{m.name}</div>
              <div className="flex items-end gap-1">
                <span className="text-lg font-bold font-mono">{m.heute}{m.einheit}</span>
                <span className={`text-xs font-semibold pb-0.5 ${ts.text}`}>
                  {ts.arrow} {deltaStr}{m.einheit}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground">Gestern: {m.gestern}{m.einheit}</span>
                <span className={`text-[10px] font-semibold px-1 py-0.5 rounded ${ts.bg} ${ts.text}`}>
                  {m.trend === 'besser' ? 'Besser' : m.trend === 'schlechter' ? 'Schlechter' : 'Gleich'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground text-right">
        Daten für {data.datum_heute} · 10 Min Polling
      </p>
    </div>
  );
}
