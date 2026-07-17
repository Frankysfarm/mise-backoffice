'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingDown, TrendingUp, Minus, AlertTriangle } from 'lucide-react';

interface Metrik {
  heute: number;
  gestern: number;
  avg7: number;
  trend_gestern: 'hoch' | 'runter' | 'gleich';
  delta_gestern_pct: number;
  delta_avg7_pct: number;
  alert: boolean;
}

interface ApiData {
  einnahmen: Metrik;
  stopps: Metrik;
  km: Metrik;
  generiert_am: string;
}

function TrendIcon({ trend }: { trend: 'hoch' | 'runter' | 'gleich' }) {
  if (trend === 'hoch') return <TrendingUp className="w-4 h-4 text-green-500" />;
  if (trend === 'runter') return <TrendingDown className="w-4 h-4 text-red-500" />;
  return <Minus className="w-4 h-4 text-gray-400" />;
}

export function KitchenPhase2210SchichtTrendMonitor({
  locationId,
}: {
  locationId?: string | null;
}) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/schicht-vergleich?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const kritisch = useMemo(() => data?.einnahmen.alert ?? false, [data]);

  if (!data) return null;

  const rows = [
    {
      label: 'Einnahmen heute',
      value: data.einnahmen.heute.toFixed(2).replace('.', ',') + ' €',
      gestern: data.einnahmen.gestern.toFixed(2).replace('.', ',') + ' €',
      avg7: data.einnahmen.avg7.toFixed(2).replace('.', ',') + ' €',
      trend: data.einnahmen.trend_gestern,
      pct: data.einnahmen.delta_gestern_pct,
      alert: data.einnahmen.alert,
    },
    {
      label: 'Stopps heute',
      value: String(Math.round(data.stopps.heute)),
      gestern: String(Math.round(data.stopps.gestern)),
      avg7: data.stopps.avg7.toFixed(1),
      trend: data.stopps.trend_gestern,
      pct: data.stopps.delta_gestern_pct,
      alert: data.stopps.alert,
    },
    {
      label: 'Strecke heute',
      value: data.km.heute.toFixed(1) + ' km',
      gestern: data.km.gestern.toFixed(1) + ' km',
      avg7: data.km.avg7.toFixed(1) + ' km',
      trend: data.km.trend_gestern,
      pct: data.km.delta_gestern_pct,
      alert: data.km.alert,
    },
  ];

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <span>Schicht-Trend-Monitor</span>
        <div className="flex items-center gap-2">
          {kritisch && <AlertTriangle className="w-4 h-4 text-red-500" />}
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {kritisch && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                Einnahmen -15% vs. gestern — Dispatcher informieren!
              </p>
            </div>
          )}

          <div className="space-y-2">
            {rows.map((r) => (
              <div
                key={r.label}
                className={`rounded-lg px-3 py-2 ${r.alert ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700' : 'bg-gray-50 dark:bg-gray-800'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">{r.label}</span>
                  <div className="flex items-center gap-1">
                    <TrendIcon trend={r.trend} />
                    <span className={`text-xs font-bold ${r.pct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {r.pct >= 0 ? '+' : ''}{r.pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-gray-800 dark:text-gray-100">{r.value}</span>
                  <span className="text-gray-400">Gst: {r.gestern} · 7d-Ø: {r.avg7}</span>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-400 text-right">
            Stand: {new Date(data.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      )}
    </div>
  );
}
