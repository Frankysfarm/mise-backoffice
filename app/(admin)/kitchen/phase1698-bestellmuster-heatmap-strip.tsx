'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { BarChart2, RefreshCw, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Phase 1698 — Bestellmuster-Heatmap-Strip (Kitchen)
 *
 * Ruft /api/delivery/admin/bestellmuster-analyse auf.
 * Zeigt Top-5 Spitzenzeiten + 7×24 Mini-Grid mit Farbintensität + Heute-Markierung; 60-Min-Polling.
 */

interface SpitzenZeit {
  rang: number;
  wochentag: number;
  stunde: number;
  wochentag_label: string;
  stunde_label: string;
  anzahl: number;
  anzahl_vorwoche: number;
  trend: 'steigend' | 'stabil' | 'fallend';
}

interface ApiData {
  top5: SpitzenZeit[];
  peak_wochentag: number;
  peak_wochentag_label: string;
  peak_stunde: number;
  peak_stunde_label: string;
  peak_anzahl: number;
  gesamt_diese_woche: number;
  gesamt_vorwoche: number;
  woche_trend: 'steigend' | 'stabil' | 'fallend';
  woche_delta_pct: number;
}

interface Props {
  locationId: string | null;
}

const POLL_MS = 60 * 60 * 1000;

const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
// Show hours 8–22 in the mini grid to save space
const GRID_HOURS = Array.from({ length: 15 }, (_, i) => i + 8);

const TREND_ICON = {
  steigend: <TrendingUp  className="h-3 w-3 text-matcha-500" />,
  stabil:   <Minus       className="h-3 w-3 text-amber-500" />,
  fallend:  <TrendingDown className="h-3 w-3 text-red-500" />,
};

const TREND_COLOR = {
  steigend: 'text-matcha-600 dark:text-matcha-400',
  stabil:   'text-amber-600 dark:text-amber-400',
  fallend:  'text-red-600 dark:text-red-400',
};

function intensitaetClass(idx: number, maxIdx: number): string {
  if (maxIdx === 0 || idx === 0) return 'bg-muted/30';
  const pct = idx / maxIdx;
  if (pct <= 0.15) return 'bg-matcha-100 dark:bg-matcha-900';
  if (pct <= 0.40) return 'bg-matcha-300 dark:bg-matcha-700';
  if (pct <= 0.75) return 'bg-matcha-500 dark:bg-matcha-500';
  return 'bg-matcha-700 dark:bg-matcha-300';
}

export function KitchenPhase1698BestellmusterHeatmapStrip({ locationId }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/bestellmuster-analyse?location_id=${encodeURIComponent(locationId)}`);
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, POLL_MS);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  // Build lookup map for the mini grid: {dow}-{hour} -> anzahl
  const gridLookup = useMemo(() => {
    if (!data) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const s of data.top5) {
      map.set(`${s.wochentag}-${s.stunde}`, s.anzahl);
    }
    return map;
  }, [data]);

  // Max value for intensity scaling
  const maxVal = useMemo(() => {
    if (!data?.top5.length) return 0;
    return data.top5[0].anzahl;
  }, [data]);

  // Today's day-of-week (0=Mo … 6=So)
  const todayDow = useMemo(() => (new Date().getDay() + 6) % 7, []);
  const currentHour = useMemo(() => new Date().getHours(), []);

  if (!locationId) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-3 mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left"
      >
        <BarChart2 className="h-4 w-4 shrink-0 text-matcha-500" />
        <span className="text-sm font-semibold flex-1 text-foreground">Bestellmuster-Heatmap</span>
        {data && (
          <span className={cn('text-[10px] font-bold', TREND_COLOR[data.woche_trend])}>
            {data.woche_delta_pct > 0 ? '+' : ''}{data.woche_delta_pct}% Woche
          </span>
        )}
        {loading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Peak info */}
          {data && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Peak:</span>
              <span>{data.peak_wochentag_label} {data.peak_stunde_label}</span>
              <span className="font-bold text-matcha-600 dark:text-matcha-400">{data.peak_anzahl} Bestellungen</span>
              <span className="flex items-center gap-1 ml-auto">{TREND_ICON[data.woche_trend]} {data.woche_delta_pct > 0 ? '+' : ''}{data.woche_delta_pct}% vs. Vorwoche</span>
            </div>
          )}

          {/* Top 5 list */}
          {data && data.top5.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Top-5 Spitzenzeiten</div>
              {data.top5.map(s => (
                <div key={`${s.wochentag}-${s.stunde}`} className="flex items-center gap-2">
                  <span className="w-4 text-[10px] font-bold text-muted-foreground text-right">{s.rang}.</span>
                  <span className="w-14 text-[11px] font-medium text-foreground">{s.wochentag_label} {s.stunde_label}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-matcha-500 transition-all"
                      style={{ width: `${maxVal > 0 ? Math.round((s.anzahl / maxVal) * 100) : 0}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-[11px] font-bold tabular-nums text-foreground">{s.anzahl}</span>
                  <span className="w-4 flex justify-center">{TREND_ICON[s.trend]}</span>
                </div>
              ))}
            </div>
          )}

          {/* 7×15 mini heatmap grid (hours 8–22) */}
          {data && (
            <div className="overflow-x-auto">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Wochenmuster (8–22 Uhr)</div>
              <div className="inline-grid gap-px" style={{ gridTemplateColumns: `auto repeat(${GRID_HOURS.length}, minmax(0, 1fr))` }}>
                {/* Header row */}
                <div className="w-6" />
                {GRID_HOURS.map(h => (
                  <div
                    key={h}
                    className={cn('text-[8px] text-center tabular-nums', h === currentHour ? 'font-bold text-matcha-600 dark:text-matcha-400' : 'text-muted-foreground')}
                  >
                    {h}
                  </div>
                ))}
                {/* Data rows */}
                {WOCHENTAGE.map((dow, d) => (
                  <>
                    <div
                      key={`label-${d}`}
                      className={cn('text-[9px] font-medium pr-1 flex items-center', d === todayDow ? 'text-matcha-600 dark:text-matcha-400 font-bold' : 'text-muted-foreground')}
                    >
                      {dow}
                    </div>
                    {GRID_HOURS.map(h => {
                      const val = gridLookup.get(`${d}-${h}`) ?? 0;
                      const isNow = d === todayDow && h === currentHour;
                      return (
                        <div
                          key={`${d}-${h}`}
                          title={`${dow} ${h}:00 — ${val} Bestellungen`}
                          className={cn(
                            'h-3 w-full rounded-sm',
                            intensitaetClass(val, maxVal),
                            isNow && 'ring-1 ring-matcha-600 dark:ring-matcha-400',
                          )}
                        />
                      );
                    })}
                  </>
                ))}
              </div>
            </div>
          )}

          {!data && !loading && locationId && (
            <div className="text-sm text-muted-foreground text-center py-2">Lade Bestellmuster…</div>
          )}
        </div>
      )}
    </div>
  );
}
