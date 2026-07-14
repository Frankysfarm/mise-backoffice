'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, CheckCircle2, XCircle, Loader2, Package } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { LieferErfolgsquoteResponse, TagesQuote } from '@/app/api/delivery/admin/liefer-erfolgsquote/route';

// Phase 1496 — Liefer-Erfolgsquote-Dashboard (Lieferdienst)
// Visualisiert Phase1491-API: Heute-Quote + 7-Tage-Balkentrend + Status-Badge.
// Collapsible, 10-Min-Polling. Nach Phase1488.

interface Props {
  locationId: string | null;
}

const POLL_MS = 10 * 60_000;

const STATUS_CFG = {
  sehr_gut: { label: 'Sehr gut',   color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20',  border: 'border-emerald-200 dark:border-emerald-800', bar: 'bg-emerald-500' },
  gut:      { label: 'Gut',        color: 'text-sky-600 dark:text-sky-400',          bg: 'bg-sky-50 dark:bg-sky-900/20',          border: 'border-sky-200 dark:border-sky-800',         bar: 'bg-sky-500'     },
  mittel:   { label: 'Mittel',     color: 'text-amber-600 dark:text-amber-400',      bg: 'bg-amber-50 dark:bg-amber-900/20',      border: 'border-amber-200 dark:border-amber-800',     bar: 'bg-amber-400'   },
  schlecht: { label: 'Schlecht',   color: 'text-rose-600 dark:text-rose-400',        bg: 'bg-rose-50 dark:bg-rose-900/20',        border: 'border-rose-200 dark:border-rose-800',       bar: 'bg-rose-500'    },
};

function buildMock(): LieferErfolgsquoteResponse {
  const weekdays = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const vals = [91, 94, 89, 96, 92, 88, 95];
  const now = new Date();
  const trend: TagesQuote[] = vals.map((q, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    const gesamt = 45 + i * 3;
    const erfolgreich = Math.round(gesamt * (q / 100));
    return { datum: d.toISOString().slice(0, 10), label: weekdays[d.getDay()] ?? '?', gesamt, erfolgreich, storniert: gesamt - erfolgreich, quote_pct: q };
  });
  const heute = trend[trend.length - 1]!;
  const avg = parseFloat((trend.reduce((s, t) => s + t.quote_pct, 0) / trend.length).toFixed(1));
  return {
    heute: { gesamt: heute.gesamt, erfolgreich: heute.erfolgreich, storniert: heute.storniert, in_zustellung: 3, quote_pct: heute.quote_pct, status: 'sehr_gut' },
    trend_7d: trend,
    durchschnitt_7d_pct: avg,
    delta_vs_7d: parseFloat((heute.quote_pct - avg).toFixed(1)),
    location_id: 'mock',
    datum: now.toISOString().slice(0, 10),
    generiert_am: now.toISOString(),
  };
}

function TrendIcon({ delta }: { delta: number }) {
  if (delta > 0.5) return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
  if (delta < -0.5) return <TrendingDown className="h-3.5 w-3.5 text-rose-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

export function LieferdiensstPhase1496LieferErfolgsquoteDashboard({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<LieferErfolgsquoteResponse>(buildMock);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) return;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/admin/liefer-erfolgsquote?location_id=${locationId}`, { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (json?.heute?.gesamt != null) setData(json as LieferErfolgsquoteResponse);
        }
      } catch {} finally {
        setLoading(false);
      }
    }

    load();
    const iv = setInterval(load, POLL_MS);
    return () => clearInterval(iv);
  }, [locationId]);

  const cfg = STATUS_CFG[data.heute.status];
  const maxPct = Math.max(...data.trend_7d.map((t) => t.quote_pct), 1);

  return (
    <Card className={cn('overflow-hidden border', cfg.border)}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn('w-full flex items-center gap-2 px-4 py-2.5 border-b text-left', cfg.bg, cfg.border)}
      >
        <Package className={cn('h-4 w-4 shrink-0', cfg.color)} />
        <span className={cn('text-xs font-bold uppercase tracking-wider flex-1', cfg.color)}>
          Liefer-Erfolgsquote
        </span>
        <span className={cn('text-[10px] font-black tabular-nums', cfg.color)}>
          {data.heute.quote_pct.toFixed(1)}%
        </span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        <span className="ml-1 text-[10px] text-muted-foreground">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 py-3 space-y-3">
          {/* KPI row */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Gesamt', value: data.heute.gesamt, icon: Package, color: 'text-foreground' },
              { label: 'Geliefert', value: data.heute.erfolgreich, icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Storniert', value: data.heute.storniert, icon: XCircle, color: 'text-rose-600 dark:text-rose-400' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="rounded-lg bg-muted/40 px-2.5 py-2 text-center">
                <Icon className={cn('h-4 w-4 mx-auto mb-0.5', color)} />
                <div className={cn('text-base font-black tabular-nums', color)}>{value}</div>
                <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>

          {/* Trend bar chart */}
          <div>
            <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              7-Tage-Trend
            </div>
            <div className="flex items-end gap-1 h-12">
              {data.trend_7d.map((t) => {
                const heightPct = Math.round((t.quote_pct / maxPct) * 100);
                const isToday = t.datum === data.datum;
                return (
                  <div key={t.datum} className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
                    <div className="w-full flex flex-col items-center justify-end" style={{ height: '100%' }}>
                      <div
                        className={cn(
                          'w-full rounded-t-sm',
                          isToday ? cfg.bar : 'bg-slate-200 dark:bg-slate-700',
                        )}
                        style={{ height: `${Math.max(heightPct, 4)}%` }}
                      />
                    </div>
                    <span className="text-[8px] text-muted-foreground">{t.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Delta vs avg */}
          <div className="flex items-center gap-2 border-t pt-2">
            <TrendIcon delta={data.delta_vs_7d} />
            <span className="text-[11px] text-muted-foreground">
              Ø 7 Tage: <span className="font-bold text-foreground">{data.durchschnitt_7d_pct.toFixed(1)}%</span>
            </span>
            <span className={cn(
              'ml-auto text-[11px] font-black tabular-nums',
              data.delta_vs_7d > 0 ? 'text-emerald-600 dark:text-emerald-400' : data.delta_vs_7d < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground',
            )}>
              {data.delta_vs_7d > 0 ? '+' : ''}{data.delta_vs_7d.toFixed(1)}%
            </span>
            <span className={cn('inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold', cfg.bg, cfg.color)}>
              {cfg.label}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
