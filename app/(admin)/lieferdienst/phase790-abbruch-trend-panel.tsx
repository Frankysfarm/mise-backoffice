'use client';

import { useEffect, useState } from 'react';
import { TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WochentagTrend {
  wd: number;
  label: string;
  gesamt: number;
  storniert: number;
  quote: number;
}

interface StundeTrend {
  h: number;
  label: string;
  gesamt: number;
  storniert: number;
  quote: number;
}

interface Hotspot {
  wdLabel: string;
  stunde: string;
  quote: number;
  gesamt: number;
}

interface ApiResponse {
  ok: boolean;
  nachWochentag: WochentagTrend[];
  nachStunde: StundeTrend[];
  hotspot: Hotspot | null;
  gesamtQuote: number;
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

function quoteColor(quote: number): string {
  if (quote >= 20) return 'bg-red-500';
  if (quote >= 10) return 'bg-amber-500';
  return 'bg-matcha-500';
}

function quoteTextColor(quote: number): string {
  if (quote >= 20) return 'text-red-600 dark:text-red-400';
  if (quote >= 10) return 'text-amber-600 dark:text-amber-400';
  return 'text-matcha-700 dark:text-matcha-400';
}

export function LieferdienstPhase790AbbruchTrendPanel({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);

  useEffect(() => {
    if (!locationId) return;
    let active = true;

    async function load() {
      try {
        const res = await fetch(
          `/api/delivery/admin/bestellungs-abbruch-trend?location_id=${locationId}`
        );
        if (!res.ok) return;
        const json = await res.json();
        if (active && json.ok) setData(json);
      } catch {}
    }

    load();
    const id = setInterval(load, 300_000); // 5-Min-Polling (ändert sich langsam)
    return () => { active = false; clearInterval(id); };
  }, [locationId]);

  if (!data || data.nachWochentag.length === 0) return null;

  const maxQuoteWd = Math.max(...data.nachWochentag.map(w => w.quote), 1);
  // Show top 6 hours by volume for the bar chart
  const topStunden = [...data.nachStunde]
    .filter(s => s.gesamt >= 3)
    .sort((a, b) => b.quote - a.quote)
    .slice(0, 6);
  const maxQuoteH = Math.max(...topStunden.map(s => s.quote), 1);

  return (
    <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-100 dark:border-stone-800">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400">
          <TrendingDown className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-black uppercase tracking-wide text-stone-700 dark:text-stone-200">
            Abbruch-Trend-Analyse
          </div>
          <div className="text-[10px] text-stone-400 dark:text-stone-500">
            Stornierungsrate je Wochentag + Stunde · 4 Wochen
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className={cn('text-sm font-black tabular-nums', quoteTextColor(data.gesamtQuote))}>
            {data.gesamtQuote}%
          </div>
          <div className="text-[9px] text-stone-400">Gesamt-Ø</div>
        </div>
      </div>

      {/* Hotspot alert */}
      {data.hotspot && data.hotspot.quote >= 15 && (
        <div className="mx-4 mt-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 px-3 py-2">
          <div className="text-[10px] font-bold text-red-700 dark:text-red-400">
            ⚠ Hotspot: {data.hotspot.wdLabel} {data.hotspot.stunde} — {data.hotspot.quote}% Storno ({data.hotspot.gesamt} Best.)
          </div>
        </div>
      )}

      {/* Wochentag-Bars */}
      <div className="px-4 pt-3 pb-1">
        <div className="text-[9px] font-semibold uppercase tracking-wide text-stone-400 mb-1.5">Nach Wochentag</div>
        <div className="space-y-1">
          {data.nachWochentag.map((w) => (
            <div key={w.wd} className="flex items-center gap-2">
              <span className="w-6 text-[10px] text-stone-500 dark:text-stone-400 shrink-0">{w.label}</span>
              <div className="flex-1 h-2 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', quoteColor(w.quote))}
                  style={{ width: `${(w.quote / maxQuoteWd) * 100}%` }}
                />
              </div>
              <span className={cn('w-10 text-right text-[10px] font-bold tabular-nums shrink-0', quoteTextColor(w.quote))}>
                {w.quote}%
              </span>
              <span className="text-[9px] text-stone-400 shrink-0 w-10 text-right tabular-nums">
                {w.gesamt} Best.
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Stunden-Bars (Top 6 by storno rate) */}
      {topStunden.length > 0 && (
        <div className="px-4 pt-2 pb-3">
          <div className="text-[9px] font-semibold uppercase tracking-wide text-stone-400 mb-1.5">Nach Stunde (Top-Storno)</div>
          <div className="space-y-1">
            {topStunden.map((s) => (
              <div key={s.h} className="flex items-center gap-2">
                <span className="w-10 text-[10px] text-stone-500 dark:text-stone-400 shrink-0">{s.label}</span>
                <div className="flex-1 h-2 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', quoteColor(s.quote))}
                    style={{ width: `${(s.quote / maxQuoteH) * 100}%` }}
                  />
                </div>
                <span className={cn('w-10 text-right text-[10px] font-bold tabular-nums shrink-0', quoteTextColor(s.quote))}>
                  {s.quote}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
