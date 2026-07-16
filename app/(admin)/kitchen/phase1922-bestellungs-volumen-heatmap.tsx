'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { BarChart2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Phase 1922 — Bestellungs-Volumen-Heatmap (Kitchen)
 *
 * Stündliche Bestellanzahl als Mini-Heatmap (letzte 12h); Peak-Hour-Highlight;
 * Alert wenn >150% Ø; useMemo; Collapsible.
 */

interface Order {
  id: string;
  created_at?: string;
  status?: string;
}

interface StundenEintrag {
  stunde: number;
  label: string;
  anzahl: number;
  isPeak: boolean;
  alert: boolean;
}

export function KitchenPhase1922BestellungsVolumenHeatmap({ orders, className }: { orders: Order[]; className?: string }) {
  const [offen, setOffen] = useState(true);

  const { stunden, gesamtAvg, peakStunde, alertAktiv } = useMemo(() => {
    const jetzt = new Date();
    const slots = new Map<number, number>();
    for (let i = 11; i >= 0; i--) {
      const h = (jetzt.getHours() - i + 24) % 24;
      slots.set(h, 0);
    }

    for (const o of orders) {
      if (!o.created_at) continue;
      const h = new Date(o.created_at).getHours();
      if (slots.has(h)) slots.set(h, (slots.get(h) ?? 0) + 1);
    }

    const werte = Array.from(slots.values());
    const gesamtAvg = werte.length > 0
      ? werte.reduce((s, v) => s + v, 0) / werte.length
      : 0;

    const stunden: StundenEintrag[] = Array.from(slots.entries()).map(([h, anzahl]) => ({
      stunde: h,
      label: `${String(h).padStart(2, '0')}:00`,
      anzahl,
      isPeak: anzahl === Math.max(...werte) && anzahl > 0,
      alert: gesamtAvg > 0 && anzahl > gesamtAvg * 1.5,
    }));

    const peakStunde = stunden.find((s) => s.isPeak) ?? null;
    const alertAktiv = stunden.some((s) => s.alert);

    return { stunden, gesamtAvg: Math.round(gesamtAvg * 10) / 10, peakStunde, alertAktiv };
  }, [orders]);

  const maxAnzahl = Math.max(...stunden.map((s) => s.anzahl), 1);

  const intensitaet = (anzahl: number) => {
    const ratio = anzahl / maxAnzahl;
    if (ratio === 0) return 'bg-muted/20';
    if (ratio < 0.25) return 'bg-blue-200 dark:bg-blue-900/40';
    if (ratio < 0.5) return 'bg-blue-400 dark:bg-blue-700/60';
    if (ratio < 0.75) return 'bg-blue-600 dark:bg-blue-500';
    return 'bg-blue-800 dark:bg-blue-400';
  };

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <BarChart2 className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
        <span className="text-xs font-bold uppercase tracking-wider">Volumen-Heatmap</span>
        <span className="ml-1 text-[10px] font-bold rounded-full px-2 py-0.5 bg-muted text-muted-foreground">
          Letzte 12h · Ø {gesamtAvg}/Std
        </span>
        {alertAktiv && (
          <span className="ml-1 text-[10px] font-bold rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-0.5">
            Peak!
          </span>
        )}
        {offen ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />}
      </button>

      {offen && (
        <div className="p-4 space-y-3">
          {alertAktiv && (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs font-bold text-red-700 dark:text-red-300">
                Bestellvolumen über 150% des Stundenschnitts — Küche möglicherweise überlastet!
              </p>
            </div>
          )}

          {/* Heatmap-Balken */}
          <div className="flex items-end gap-0.5 h-16">
            {stunden.map((s) => (
              <div key={s.stunde} className="flex-1 flex flex-col items-center gap-0.5">
                <div
                  className={cn(
                    'w-full rounded-sm transition-all',
                    s.isPeak ? 'ring-1 ring-amber-400 dark:ring-amber-500' : '',
                    intensitaet(s.anzahl),
                  )}
                  style={{ height: `${Math.max((s.anzahl / maxAnzahl) * 52, s.anzahl > 0 ? 4 : 2)}px` }}
                  title={`${s.label}: ${s.anzahl} Bestellungen`}
                />
              </div>
            ))}
          </div>

          {/* Stundenachse — nur jede 3. Stunde beschriften */}
          <div className="flex items-start gap-0.5">
            {stunden.map((s, i) => (
              <div key={s.stunde} className="flex-1 flex justify-center">
                {i % 3 === 0 && (
                  <span className="text-[8px] text-muted-foreground tabular-nums">{s.label.slice(0, 2)}</span>
                )}
              </div>
            ))}
          </div>

          {/* Anzahl-Labels unter Peak */}
          <div className="flex items-start gap-0.5">
            {stunden.map((s) => (
              <div key={s.stunde} className="flex-1 flex justify-center">
                {s.anzahl > 0 && (
                  <span className={cn('text-[8px] tabular-nums font-bold', s.isPeak ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
                    {s.anzahl}
                  </span>
                )}
              </div>
            ))}
          </div>

          {peakStunde && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
              <BarChart2 className="h-3.5 w-3.5" />
              <span>Peak: {peakStunde.label} — {peakStunde.anzahl} Bestellungen</span>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground text-right">
            Letzte 12h · Alert bei &gt;150% Ø · useMemo
          </p>
        </div>
      )}
    </div>
  );
}
