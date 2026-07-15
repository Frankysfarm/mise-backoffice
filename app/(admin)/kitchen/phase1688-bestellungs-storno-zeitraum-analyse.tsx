'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChevronDown, ChevronUp, XCircle } from 'lucide-react';

/**
 * Phase 1688 — Bestellungs-Storno-Zeitraum-Analyse (Kitchen)
 *
 * Storno-Rate je Tagesstunde als Mini-Balken; Spitzenzeit markiert; useMemo; Props-basiert.
 */

interface OrderInput {
  id: string;
  status?: string | null;
  bestellt_am?: string | null;
  created_at?: string | null;
}

interface Props {
  orders: OrderInput[];
}

interface StundenStat {
  stunde: number;
  label: string;
  gesamt: number;
  storniert: number;
  rate_pct: number;
  isPeak: boolean;
}

const STORNO_STATUS = new Set(['storniert', 'cancelled', 'abgebrochen', 'storno', 'canceled']);
const WARN_PCT = 15;
const KRITISCH_PCT = 30;

function ampelColor(pct: number) {
  if (pct >= KRITISCH_PCT) return { bar: 'bg-red-500', text: 'text-red-600 dark:text-red-400' };
  if (pct >= WARN_PCT)     return { bar: 'bg-amber-400', text: 'text-amber-600 dark:text-amber-400' };
  return { bar: 'bg-matcha-400', text: 'text-matcha-600 dark:text-matcha-400' };
}

export function KitchenPhase1688BestellungsStornoZeitraumAnalyse({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const { stunden, peakStunde, hatWarnOrKritisch, maxRate } = useMemo(() => {
    const counts: Record<number, { gesamt: number; storniert: number }> = {};
    for (let h = 0; h < 24; h++) counts[h] = { gesamt: 0, storniert: 0 };

    for (const o of orders) {
      const ts = o.bestellt_am ?? o.created_at;
      if (!ts) continue;
      const h = new Date(ts).getHours();
      counts[h].gesamt++;
      if (STORNO_STATUS.has((o.status ?? '').toLowerCase())) {
        counts[h].storniert++;
      }
    }

    const stunden: StundenStat[] = Object.entries(counts)
      .filter(([, c]) => c.gesamt > 0)
      .map(([h, c]) => ({
        stunde: Number(h),
        label: `${String(h).padStart(2, '0')}h`,
        gesamt: c.gesamt,
        storniert: c.storniert,
        rate_pct: Math.round((c.storniert / c.gesamt) * 100),
        isPeak: false,
      }))
      .sort((a, b) => a.stunde - b.stunde);

    const maxRate = stunden.reduce((m, s) => Math.max(m, s.rate_pct), 0);
    const peakIdx = stunden.findIndex(s => s.rate_pct === maxRate && s.storniert > 0);
    const peakStunde = peakIdx >= 0 ? stunden[peakIdx] : null;
    if (peakIdx >= 0) stunden[peakIdx].isPeak = true;

    return {
      stunden,
      peakStunde,
      maxRate,
      hatWarnOrKritisch: stunden.some(s => s.rate_pct >= WARN_PCT),
    };
  }, [orders]);

  if (stunden.length === 0) return null;

  const barMax = maxRate > 0 ? maxRate : 1;

  return (
    <div className="rounded-xl border border-border bg-card p-3 mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left"
      >
        <XCircle className={cn('h-4 w-4 shrink-0', hatWarnOrKritisch ? 'text-amber-500' : 'text-muted-foreground')} />
        <span className="text-sm font-semibold flex-1 text-foreground">
          Storno-Zeitraum-Analyse
        </span>
        {hatWarnOrKritisch && (
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        )}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-1">
          {peakStunde && peakStunde.storniert > 0 && (
            <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mb-2 px-1">
              Spitze: {peakStunde.label} — {peakStunde.rate_pct}% Storno-Rate ({peakStunde.storniert}/{peakStunde.gesamt})
            </div>
          )}

          <div className="space-y-1.5">
            {stunden.map(s => {
              const cfg = ampelColor(s.rate_pct);
              const barW = Math.round((s.rate_pct / barMax) * 100);
              return (
                <div key={s.stunde} className="flex items-center gap-2">
                  <span className={cn(
                    'w-7 text-[10px] tabular-nums font-medium shrink-0',
                    s.isPeak ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
                  )}>
                    {s.label}
                  </span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', cfg.bar)}
                      style={{ width: `${barW}%` }}
                    />
                  </div>
                  <span className={cn('w-8 text-right text-[10px] tabular-nums font-bold shrink-0', cfg.text)}>
                    {s.rate_pct}%
                  </span>
                  <span className="w-10 text-right text-[9px] text-muted-foreground shrink-0">
                    {s.storniert}/{s.gesamt}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="text-[9px] text-muted-foreground pt-2">
            Warnung ab {WARN_PCT}% · Kritisch ab {KRITISCH_PCT}% · nur Stunden mit Bestellungen
          </p>
        </div>
      )}
    </div>
  );
}
