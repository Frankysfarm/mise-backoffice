'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertOctagon, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';

/**
 * Phase 1937 — Bestellungs-Fehlerquoten-Tracker (Kitchen)
 *
 * Fehlertypen (Falsch/Fehlt/Beschädigt) letzte 50 Bestellungen;
 * Balkendiagramm; Alert wenn Fehlerquote >5%; useMemo; Collapsible.
 */

interface OrderItem {
  name?: string;
  quantity?: number;
  status?: string;
  error_type?: 'falsch' | 'fehlt' | 'beschaedigt' | null;
}

interface Order {
  id: string;
  status?: string;
  items?: OrderItem[];
  has_error?: boolean;
  error_type?: 'falsch' | 'fehlt' | 'beschaedigt' | null;
}

interface FehlerTyp {
  key: 'falsch' | 'fehlt' | 'beschaedigt';
  label: string;
  anzahl: number;
  pct: number;
}

const LETZTE_N = 50;

export function KitchenPhase1937BestellungsFehlerquotenTracker({ orders, className }: { orders: Order[]; className?: string }) {
  const [offen, setOffen] = useState(true);

  const { fehlerTypen, fehlerquote_pct, total_fehler, analysiert, alert } = useMemo(() => {
    const letzteN = orders.slice(-LETZTE_N);
    const analysiert = letzteN.length;

    const counts = { falsch: 0, fehlt: 0, beschaedigt: 0 };

    for (const o of letzteN) {
      if (o.has_error && o.error_type && o.error_type in counts) {
        counts[o.error_type as keyof typeof counts]++;
        continue;
      }
      const items = o.items ?? [];
      for (const item of items) {
        if (item.error_type && item.error_type in counts) {
          counts[item.error_type as keyof typeof counts]++;
        }
      }
    }

    const totalFehler = counts.falsch + counts.fehlt + counts.beschaedigt;
    const fehlerquotePct = analysiert > 0 ? Math.round((totalFehler / analysiert) * 100) : 0;

    const fehlerTypen: FehlerTyp[] = [
      { key: 'falsch', label: 'Falsch geliefert', anzahl: counts.falsch, pct: analysiert > 0 ? Math.round((counts.falsch / analysiert) * 100) : 0 },
      { key: 'fehlt', label: 'Artikel fehlt', anzahl: counts.fehlt, pct: analysiert > 0 ? Math.round((counts.fehlt / analysiert) * 100) : 0 },
      { key: 'beschaedigt', label: 'Beschädigt', anzahl: counts.beschaedigt, pct: analysiert > 0 ? Math.round((counts.beschaedigt / analysiert) * 100) : 0 },
    ];

    return {
      fehlerTypen,
      fehlerquote_pct: fehlerquotePct,
      total_fehler: totalFehler,
      analysiert,
      alert: fehlerquotePct > 5,
    };
  }, [orders]);

  const maxPct = Math.max(...fehlerTypen.map((f) => f.pct), 1);

  const farben = {
    falsch: { bar: 'bg-red-500', text: 'text-red-700 dark:text-red-300' },
    fehlt: { bar: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300' },
    beschaedigt: { bar: 'bg-orange-500', text: 'text-orange-700 dark:text-orange-300' },
  };

  const gesamtFarbe = alert ? 'text-red-700 dark:text-red-300' : total_fehler === 0 ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300';

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <AlertOctagon className={cn('h-4 w-4 shrink-0', gesamtFarbe)} />
        <span className="text-xs font-bold uppercase tracking-wider">Fehlerquoten-Tracker</span>
        <span className={cn('ml-1 text-[10px] font-bold rounded-full px-2 py-0.5 bg-muted', gesamtFarbe)}>
          {fehlerquote_pct}% Fehlerquote
        </span>
        {alert && (
          <span className="ml-1 text-[10px] font-bold rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-0.5">
            &gt;5% Alert!
          </span>
        )}
        {offen ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />}
      </button>

      {offen && (
        <div className="p-4 space-y-3">
          {alert && (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-3 py-2 flex items-start gap-2">
              <AlertOctagon className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs font-bold text-red-700 dark:text-red-300">
                Fehlerquote über 5%! {total_fehler} Fehler in letzten {analysiert} Bestellungen.
              </p>
            </div>
          )}

          {total_fehler === 0 ? (
            <div className="flex items-center gap-2 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 px-3 py-2.5">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
              <p className="text-xs font-bold text-green-700 dark:text-green-300">
                Keine Fehler in den letzten {analysiert} Bestellungen!
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {fehlerTypen.map((f) => (
                <div key={f.key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className={cn('text-xs font-semibold', farben[f.key].text)}>{f.label}</span>
                    <span className={cn('text-[10px] font-bold tabular-nums', farben[f.key].text)}>
                      {f.anzahl} ({f.pct}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', farben[f.key].bar)}
                      style={{ width: `${(f.pct / maxPct) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-[10px] text-muted-foreground text-right">
            Letzte {LETZTE_N} Bestellungen · Alert &gt;5% · useMemo
          </p>
        </div>
      )}
    </div>
  );
}
