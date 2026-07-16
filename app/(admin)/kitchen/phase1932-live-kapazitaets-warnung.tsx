'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Gauge, AlertTriangle, ChevronDown, ChevronUp, Clock } from 'lucide-react';

/**
 * Phase 1932 — Live-Kapazitäts-Warnung (Kitchen)
 *
 * Anzahl aktiver Bestellungen vs. Kapazitätslimit (default 15);
 * Ampelring grün/gelb/rot; Alert wenn >90%; Countdown bis Entlastung; useMemo; Collapsible.
 */

interface Order {
  id: string;
  status?: string;
  created_at?: string;
  prep_time_minutes?: number;
  ready_at?: string;
}

const KAPAZITAETS_LIMIT = 15;
const PREP_ZIEL_MIN = 20;

export function KitchenPhase1932LiveKapazitaetsWarnung({
  orders,
  limit = KAPAZITAETS_LIMIT,
  className,
}: {
  orders: Order[];
  limit?: number;
  className?: string;
}) {
  const [offen, setOffen] = useState(true);

  const { aktiv, auslastung_pct, ampel, alert, entlastung_in_min } = useMemo(() => {
    const aktive = orders.filter(
      (o) => o.status === 'pending' || o.status === 'preparing' || o.status === 'in_preparation' || o.status === 'ready',
    );
    const auslastung = Math.round((aktive.length / limit) * 100);
    const ampel: 'gruen' | 'gelb' | 'rot' =
      auslastung < 60 ? 'gruen' : auslastung < 90 ? 'gelb' : 'rot';
    const isAlert = auslastung >= 90;

    // Schätze Entlastung: Durchschnittliche Restzeit bis Fertig
    const jetzt = Date.now();
    let entlastungMin = 0;
    if (isAlert && aktive.length > 0) {
      const fertigZeiten = aktive.map((o) => {
        if (o.ready_at) return Math.max(0, (new Date(o.ready_at).getTime() - jetzt) / 60_000);
        if (o.created_at) return Math.max(0, PREP_ZIEL_MIN - (jetzt - new Date(o.created_at).getTime()) / 60_000);
        return PREP_ZIEL_MIN;
      });
      const mittlere = fertigZeiten.sort((a, b) => a - b)[Math.floor(fertigZeiten.length * 0.3)];
      entlastungMin = Math.round(Math.max(1, mittlere));
    }

    return { aktiv: aktive.length, auslastung_pct: auslastung, ampel, alert: isAlert, entlastung_in_min: entlastungMin };
  }, [orders, limit]);

  const circumference = 2 * Math.PI * 32;
  const dashoffset = circumference * (1 - Math.min(auslastung_pct, 100) / 100);
  const ringKlasse = ampel === 'gruen' ? 'stroke-green-500' : ampel === 'gelb' ? 'stroke-amber-500' : 'stroke-red-500';
  const textKlasse = ampel === 'gruen' ? 'text-green-700 dark:text-green-300' : ampel === 'gelb' ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300';

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <Gauge className={cn('h-4 w-4 shrink-0', textKlasse)} />
        <span className="text-xs font-bold uppercase tracking-wider">Kapazitäts-Warnung</span>
        <span className={cn('ml-1 text-[10px] font-bold rounded-full px-2 py-0.5 bg-muted', textKlasse)}>
          {aktiv}/{limit} · {auslastung_pct}%
        </span>
        {alert && (
          <span className="ml-1 text-[10px] font-bold rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-0.5">
            Überlast!
          </span>
        )}
        {offen ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />}
      </button>

      {offen && (
        <div className="p-4 space-y-3">
          {alert && (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-red-700 dark:text-red-300">Kapazitätsgrenze überschritten!</p>
                {entlastung_in_min > 0 && (
                  <p className="text-[11px] text-red-600 dark:text-red-400 mt-0.5">
                    Voraussichtliche Entlastung in ~{entlastung_in_min} Min
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-4">
            {/* Kapazitätsring */}
            <div className="relative shrink-0">
              <svg width="80" height="80" className="-rotate-90">
                <circle cx="40" cy="40" r="32" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
                <circle
                  cx="40" cy="40" r="32" fill="none" strokeWidth="6"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashoffset}
                  strokeLinecap="round"
                  className={ringKlasse}
                  style={{ transition: 'stroke-dashoffset 0.4s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn('text-lg font-black tabular-nums leading-none', textKlasse)}>{auslastung_pct}%</span>
                <span className="text-[8px] text-muted-foreground">Last</span>
              </div>
            </div>

            {/* KPIs */}
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center justify-between rounded-lg bg-muted/30 px-2.5 py-1.5">
                <span className="text-[10px] text-muted-foreground">Aktive Bestellungen</span>
                <span className={cn('text-sm font-black tabular-nums', textKlasse)}>{aktiv}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/30 px-2.5 py-1.5">
                <span className="text-[10px] text-muted-foreground">Kapazitätslimit</span>
                <span className="text-sm font-black tabular-nums">{limit}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/30 px-2.5 py-1.5">
                <span className="text-[10px] text-muted-foreground">Freie Plätze</span>
                <span className={cn('text-sm font-black tabular-nums', textKlasse)}>{Math.max(0, limit - aktiv)}</span>
              </div>
            </div>
          </div>

          {alert && entlastung_in_min > 0 && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
              <Clock className="h-3.5 w-3.5" />
              <span>Entlastung in ~{entlastung_in_min} Min erwartet</span>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground text-right">
            Limit {limit} · Alert ab 90% · useMemo
          </p>
        </div>
      )}
    </div>
  );
}
