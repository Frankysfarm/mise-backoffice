'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, Euro, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Phase 1693 — Umsatz-Vergleich-Strip (Kitchen)
 *
 * Calls /api/delivery/admin/tages-umsatz-vergleich.
 * Zeigt 3 Kacheln: Heute / Gestern / Vorwoche + Trend-Pfeile; 30-Min-Polling.
 */

interface ApiData {
  heute_eur: number;
  gestern_eur: number;
  vorwoche_eur: number;
  heute_bestellungen: number;
  gestern_bestellungen: number;
  vorwoche_bestellungen: number;
  delta_gestern_pct: number;
  delta_vorwoche_pct: number;
  trend: 'steigend' | 'stabil' | 'fallend';
}

interface Props {
  locationId: string | null;
}

const POLL_MS = 30 * 60 * 1000;

function TrendIcon({ pct }: { pct: number }) {
  if (pct > 3)  return <TrendingUp  className="h-3 w-3 text-matcha-500" />;
  if (pct < -3) return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-amber-500" />;
}

function pctColor(pct: number) {
  if (pct > 3)  return 'text-matcha-600 dark:text-matcha-400';
  if (pct < -3) return 'text-red-600 dark:text-red-400';
  return 'text-amber-600 dark:text-amber-400';
}

function fmtEur(eur: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(eur);
}

export function KitchenPhase1693UmsatzVergleichStrip({ locationId }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/tages-umsatz-vergleich?location_id=${encodeURIComponent(locationId)}`);
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

  if (!locationId) return null;

  const TREND_CFG = {
    steigend: { label: 'Steigend', color: 'text-matcha-600 dark:text-matcha-400' },
    stabil:   { label: 'Stabil',   color: 'text-amber-600 dark:text-amber-400' },
    fallend:  { label: 'Fallend',  color: 'text-red-600 dark:text-red-400' },
  };
  const trendCfg = data ? TREND_CFG[data.trend] : null;

  return (
    <div className="rounded-xl border border-border bg-card p-3 mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left"
      >
        <Euro className="h-4 w-4 shrink-0 text-matcha-500" />
        <span className="text-sm font-semibold flex-1 text-foreground">Umsatz-Vergleich</span>
        {trendCfg && (
          <span className={cn('text-[10px] font-bold', trendCfg.color)}>{trendCfg.label}</span>
        )}
        {loading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3">
          {data ? (
            <div className="grid grid-cols-3 gap-2">
              {/* Heute */}
              <div className="rounded-lg bg-matcha-50 dark:bg-matcha-950 border border-matcha-200 dark:border-matcha-800 px-2.5 py-2 space-y-0.5">
                <div className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">Heute</div>
                <div className="text-base font-black text-matcha-700 dark:text-matcha-300 tabular-nums leading-tight">
                  {fmtEur(data.heute_eur)}
                </div>
                <div className="text-[9px] text-muted-foreground tabular-nums">{data.heute_bestellungen} Best.</div>
              </div>

              {/* Gestern */}
              <div className="rounded-lg bg-muted/50 border border-border px-2.5 py-2 space-y-0.5">
                <div className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">Gestern</div>
                <div className="text-base font-black text-foreground tabular-nums leading-tight">
                  {fmtEur(data.gestern_eur)}
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <TrendIcon pct={data.delta_gestern_pct} />
                  <span className={cn('text-[9px] font-bold tabular-nums', pctColor(data.delta_gestern_pct))}>
                    {data.delta_gestern_pct > 0 ? '+' : ''}{data.delta_gestern_pct}%
                  </span>
                </div>
              </div>

              {/* Vorwoche */}
              <div className="rounded-lg bg-muted/50 border border-border px-2.5 py-2 space-y-0.5">
                <div className="text-[9px] text-muted-foreground font-medium uppercase tracking-wide">Vorwoche</div>
                <div className="text-base font-black text-foreground tabular-nums leading-tight">
                  {fmtEur(data.vorwoche_eur)}
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <TrendIcon pct={data.delta_vorwoche_pct} />
                  <span className={cn('text-[9px] font-bold tabular-nums', pctColor(data.delta_vorwoche_pct))}>
                    {data.delta_vorwoche_pct > 0 ? '+' : ''}{data.delta_vorwoche_pct}%
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-3">
              {loading ? 'Daten werden geladen…' : 'Keine Daten verfügbar.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
