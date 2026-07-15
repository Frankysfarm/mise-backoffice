'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Users, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Loader2, RefreshCw } from 'lucide-react';

/**
 * Phase 1714 — Kunden-Wiederkehr-Rate-Widget (Dispatch)
 *
 * Phase1712-API: /api/delivery/admin/kunden-wiederkehr-rate
 * Wiederkehr-% + Trend-Pfeil + Zonen-Breakdown.
 * 60-Min-Polling.
 */

interface ZoneWiederkehr {
  zone: string;
  wiederkehr_pct: number;
  kunden_gesamt: number;
  kunden_wiederkehrend: number;
}

interface ApiResponse {
  location_id: string;
  wiederkehr_pct: number;
  wiederkehr_pct_vormonat: number;
  trend_pct: number;
  kunden_gesamt: number;
  kunden_wiederkehrend: number;
  zonen: ZoneWiederkehr[];
  generiert_am: string;
}

interface Props {
  locationId?: string | null;
}

const MOCK: ApiResponse = {
  location_id: 'mock',
  wiederkehr_pct: 45,
  wiederkehr_pct_vormonat: 41,
  trend_pct: 4,
  kunden_gesamt: 118,
  kunden_wiederkehrend: 53,
  zonen: [
    { zone: 'A', wiederkehr_pct: 52, kunden_gesamt: 42, kunden_wiederkehrend: 22 },
    { zone: 'B', wiederkehr_pct: 44, kunden_gesamt: 36, kunden_wiederkehrend: 16 },
    { zone: 'C', wiederkehr_pct: 38, kunden_gesamt: 26, kunden_wiederkehrend: 10 },
    { zone: 'D', wiederkehr_pct: 29, kunden_gesamt: 14, kunden_wiederkehrend: 4 },
  ],
  generiert_am: new Date().toISOString(),
};

const POLL_MS = 60 * 60 * 1000;

function TrendIcon({ diff }: { diff: number }) {
  if (diff > 1)  return <TrendingUp   className="h-4 w-4 text-matcha-500" />;
  if (diff < -1) return <TrendingDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function pctColor(pct: number) {
  if (pct >= 50) return 'text-matcha-700 dark:text-matcha-300';
  if (pct >= 35) return 'text-amber-700 dark:text-amber-300';
  return 'text-red-700 dark:text-red-300';
}

function pctBarColor(pct: number) {
  if (pct >= 50) return 'bg-matcha-400';
  if (pct >= 35) return 'bg-amber-400';
  return 'bg-red-500';
}

export function DispatchPhase1714KundenWiederkehrRateWidget({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) return;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/admin/kunden-wiederkehr-rate?location_id=${locationId}`);
        if (res.ok) setData(await res.json());
      } catch {
        /* keep mock */
      } finally {
        setLoading(false);
      }
    };

    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [locationId]);

  return (
    <div className="rounded-xl border border-border bg-card p-3 mb-3">
      <button onClick={() => setOpen(v => !v)} className="flex w-full items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Users className="h-4 w-4 text-violet-500" />
          Kunden-Wiederkehr
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Main KPI */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-3">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Wiederkehr-Rate (30 Tage)</p>
              <p className={cn('text-3xl font-black tabular-nums', pctColor(data.wiederkehr_pct))}>
                {data.wiederkehr_pct}%
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {data.kunden_wiederkehrend}/{data.kunden_gesamt} Kunden
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-1">
                <TrendIcon diff={data.trend_pct} />
                <span className={cn('text-sm font-bold tabular-nums', data.trend_pct >= 0 ? 'text-matcha-600 dark:text-matcha-400' : 'text-red-600 dark:text-red-400')}>
                  {data.trend_pct >= 0 ? '+' : ''}{data.trend_pct}%
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">vs. Vormonat ({data.wiederkehr_pct_vormonat}%)</p>
            </div>
          </div>

          {/* Zonen Breakdown */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <RefreshCw className="h-3 w-3" /> Zonen-Wiederkehr
            </p>
            {data.zonen.map(z => (
              <div key={z.zone} className="flex items-center gap-2">
                <span className="w-6 text-center text-xs font-bold text-muted-foreground shrink-0">
                  {z.zone}
                </span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', pctBarColor(z.wiederkehr_pct))}
                    style={{ width: `${z.wiederkehr_pct}%` }}
                  />
                </div>
                <span className={cn('text-xs font-bold tabular-nums w-9 text-right shrink-0', pctColor(z.wiederkehr_pct))}>
                  {z.wiederkehr_pct}%
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0 w-14 text-right">
                  {z.kunden_wiederkehrend}/{z.kunden_gesamt}
                </span>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-muted-foreground">
            Aktualisiert: {new Date(data.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · 60-Min-Polling
          </p>
        </div>
      )}
    </div>
  );
}
