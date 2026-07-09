'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { BarChart2, ChevronDown, ChevronUp, Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Phase 948 — Zonen-Ertrag-Dashboard (Dispatch)
 *
 * Balken-Chart je Zone A/B/C/D mit Umsatz + Pünktlichkeit + Trend aus Phase941-API.
 * 10-Min-Polling auf /api/delivery/admin/zonen-ertrag-analyse.
 */

interface ZoneData {
  zone: string;
  umsatz: number;
  bestellungen: number;
  puenktlichkeit_pct: number;
  umsatz_vorwoche: number;
  bestellungen_vorwoche: number;
  trend: 'steigend' | 'fallend' | 'stabil';
}

interface ApiResponse {
  zonen: ZoneData[];
  gesamt_umsatz: number;
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

const ZONE_COLORS: Record<string, string> = {
  A: 'bg-matcha-500',
  B: 'bg-blue-500',
  C: 'bg-amber-500',
  D: 'bg-purple-500',
};

const ZONE_TEXT: Record<string, string> = {
  A: 'text-matcha-600 dark:text-matcha-400',
  B: 'text-blue-600 dark:text-blue-400',
  C: 'text-amber-600 dark:text-amber-400',
  D: 'text-purple-600 dark:text-purple-400',
};

const ZONE_BG: Record<string, string> = {
  A: 'bg-matcha-100 dark:bg-matcha-900/40',
  B: 'bg-blue-100 dark:bg-blue-900/40',
  C: 'bg-amber-100 dark:bg-amber-900/40',
  D: 'bg-purple-100 dark:bg-purple-900/40',
};

function TrendIcon({ trend }: { trend: ZoneData['trend'] }) {
  if (trend === 'steigend') return <TrendingUp className="h-3.5 w-3.5 text-matcha-500" />;
  if (trend === 'fallend') return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

export function DispatchPhase948ZonenErtragDashboard({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/admin/zonen-ertrag-analyse?location_id=${locationId}`);
        if (!cancelled) setData(res.ok ? await res.json() : null);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const id = setInterval(load, 10 * 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [locationId]);

  const zonen = data?.zonen ?? [];
  const maxUmsatz = zonen.length > 0 ? Math.max(...zonen.map((z) => z.umsatz), 1) : 1;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-muted/30 transition text-left"
      >
        <BarChart2 className="h-4 w-4 text-matcha-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Zonen-Ertrag Heute
        </span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
        {data && !loading && (
          <span className="text-[10px] text-muted-foreground ml-1">
            {data.gesamt_umsatz.toFixed(2)} € gesamt
          </span>
        )}
        <span className="ml-auto text-muted-foreground">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {!locationId && (
            <p className="text-sm text-muted-foreground">Bitte Filiale auswählen.</p>
          )}

          {locationId && !loading && zonen.length === 0 && (
            <p className="text-sm text-muted-foreground">Keine Zonendaten verfügbar.</p>
          )}

          {zonen.length > 0 && (
            <>
              {/* Balken-Chart */}
              <div className="space-y-2.5">
                {zonen.map((z) => {
                  const barPct = maxUmsatz > 0 ? (z.umsatz / maxUmsatz) * 100 : 0;
                  return (
                    <div key={z.zone} className="space-y-1">
                      <div className="flex items-center gap-2">
                        {/* Zone-Label */}
                        <span className={cn(
                          'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black',
                          ZONE_BG[z.zone],
                          ZONE_TEXT[z.zone],
                        )}>
                          {z.zone}
                        </span>

                        {/* Balken */}
                        <div className="flex-1 h-5 rounded-md bg-muted overflow-hidden relative">
                          <div
                            className={cn('h-full rounded-md transition-all', ZONE_COLORS[z.zone] ?? 'bg-matcha-500')}
                            style={{ width: `${barPct}%` }}
                          />
                          <span className="absolute inset-0 flex items-center pl-2 text-[10px] font-bold text-white mix-blend-luminosity">
                            {z.umsatz > 0 ? `${z.umsatz.toFixed(2)} €` : '—'}
                          </span>
                        </div>

                        {/* Trend */}
                        <span className="shrink-0"><TrendIcon trend={z.trend} /></span>
                      </div>

                      {/* KPI-Zeile */}
                      <div className="flex items-center gap-3 pl-7 text-[10px] text-muted-foreground">
                        <span>{z.bestellungen} Bestel{z.bestellungen === 1 ? 'lung' : 'lungen'}</span>
                        <span className={cn(
                          'font-semibold',
                          z.puenktlichkeit_pct >= 85 ? 'text-matcha-600 dark:text-matcha-400'
                            : z.puenktlichkeit_pct >= 70 ? 'text-amber-600 dark:text-amber-400'
                            : 'text-red-600 dark:text-red-400',
                        )}>
                          {z.puenktlichkeit_pct}% pünktl.
                        </span>
                        {z.umsatz_vorwoche > 0 && (
                          <span>
                            vs. VW:{' '}
                            <span className={cn(
                              'font-semibold',
                              z.trend === 'steigend' ? 'text-matcha-600 dark:text-matcha-400'
                                : z.trend === 'fallend' ? 'text-red-600 dark:text-red-400'
                                : 'text-muted-foreground',
                            )}>
                              {z.umsatz_vorwoche.toFixed(2)} €
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Gesamt-Footer */}
              <div className="mt-1 flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-[11px]">
                <span className="text-muted-foreground">Gesamt-Umsatz heute</span>
                <span className="font-bold text-foreground tabular-nums">
                  {(data?.gesamt_umsatz ?? 0).toFixed(2)} €
                </span>
              </div>

              <p className="text-[9px] text-right text-muted-foreground">10-Min-Refresh</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
