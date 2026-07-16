'use client';

/**
 * Phase 1884 — Zonen-Umsatz-Prognose-Widget (Dispatch)
 *
 * Balken-Chart je Zone (aktuell vs. prognostiziert).
 * Alert wenn Prognose >20% unter Ziel.
 * 15-Min-Polling. Collapsible.
 * GET /api/delivery/admin/zonen-umsatz-prognose (Phase 1883)
 */

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, ChevronDown, ChevronUp, Euro, RefreshCw } from 'lucide-react';

interface ZonePrognose {
  zone: string;
  aktuell_eur: number;
  prognose_eur: number;
  ziel_eur: number;
  trend: 'steigend' | 'stabil' | 'fallend';
  abweichung_pct: number;
  bestellungen_prognose: number;
  mock?: boolean;
}

interface Props {
  locationId: string | null;
  className?: string;
}

const TREND_ICON = {
  steigend: TrendingUp,
  stabil:   Minus,
  fallend:  TrendingDown,
};

const TREND_COLOR = {
  steigend: 'text-matcha-600 dark:text-matcha-400',
  stabil:   'text-amber-600 dark:text-amber-400',
  fallend:  'text-red-600 dark:text-red-400',
};

const ZONE_LABEL: Record<string, string> = { A: 'Nah', B: 'Standard', C: 'Weit', D: 'Außen' };

export function DispatchPhase1884ZonenUmsatzPrognoseWidget({ locationId, className }: Props) {
  const [data, setData]       = useState<ZonePrognose[]>([]);
  const [offen, setOffen]     = useState(true);
  const [laden, setLaden]     = useState(false);
  const [zuletzt, setZuletzt] = useState<string | null>(null);

  const laden_ = useCallback(async () => {
    if (!locationId) return;
    setLaden(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/zonen-umsatz-prognose?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        setData(json.zonen ?? []);
        setZuletzt(json.generiert_um ?? null);
      }
    } catch {
      /* Silently ignore — mock-Daten bleiben */
    } finally {
      setLaden(false);
    }
  }, [locationId]);

  useEffect(() => {
    laden_();
    const id = setInterval(laden_, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [laden_]);

  const alerts = data.filter((z) => z.abweichung_pct < -20);
  const maxProg = Math.max(...data.map((z) => Math.max(z.prognose_eur, z.ziel_eur)), 1);

  if (!locationId) return null;

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <Euro className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Zonen-Umsatz-Prognose +2h</span>
        {laden && <RefreshCw className="h-3 w-3 text-muted-foreground animate-spin ml-1" />}
        {alerts.length > 0 && (
          <span className="ml-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
            {alerts.length} unter Ziel
          </span>
        )}
        {offen
          ? <ChevronUp className="ml-auto h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />}
      </button>

      {offen && (
        <div className="p-4 space-y-3">
          {alerts.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <p className="text-xs font-semibold text-red-700 dark:text-red-300">
                Zone{alerts.length > 1 ? 'n' : ''} {alerts.map((z) => z.zone).join(', ')} — Prognose &gt;20% unter Ziel
              </p>
            </div>
          )}

          <div className="space-y-3">
            {data.map((z) => {
              const TIcon = TREND_ICON[z.trend];
              const unterZiel = z.abweichung_pct < -20;
              const prog_pct  = Math.round((z.prognose_eur / maxProg) * 100);
              const akt_pct   = Math.round((z.aktuell_eur / maxProg) * 100);

              return (
                <div
                  key={z.zone}
                  className={cn(
                    'rounded-xl border px-3 py-2.5 space-y-2',
                    unterZiel
                      ? 'border-red-200 dark:border-red-800 bg-red-50/40 dark:bg-red-950/10'
                      : 'border-border bg-muted/20',
                  )}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-matcha-500 text-[10px] font-black text-white shrink-0">
                        {z.zone}
                      </span>
                      <span className="text-xs font-bold">Zone {z.zone}</span>
                      <span className="text-[10px] text-muted-foreground">{ZONE_LABEL[z.zone] ?? ''}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <TIcon className={cn('h-3.5 w-3.5', TREND_COLOR[z.trend])} />
                      <span className={cn('text-xs font-bold tabular-nums', unterZiel ? 'text-red-600' : 'text-foreground')}>
                        {z.abweichung_pct > 0 ? '+' : ''}{z.abweichung_pct}%
                      </span>
                    </div>
                  </div>

                  {/* Dual-Bar: Aktuell + Prognose */}
                  <div className="space-y-1">
                    {/* Aktuell */}
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="w-16 text-muted-foreground shrink-0">Aktuell</span>
                      <div className="flex-1 h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-matcha-400 transition-all duration-500"
                          style={{ width: `${akt_pct}%` }}
                        />
                      </div>
                      <span className="w-14 text-right font-bold tabular-nums text-foreground">
                        {z.aktuell_eur.toFixed(0)} €
                      </span>
                    </div>
                    {/* Prognose */}
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="w-16 text-muted-foreground shrink-0">+2h Prognose</span>
                      <div className="flex-1 h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-500',
                            unterZiel ? 'bg-red-400' : 'bg-blue-400',
                          )}
                          style={{ width: `${prog_pct}%` }}
                        />
                      </div>
                      <span className={cn('w-14 text-right font-black tabular-nums', unterZiel ? 'text-red-600' : 'text-blue-600')}>
                        {z.prognose_eur.toFixed(0)} €
                      </span>
                    </div>
                    {/* Ziel-Linie */}
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-0.5">
                      <span>Ziel: {z.ziel_eur} €</span>
                      <span>~{z.bestellungen_prognose} Bst.</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {zuletzt && (
            <p className="text-[10px] text-muted-foreground text-right">
              Stand: {new Date(zuletzt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · Polling 15 Min
            </p>
          )}
        </div>
      )}
    </div>
  );
}
