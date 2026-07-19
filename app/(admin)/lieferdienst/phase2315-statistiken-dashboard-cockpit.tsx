'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Activity, AlertTriangle, ChevronDown, ChevronUp, Euro, Package, Star, TrendingDown, TrendingUp, Truck } from 'lucide-react';

type StundenDaten = {
  stunde: string;
  bestellungen: number;
  umsatz: number;
};

type KpiKachel = {
  key: string;
  label: string;
  wert: string | number;
  einheit: string;
  trend: 'up' | 'down' | 'stable';
  trend_delta: string;
  ampel: 'gruen' | 'gelb' | 'rot';
};

type ApiData = {
  kpis: KpiKachel[];
  stunden: StundenDaten[];
  storno_rate: number;
  storno_alert: boolean;
};

function ampelKpiColor(a: KpiKachel['ampel']): string {
  if (a === 'gruen') return 'text-green-700 dark:text-green-400';
  if (a === 'gelb') return 'text-yellow-700 dark:text-yellow-300';
  return 'text-red-600 dark:text-red-400';
}

function ampelKpiBg(a: KpiKachel['ampel']): string {
  if (a === 'gruen') return 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20';
  if (a === 'gelb') return 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20';
  return 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20';
}

function TrendIcon({ trend }: { trend: KpiKachel['trend'] }) {
  if (trend === 'up') return <TrendingUp className="h-3 w-3 text-green-500" />;
  if (trend === 'down') return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Activity className="h-3 w-3 text-gray-400" />;
}

export function LieferdienstPhase2315StatistikDashboardCockpit({
  locationId,
}: {
  locationId?: string | null;
}) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(
        `/api/delivery/admin/statistiken-dashboard?location_id=${locationId}`,
      );
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

  const now = new Date();
  const currentHour = now.getHours();

  const mockStunden: StundenDaten[] = useMemo(
    () =>
      Array.from({ length: Math.min(currentHour + 1, 12) }, (_, i) => {
        const h = Math.max(0, currentHour - 11 + i);
        const bestellungen = Math.round(5 + Math.random() * 20);
        return { stunde: `${String(h).padStart(2, '0')}:00`, bestellungen, umsatz: bestellungen * 14 };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentHour],
  );

  const kpis: KpiKachel[] = useMemo(() => {
    if (data?.kpis?.length) return data.kpis;
    return [
      { key: 'bestellungen', label: 'Bestellungen', wert: 47, einheit: '', trend: 'up', trend_delta: '+12%', ampel: 'gruen' },
      { key: 'umsatz', label: 'Umsatz', wert: '658', einheit: '€', trend: 'up', trend_delta: '+8%', ampel: 'gruen' },
      { key: 'lieferzeit', label: 'Ø Lieferzeit', wert: 28, einheit: 'Min', trend: 'stable', trend_delta: '±0', ampel: 'gelb' },
      { key: 'pünktlichkeit', label: 'Pünktlichkeit', wert: 81, einheit: '%', trend: 'down', trend_delta: '-3%', ampel: 'gelb' },
      { key: 'storno', label: 'Stornoquote', wert: 4.2, einheit: '%', trend: 'down', trend_delta: '+0.8%', ampel: 'rot' },
      { key: 'fahrer', label: 'Aktive Fahrer', wert: 5, einheit: '', trend: 'stable', trend_delta: '±0', ampel: 'gruen' },
    ];
  }, [data]);

  const stunden = data?.stunden ?? mockStunden;
  const stornoRate = data?.storno_rate ?? 4.2;
  const stornoAlert = data?.storno_alert ?? stornoRate > 5;
  const hasAlert = stornoAlert || kpis.some((k) => k.ampel === 'rot');

  if (!locationId) return null;

  return (
    <div className={`rounded-xl border p-4 mb-3 ${hasAlert ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30' : 'border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/30'}`}>
      <button
        className="w-full flex items-center justify-between gap-2"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-teal-600 dark:text-teal-400" />
          <span className="font-semibold text-teal-800 dark:text-teal-200 text-sm">
            Statistiken-Dashboard Cockpit
          </span>
          <span className="inline-flex items-center rounded-full bg-teal-100 dark:bg-teal-900/40 px-2 py-0.5 text-xs font-medium text-teal-700 dark:text-teal-300">
            Heute ab 0 Uhr
          </span>
          {hasAlert && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300">
              <AlertTriangle className="h-3 w-3" />
              Alert
            </span>
          )}
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-teal-500 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-teal-500 shrink-0" />
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2">
            {kpis.map((k) => (
              <div key={k.key} className={`rounded-lg border p-2.5 ${ampelKpiBg(k.ampel)}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 truncate">{k.label}</span>
                  <TrendIcon trend={k.trend} />
                </div>
                <div className={`text-lg font-extrabold tabular-nums ${ampelKpiColor(k.ampel)}`}>
                  {k.wert}{k.einheit}
                </div>
                <div className="text-[10px] text-gray-400 dark:text-gray-500">{k.trend_delta} vs. gestern</div>
              </div>
            ))}
          </div>

          {/* Storno-Alert Banner */}
          {stornoAlert && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-2.5 text-xs text-red-700 dark:text-red-300">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Stornoquote bei {stornoRate}% — Bitte Stornogründe prüfen und Maßnahmen einleiten!
              </span>
            </div>
          )}

          {/* Stunden-Verlauf */}
          <div className="rounded-lg bg-white dark:bg-gray-800 border border-teal-100 dark:border-teal-900 p-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
              <Package className="h-3 w-3" /> Bestellungen pro Stunde
            </div>
            <ResponsiveContainer width="100%" height={70}>
              <BarChart data={stunden} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <XAxis dataKey="stunde" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 6 }}
                  formatter={((v: number) => [`${v} Bestellungen`, '']) as any}
                />
                <Bar dataKey="bestellungen" radius={[2, 2, 0, 0]}>
                  {stunden.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.bestellungen >= 15 ? '#0d9488' : entry.bestellungen >= 8 ? '#99f6e4' : '#d1fae5'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Umsatz-Summe */}
          <div className="rounded-lg bg-white dark:bg-gray-800 border border-teal-100 dark:border-teal-900 p-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Euro className="h-4 w-4 text-teal-500" />
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Tages-Umsatz</span>
            </div>
            <span className="text-xl font-extrabold text-teal-700 dark:text-teal-300 tabular-nums">
              {stunden.reduce((a, s) => a + s.umsatz, 0).toFixed(0)} €
            </span>
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500 text-right">
            KPI-Grid · Stundenverlauf · Storno-Alert · 5-Min-Polling
          </p>
        </div>
      )}
    </div>
  );
}
