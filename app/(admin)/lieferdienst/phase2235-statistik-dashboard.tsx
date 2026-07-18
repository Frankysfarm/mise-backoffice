'use client';

import { useCallback, useEffect, useState } from 'react';
import { BarChart2, ChevronDown, ChevronUp, TrendingUp, Clock, Package, Euro, AlertTriangle } from 'lucide-react';

interface StundeData {
  stunde: number;
  bestellungen: number;
  umsatz: number;
}

interface TagesStats {
  bestellungen_gesamt: number;
  umsatz_gesamt: number;
  storno_count: number;
  avg_lieferzeit_min: number;
  puenktlichkeit_pct: number;
  stunden: StundeData[];
}

const MAX_BAR_H = 36;

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const h = max > 0 ? Math.round((value / max) * MAX_BAR_H) : 2;
  return (
    <div className="flex flex-col items-center gap-0.5" style={{ height: MAX_BAR_H + 16 }}>
      <div className="flex-1 flex items-end">
        <div
          className="w-5 rounded-t-sm transition-all"
          style={{ height: Math.max(2, h), backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function LieferdienstPhase2235StatistikDashboard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<TagesStats | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    try {
      const url = locationId
        ? `/api/delivery/admin/tages-statistiken?location_id=${locationId}`
        : '/api/delivery/admin/tages-statistiken';
      const res = await fetch(url);
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!data) return null;

  const stornoRate = data.bestellungen_gesamt > 0
    ? Math.round((data.storno_count / data.bestellungen_gesamt) * 100)
    : 0;
  const umsatzFmt = data.umsatz_gesamt.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const maxBestellungen = Math.max(...(data.stunden?.map((s) => s.bestellungen) ?? [1]), 1);

  const kpis = [
    {
      label: 'Bestellungen',
      value: data.bestellungen_gesamt.toString(),
      icon: Package,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      label: 'Umsatz heute',
      value: `${umsatzFmt} €`,
      icon: Euro,
      color: 'text-green-700 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-900/20',
    },
    {
      label: 'Ø Lieferzeit',
      value: `${data.avg_lieferzeit_min} Min`,
      icon: Clock,
      color: 'text-amber-700 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
    },
    {
      label: 'Pünktlichkeit',
      value: `${data.puenktlichkeit_pct}%`,
      icon: TrendingUp,
      color: data.puenktlichkeit_pct >= 80
        ? 'text-green-700 dark:text-green-400'
        : data.puenktlichkeit_pct >= 60
        ? 'text-yellow-700 dark:text-yellow-400'
        : 'text-red-600 dark:text-red-400',
      bg: 'bg-matcha-50 dark:bg-matcha-900/20',
    },
  ];

  const now = new Date().getHours();

  return (
    <div className="rounded-xl border border-matcha-200 dark:border-matcha-800 bg-matcha-50 dark:bg-matcha-950/20 p-4 mb-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-matcha-600 dark:text-matcha-400" />
          <span className="font-semibold text-matcha-900 dark:text-matcha-200">Tages-Statistik Dashboard</span>
          {stornoRate > 15 && (
            <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Storno {stornoRate}%
            </span>
          )}
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-matcha-600 dark:text-matcha-400" />
          : <ChevronDown className="w-4 h-4 text-matcha-600 dark:text-matcha-400" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* KPI Grid */}
          <div className="grid grid-cols-2 gap-2">
            {kpis.map((kpi) => (
              <div key={kpi.label} className={`rounded-xl ${kpi.bg} px-3 py-2.5`}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <kpi.icon className={`w-3 h-3 ${kpi.color}`} />
                  <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">{kpi.label}</span>
                </div>
                <div className={`text-base font-black tabular-nums ${kpi.color}`}>{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Storno rate pill */}
          <div className="flex items-center justify-between rounded-lg bg-white dark:bg-gray-800 px-3 py-2 text-sm">
            <span className="text-gray-600 dark:text-gray-400">Stornoquote</span>
            <span className={`font-bold ${
              stornoRate > 15 ? 'text-red-600' : stornoRate > 8 ? 'text-yellow-600' : 'text-green-600'
            }`}>
              {data.storno_count} Storno · {stornoRate}%
            </span>
          </div>

          {/* Hourly chart */}
          {data.stunden && data.stunden.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 px-1">
                Stündliche Bestellungen
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl px-3 py-2 overflow-x-auto">
                <div className="flex items-end gap-1 min-w-max">
                  {data.stunden.map((s) => (
                    <div key={s.stunde} className="flex flex-col items-center">
                      <MiniBar
                        value={s.bestellungen}
                        max={maxBestellungen}
                        color={s.stunde === now
                          ? '#4a7c59'
                          : s.bestellungen >= maxBestellungen * 0.8
                          ? '#f59e0b'
                          : '#86a896'}
                      />
                      <span className="text-[8px] text-gray-400 mt-0.5">{s.stunde}h</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <p className="text-xs text-matcha-600 dark:text-matcha-400 text-center">
            Heute ab 0:00 Uhr · alle 5 Min. aktualisiert
          </p>
        </div>
      )}
    </div>
  );
}
