'use client';

import { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StundePrognose {
  h: number;
  label: string;
  istHeute: number | null;
  avgHistorisch: number;
}

interface ApiResponse {
  ok: boolean;
  heuteBisher: number;
  prognoseRestlich: number;
  prognoseGesamt: number;
  verbleibendeStunden: number;
  currentHour: number;
  schichtEnde: number;
  stundenPrognose: StundePrognose[];
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

export function KitchenPhase791BestellungsVolumenHochrechnung({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);

  useEffect(() => {
    if (!locationId) return;
    let active = true;

    async function load() {
      try {
        const res = await fetch(
          `/api/delivery/admin/bestellungs-volumen-hochrechnung?location_id=${locationId}`
        );
        if (!res.ok) return;
        const json = await res.json();
        if (active && json.ok) setData(json);
      } catch {}
    }

    load();
    const id = setInterval(load, 60_000);
    return () => { active = false; clearInterval(id); };
  }, [locationId]);

  if (!data) return null;

  const { heuteBisher, prognoseRestlich, prognoseGesamt, verbleibendeStunden, currentHour, stundenPrognose } = data;
  const maxVal = Math.max(...stundenPrognose.map(s => Math.max(s.istHeute ?? 0, s.avgHistorisch)), 1);

  // Only show hours from shift start (6:00) to shift end
  const sichtbar = stundenPrognose.filter(s => s.h >= 6);

  return (
    <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-100 dark:border-stone-800">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400">
          <TrendingUp className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-black uppercase tracking-wide text-stone-700 dark:text-stone-200">
            Volumen-Hochrechnung
          </div>
          <div className="text-[10px] text-stone-400 dark:text-stone-500">
            Prognose bis Schichtende · 1 Min Polling
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-black tabular-nums text-stone-700 dark:text-stone-200">
            ~{prognoseGesamt}
          </div>
          <div className="text-[9px] text-stone-400">Gesamt erwartet</div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 divide-x divide-stone-100 dark:divide-stone-800 border-b border-stone-100 dark:border-stone-800">
        <div className="px-3 py-2 text-center">
          <div className="text-sm font-black tabular-nums text-stone-800 dark:text-stone-100">{heuteBisher}</div>
          <div className="text-[9px] text-stone-400 uppercase tracking-wide">bisher heute</div>
        </div>
        <div className="px-3 py-2 text-center">
          <div className="text-sm font-black tabular-nums text-sky-600 dark:text-sky-400">+{prognoseRestlich}</div>
          <div className="text-[9px] text-stone-400 uppercase tracking-wide">erwartet noch</div>
        </div>
        <div className="px-3 py-2 text-center">
          <div className="text-sm font-black tabular-nums text-stone-800 dark:text-stone-100">{verbleibendeStunden}h</div>
          <div className="text-[9px] text-stone-400 uppercase tracking-wide">bis Schichtende</div>
        </div>
      </div>

      {/* Stunden-Bars */}
      <div className="px-4 py-3">
        <div className="flex items-end gap-1 h-16">
          {sichtbar.map((s) => {
            const isCurrent = s.h === currentHour;
            const isFuture = s.h > currentHour;
            const barVal = isFuture ? s.avgHistorisch : (s.istHeute ?? 0);
            const pct = (barVal / maxVal) * 100;

            return (
              <div key={s.h} className="flex-1 flex flex-col items-center gap-0.5">
                <div
                  className={cn(
                    'w-full rounded-sm transition-all duration-500',
                    isCurrent
                      ? 'bg-sky-500'
                      : isFuture
                        ? 'bg-sky-200 dark:bg-sky-800 opacity-70'
                        : 'bg-matcha-500',
                  )}
                  style={{ height: `${Math.max(pct, 4)}%` }}
                  title={`${s.label}: ${barVal.toFixed(1)}`}
                />
                {s.h % 3 === 0 && (
                  <span className="text-[8px] text-stone-400 tabular-nums leading-none">{s.h}</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 flex items-center gap-3 text-[9px] text-stone-400">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-matcha-500 inline-block" />
            Ist heute
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-sky-500 inline-block" />
            Aktuell
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-sky-200 dark:bg-sky-800 inline-block" />
            Prognose (Ø 7d)
          </span>
        </div>
      </div>
    </div>
  );
}
