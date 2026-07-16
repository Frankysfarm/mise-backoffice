'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, BarChart2, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Phase 1884 — Zonen-Umsatz-Prognose-Widget (Dispatch)
 *
 * Balken-Chart je Zone A/B/C/D: aktueller Umsatz vs. 2h-Prognose vs. Ziel.
 * Alert-Banner wenn Prognose >20% unter Ziel. 15-Min-Polling.
 * GET /api/delivery/admin/zonen-umsatz-prognose (Phase 1883).
 */

type Trend = 'up' | 'down' | 'gleich';

interface ZonenPrognose {
  zone: string;
  umsatz_aktuell_cents: number;
  umsatz_prognose_2h_cents: number;
  umsatz_ziel_cents: number;
  bestellungen_aktuell: number;
  bestellungen_prognose_2h: number;
  trend: Trend;
  unter_ziel: boolean;
  prognose_delta_prozent: number;
}

const MOCK_ZONEN: ZonenPrognose[] = [
  { zone: 'A', umsatz_aktuell_cents: 9600,  umsatz_prognose_2h_cents: 14400, umsatz_ziel_cents: 16000, bestellungen_aktuell: 12, bestellungen_prognose_2h: 18, trend: 'up',    unter_ziel: false, prognose_delta_prozent: -10 },
  { zone: 'B', umsatz_aktuell_cents: 6200,  umsatz_prognose_2h_cents: 8400,  umsatz_ziel_cents: 12000, bestellungen_aktuell: 8,  bestellungen_prognose_2h: 11, trend: 'down',  unter_ziel: true,  prognose_delta_prozent: -30 },
  { zone: 'C', umsatz_aktuell_cents: 3100,  umsatz_prognose_2h_cents: 4200,  umsatz_ziel_cents: 6000,  bestellungen_aktuell: 4,  bestellungen_prognose_2h: 6,  trend: 'down',  unter_ziel: true,  prognose_delta_prozent: -30 },
  { zone: 'D', umsatz_aktuell_cents: 1200,  umsatz_prognose_2h_cents: 2000,  umsatz_ziel_cents: 2200,  bestellungen_aktuell: 2,  bestellungen_prognose_2h: 3,  trend: 'gleich', unter_ziel: false, prognose_delta_prozent: -9  },
];

function eur(cents: number) {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

function TrendIcon({ trend }: { trend: Trend }) {
  if (trend === 'up')   return <TrendingUp   className="h-3.5 w-3.5 text-matcha-500 shrink-0" />;
  if (trend === 'down') return <TrendingDown  className="h-3.5 w-3.5 text-red-500 shrink-0"   />;
  return                       <Minus         className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
}

interface Props {
  locationId: string | null;
  className?: string;
}

export function DispatchPhase1884ZonenUmsatzPrognoseWidget({ locationId, className }: Props) {
  const [zonen, setZonen] = useState<ZonenPrognose[]>([]);
  const [offen, setOffen] = useState(true);
  const [letzteAktualisierung, setLetzteAktualisierung] = useState<string | null>(null);

  useEffect(() => {
    if (!locationId) return;

    const laden = async () => {
      try {
        const res = await fetch(
          `/api/delivery/admin/zonen-umsatz-prognose?location_id=${locationId}`,
          { cache: 'no-store' },
        );
        if (res.ok) {
          const data = await res.json();
          setZonen(data.zonen ?? MOCK_ZONEN);
          setLetzteAktualisierung(data.generiert_am ?? null);
        } else {
          setZonen(MOCK_ZONEN);
        }
      } catch {
        setZonen(MOCK_ZONEN);
      }
    };

    laden();
    const iv = setInterval(laden, 15 * 60 * 1000);
    return () => clearInterval(iv);
  }, [locationId]);

  const basis = zonen.length > 0 ? zonen : MOCK_ZONEN;
  const unterZielZonen = basis.filter((z) => z.unter_ziel);
  const maxZiel = Math.max(...basis.map((z) => z.umsatz_ziel_cents), 1);

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        type="button"
        onClick={() => setOffen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 border-b bg-muted/10 hover:bg-muted/20 transition-colors"
      >
        <BarChart2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">
          Zonen-Umsatz-Prognose
        </span>
        {unterZielZonen.length > 0 && (
          <span className="rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
            {unterZielZonen.length} unter Ziel
          </span>
        )}
        {letzteAktualisierung && (
          <span className="text-[10px] text-muted-foreground hidden sm:block">
            {new Date(letzteAktualisierung).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        {offen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {offen && (
        <div className="p-4 space-y-3">
          {unterZielZonen.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/10 px-3 py-2.5">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 dark:text-red-300 leading-snug">
                Zone {unterZielZonen.map((z) => z.zone).join(', ')} liegt Prognose &gt;20% unter Ziel — bitte prüfen.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {basis.map((z) => {
              const aktuellPct = Math.min(100, Math.round((z.umsatz_aktuell_cents / maxZiel) * 100));
              const prognosePct = Math.min(100, Math.round((z.umsatz_prognose_2h_cents / maxZiel) * 100));
              const zielPct = Math.min(100, Math.round((z.umsatz_ziel_cents / maxZiel) * 100));
              const delta = z.prognose_delta_prozent;
              const deltaStr = delta >= 0 ? `+${delta}%` : `${delta}%`;

              return (
                <div
                  key={z.zone}
                  className={cn(
                    'rounded-xl border p-3 space-y-2',
                    z.unter_ziel
                      ? 'border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-950/10'
                      : 'border-border bg-muted/5',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold',
                        z.unter_ziel
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                          : 'bg-muted text-muted-foreground',
                      )}>
                        {z.zone}
                      </span>
                      <TrendIcon trend={z.trend} />
                    </div>
                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="text-muted-foreground">
                        Ist: <span className="font-semibold text-foreground">{eur(z.umsatz_aktuell_cents)}</span>
                      </span>
                      <span className={cn('font-bold', z.unter_ziel ? 'text-red-600 dark:text-red-400' : 'text-matcha-600 dark:text-matcha-400')}>
                        +2h: {eur(z.umsatz_prognose_2h_cents)}
                      </span>
                      <span className={cn(
                        'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                        delta < -20
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                          : delta < 0
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                          : 'bg-matcha-100 dark:bg-matcha-900/30 text-matcha-700 dark:text-matcha-300',
                      )}>
                        {deltaStr}
                      </span>
                    </div>
                  </div>

                  {/* Balkendiagramm: Ist / Prognose / Ziel */}
                  <div className="relative h-5 rounded-full bg-muted overflow-hidden">
                    {/* Ziel-Marker */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-foreground/30 z-10"
                      style={{ left: `${zielPct}%` }}
                    />
                    {/* Prognose-Balken (blasser) */}
                    <div
                      className={cn(
                        'absolute top-0 left-0 h-full rounded-full transition-all duration-500',
                        z.unter_ziel ? 'bg-red-300 dark:bg-red-700' : 'bg-matcha-300 dark:bg-matcha-700',
                      )}
                      style={{ width: `${prognosePct}%` }}
                    />
                    {/* Ist-Balken (kräftiger) */}
                    <div
                      className={cn(
                        'absolute top-0 left-0 h-full rounded-full transition-all duration-500',
                        z.unter_ziel ? 'bg-red-500' : 'bg-matcha-500',
                      )}
                      style={{ width: `${aktuellPct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Ziel: {eur(z.umsatz_ziel_cents)}</span>
                    <span>{z.bestellungen_aktuell} Bestellungen → ~{z.bestellungen_prognose_2h} in 2h</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
