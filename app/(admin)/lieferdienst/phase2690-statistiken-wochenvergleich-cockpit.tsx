'use client';
import { useEffect, useState } from 'react';
import { BarChart3, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KpiRow {
  label: string;
  unit: string;
  current: number;
  last: number;
  invertedTrend: boolean; // true = lower is better (Lieferzeit, Storno)
}

interface ApiData {
  kpis: KpiRow[];
  week_label_current: string;
  week_label_last: string;
}

const MOCK: ApiData = {
  week_label_current: 'KW 29 (diese Woche)',
  week_label_last: 'KW 28 (letzte Woche)',
  kpis: [
    { label: 'Bestellungen',    unit: '',    current: 312,  last: 287,  invertedTrend: false },
    { label: 'Umsatz',          unit: '€',   current: 8430, last: 7910, invertedTrend: false },
    { label: 'Ø Lieferzeit',    unit: 'min', current: 28,   last: 31,   invertedTrend: true  },
    { label: 'Pünktlichkeit',   unit: '%',   current: 84,   last: 79,   invertedTrend: false },
    { label: 'Ø Bewertung',     unit: '★',   current: 4.6,  last: 4.4,  invertedTrend: false },
    { label: 'Aktive Fahrer',   unit: '',    current: 9,    last: 8,    invertedTrend: false },
    { label: 'Storno-Quote',    unit: '%',   current: 3.1,  last: 4.2,  invertedTrend: true  },
    { label: 'SLA-Rate',        unit: '%',   current: 91,   last: 88,   invertedTrend: false },
  ],
};

function deltaPct(current: number, last: number): number {
  if (last === 0) return 0;
  return Math.round(((current - last) / last) * 1000) / 10;
}

export function LieferdienstPhase2690StatistikenWochenvergleichCockpit({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!locationId) { setData(MOCK); return; }
      try {
        const res = await fetch(`/api/delivery/admin/statistiken-wochenvergleich?location_id=${locationId}`);
        if (res.ok && active) setData(await res.json());
      } catch {
        if (active) setData(MOCK);
      }
    };
    load();
    const iv = setInterval(load, 5 * 60 * 1000);
    return () => { active = false; clearInterval(iv); };
  }, [locationId]);

  const d = data ?? MOCK;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-indigo-600" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">
            Wochen-Vergleich Cockpit
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
            {d.week_label_current}
          </span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span className="font-semibold text-indigo-600">Diese Woche</span>
            <span>vs.</span>
            <span>{d.week_label_last}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {d.kpis.map(kpi => {
              const pct = deltaPct(kpi.current, kpi.last);
              const improved = kpi.invertedTrend ? pct < 0 : pct > 0;
              const neutral = pct === 0;
              const colorClass = neutral
                ? 'text-gray-500 dark:text-gray-400'
                : improved
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400';
              const bgClass = neutral
                ? 'bg-gray-50 dark:bg-gray-800'
                : improved
                ? 'bg-green-50 dark:bg-green-900/20'
                : 'bg-red-50 dark:bg-red-900/20';

              return (
                <div key={kpi.label} className={`rounded-lg p-2.5 ${bgClass}`}>
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-medium truncate mb-1">{kpi.label}</div>
                  <div className="font-bold text-base text-gray-800 dark:text-gray-100 tabular-nums">
                    {kpi.current}{kpi.unit}
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
                    Vorw.: {kpi.last}{kpi.unit}
                  </div>
                  <div className={`flex items-center gap-0.5 text-xs font-semibold mt-1 ${colorClass}`}>
                    {neutral
                      ? <Minus size={11} />
                      : improved
                      ? <TrendingUp size={11} />
                      : <TrendingDown size={11} />}
                    {pct > 0 ? '+' : ''}{pct}%
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-1 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400 text-right">
            Aktualisiert alle 5 Min.
          </div>
        </div>
      )}
    </div>
  );
}
