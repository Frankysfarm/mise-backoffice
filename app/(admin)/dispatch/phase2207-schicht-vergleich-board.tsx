'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingDown, TrendingUp, Minus, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

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

function TrendIcon({ trend, pct }: { trend: 'hoch' | 'runter' | 'gleich'; pct: number }) {
  if (trend === 'hoch') return <span className="flex items-center gap-0.5 text-green-600"><TrendingUp className="w-3 h-3" /><span className="text-xs font-bold">+{pct.toFixed(1)}%</span></span>;
  if (trend === 'runter') return <span className="flex items-center gap-0.5 text-red-500"><TrendingDown className="w-3 h-3" /><span className="text-xs font-bold">{pct.toFixed(1)}%</span></span>;
  return <span className="flex items-center gap-0.5 text-gray-400"><Minus className="w-3 h-3" /><span className="text-xs">±0%</span></span>;
}

function Sparkline({ heute, gestern, avg7 }: { heute: number; gestern: number; avg7: number }) {
  const max = Math.max(heute, gestern, avg7, 1);
  const bars = [
    { val: avg7,   label: '7d-Ø', color: 'bg-gray-300 dark:bg-gray-600' },
    { val: gestern, label: 'Gst.',  color: 'bg-blue-300 dark:bg-blue-700' },
    { val: heute,   label: 'Heute', color: 'bg-green-400 dark:bg-green-600' },
  ];
  return (
    <div className="flex items-end gap-1 h-10">
      {bars.map(({ val, label, color }) => (
        <div key={label} className="flex flex-col items-center gap-0.5 flex-1">
          <div
            className={cn('w-full rounded-t', color)}
            style={{ height: `${Math.round((val / max) * 32)}px`, minHeight: 2 }}
          />
          <span className="text-[9px] text-gray-400 leading-none">{label}</span>
        </div>
      ))}
    </div>
  );
}

export function DispatchPhase2207SchichtVergleichBoard({
  locationId,
}: {
  locationId: string | null;
}) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    try {
      const url = locationId
        ? `/api/delivery/admin/schicht-vergleich?location_id=${locationId}`
        : '/api/delivery/admin/schicht-vergleich';
      const res = await fetch(url);
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!data) return null;

  const hasAlert = data.einnahmen.alert || data.stopps.alert || data.km.alert;

  const kpis = [
    { label: 'Einnahmen', metrik: data.einnahmen, fmt: (v: number) => v.toFixed(2).replace('.', ',') + ' €' },
    { label: 'Stopps',    metrik: data.stopps,    fmt: (v: number) => String(Math.round(v)) },
    { label: 'km',        metrik: data.km,        fmt: (v: number) => v.toFixed(1) + ' km' },
  ];

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <span>Schicht-Vergleich: Heute vs. Gestern</span>
        <div className="flex items-center gap-2">
          {hasAlert && <AlertTriangle className="w-4 h-4 text-red-500" />}
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {hasAlert && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                Leistungsrückgang &gt;15% vs. gestern — bitte prüfen!
              </p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {kpis.map(({ label, metrik, fmt }) => (
              <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 space-y-1">
                <div className="text-xs text-gray-500 font-medium">{label}</div>
                <div className={cn(
                  'text-sm font-bold',
                  metrik.alert ? 'text-red-600' : 'text-gray-800 dark:text-gray-100'
                )}>
                  {fmt(metrik.heute)}
                </div>
                <Sparkline heute={metrik.heute} gestern={metrik.gestern} avg7={metrik.avg7} />
                <div className="flex justify-between items-center mt-1">
                  <TrendIcon trend={metrik.trend_gestern} pct={metrik.delta_gestern_pct} />
                  <span className="text-[9px] text-gray-400">vs. Gst.</span>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-400 text-right">
            Aktualisiert: {new Date(data.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      )}
    </div>
  );
}
