'use client';

import { useEffect, useState } from 'react';
import { BarChart2, ChevronDown, ChevronUp, Loader2, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1397 — Schicht-Durchsatz-Widget (Dispatch)
 *
 * Visualisiert Phase1395-API: Bestellungen/Stunde heute vs. Vorwoche (gleicher Wochentag):
 *   • Balken-Chart: Heute (blau) vs. Vorwoche (grau) je Stunde
 *   • Gesamtzahl + Trend-Badge (besser/gleich/schlechter)
 *   • Aktuelle Stunde hervorgehoben
 *   • 10-Min-Polling
 *
 * Nach Phase1392 in dispatch/client.tsx einbinden.
 */

interface StundeData {
  stunde: number;
  label: string;
  heute: number;
  vorwoche: number;
  delta: number;
}

interface DurchsatzData {
  stunden: StundeData[];
  gesamt_heute: number;
  gesamt_vorwoche: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  trend_pct: number;
}

interface Props {
  locationId: string | null;
}

const TREND_STYLE = {
  besser:      { text: 'text-green-600 dark:text-green-400',  bg: 'bg-green-100 dark:bg-green-900/30', icon: TrendingUp   },
  gleich:      { text: 'text-slate-500',                      bg: 'bg-slate-100 dark:bg-slate-800',    icon: Minus        },
  schlechter:  { text: 'text-red-600 dark:text-red-400',      bg: 'bg-red-100 dark:bg-red-900/30',     icon: TrendingDown },
};

export function DispatchPhase1397SchichtDurchsatzWidget({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<DurchsatzData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/admin/schicht-durchsatz-vergleich?location_id=${locationId}`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        // keep previous
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, 10 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [locationId]);

  const nowHour = new Date().getHours();

  // Only show hours 7-23 for readability
  const visibleStunden = data?.stunden.filter((s) => s.stunde >= 7) ?? [];
  const maxVal = visibleStunden.length > 0
    ? Math.max(...visibleStunden.flatMap((s) => [s.heute, s.vorwoche]), 1)
    : 1;

  return (
    <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
      >
        <BarChart2 className="h-4 w-4 text-blue-500" />
        <span className="font-semibold text-sm">Schicht-Durchsatz</span>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-1" />}
        {data && (
          <span className="ml-1 text-xs text-muted-foreground">
            Heute {data.gesamt_heute} | Vorwoche {data.gesamt_vorwoche}
          </span>
        )}
        <span className="ml-auto">{open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {!data ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              {loading ? 'Lade Durchsatz-Daten…' : 'Keine Daten'}
            </div>
          ) : (
            <>
              {/* Trend + KPIs */}
              <div className="flex items-center gap-2 flex-wrap">
                {(() => {
                  const t = TREND_STYLE[data.trend];
                  const Icon = t.icon;
                  return (
                    <span className={cn('flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full', t.bg, t.text)}>
                      <Icon className="h-3.5 w-3.5" />
                      {data.trend === 'besser' ? '+' : data.trend === 'schlechter' ? '' : '±'}{data.trend_pct}% vs. Vorwoche
                    </span>
                  );
                })()}
                <span className="text-xs text-muted-foreground ml-auto">10-Min-Polling</span>
              </div>

              {/* Balken-Chart */}
              <div className="overflow-x-auto">
                <div className="flex items-end gap-1 min-w-0" style={{ minHeight: 80 }}>
                  {visibleStunden.map((s) => {
                    const isNow = s.stunde === nowHour;
                    const heuteH = Math.round((s.heute / maxVal) * 72);
                    const vwH = Math.round((s.vorwoche / maxVal) * 72);
                    return (
                      <div key={s.stunde} className="flex flex-col items-center gap-0.5 flex-1 min-w-[18px]">
                        <div className="flex items-end gap-px w-full justify-center" style={{ height: 72 }}>
                          <div
                            className={cn(
                              'w-2.5 rounded-t transition-all',
                              isNow ? 'bg-blue-500' : 'bg-blue-300 dark:bg-blue-700'
                            )}
                            style={{ height: Math.max(heuteH, 2) }}
                            title={`Heute ${s.label}: ${s.heute}`}
                          />
                          <div
                            className="w-2.5 rounded-t bg-slate-300 dark:bg-slate-600"
                            style={{ height: Math.max(vwH, 2) }}
                            title={`Vorwoche ${s.label}: ${s.vorwoche}`}
                          />
                        </div>
                        {isNow && (
                          <div className="w-1 h-1 rounded-full bg-blue-500" />
                        )}
                        <span className={cn(
                          'text-[9px] leading-none',
                          isNow ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-muted-foreground'
                        )}>
                          {s.stunde % 2 === 0 ? `${s.stunde}` : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Legende */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded bg-blue-400" /> Heute
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded bg-slate-300 dark:bg-slate-600" /> Vorwoche
                </span>
                <span className="ml-auto">Bestellungen / Stunde</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
