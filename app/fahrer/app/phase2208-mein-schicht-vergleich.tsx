'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Metrik {
  heute: number;
  gestern: number;
  avg7: number;
  trend_gestern: 'hoch' | 'runter' | 'gleich';
  delta_gestern_pct: number;
  alert: boolean;
}

interface ApiData {
  einnahmen: Metrik;
  stopps: Metrik;
  km: Metrik;
}

function TrendRow({ trend, pct }: { trend: 'hoch' | 'runter' | 'gleich'; pct: number }) {
  if (trend === 'hoch') return (
    <span className="flex items-center gap-1 text-green-600 text-xs font-bold">
      <TrendingUp className="w-3 h-3" />+{pct.toFixed(1)}% vs. gestern
    </span>
  );
  if (trend === 'runter') return (
    <span className="flex items-center gap-1 text-red-500 text-xs font-bold">
      <TrendingDown className="w-3 h-3" />{pct.toFixed(1)}% vs. gestern
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-gray-400 text-xs">
      <Minus className="w-3 h-3" />Gleich wie gestern
    </span>
  );
}

function tipp(einnahmenTrend: 'hoch' | 'runter' | 'gleich'): string {
  if (einnahmenTrend === 'hoch') return '🚀 Starker Tag! Weiter so — du bist besser als gestern.';
  if (einnahmenTrend === 'runter') return '💡 Heute etwas weniger als gestern. Stopp-Effizienz prüfen?';
  return '📊 Stabile Leistung — konstant ist gut!';
}

export function FahrerPhase2208MeinSchichtVergleich({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/schicht-vergleich?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ }
  }, [locationId, driverId]);

  useEffect(() => {
    if (!isOnline) return;
    load();
    const id = setInterval(load, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [load, isOnline]);

  if (!isOnline || !data) return null;

  const rows = [
    { label: 'Einnahmen', metrik: data.einnahmen, fmt: (v: number) => v.toFixed(2).replace('.', ',') + ' €' },
    { label: 'Stopps',    metrik: data.stopps,    fmt: (v: number) => String(Math.round(v)) },
    { label: 'Strecke',   metrik: data.km,        fmt: (v: number) => v.toFixed(1) + ' km' },
  ];

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
      >
        <span>Mein Schicht-Vergleich</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Heute vs. Gestern Δ-Kacheln */}
          <div className="grid grid-cols-3 gap-2">
            {rows.map(({ label, metrik, fmt }) => (
              <div key={label} className={cn(
                'rounded-lg px-3 py-2 text-center',
                metrik.alert
                  ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                  : 'bg-gray-50 dark:bg-gray-800'
              )}>
                <div className="text-xs text-gray-500 mb-0.5">{label}</div>
                <div className={cn(
                  'text-sm font-bold',
                  metrik.alert ? 'text-red-600' : 'text-gray-800 dark:text-gray-100'
                )}>
                  {fmt(metrik.heute)}
                </div>
                <div className="text-[10px] text-gray-400">
                  Gst: {fmt(metrik.gestern)}
                </div>
                <div className="mt-1">
                  <TrendRow trend={metrik.trend_gestern} pct={metrik.delta_gestern_pct} />
                </div>
              </div>
            ))}
          </div>

          {/* Motivations-Tipp */}
          <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-3 py-2">
            <p className="text-xs text-blue-700 dark:text-blue-300">{tipp(data.einnahmen.trend_gestern)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
