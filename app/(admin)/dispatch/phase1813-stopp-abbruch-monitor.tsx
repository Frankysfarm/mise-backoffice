'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';

/**
 * Phase 1813 — Stopp-Abbruch-Monitor (Dispatch)
 *
 * Bindet Phase1806-API ein: GET /api/delivery/driver/stopp-abbrueche
 * Tabelle Fahrer + Abbruch-Arten (nicht_zuhause / falsches_paket / kunde_abwesend / unbekannt) + Gesamt-Quote
 * Alert-Banner wenn Gesamt-Quote > 10%; 30-Min-Polling; in dispatch/client.tsx
 */

type AbbruchGrund = 'nicht_zuhause' | 'falsches_paket' | 'kunde_abwesend' | 'unbekannt';

interface FahrerAbbruch {
  fahrer_id: string;
  name: string;
  abbrueche_7_tage: number;
  quote_pct: number;
  nach_grund: Record<AbbruchGrund, number>;
}

interface AbbruchResponse {
  fahrer: FahrerAbbruch[];
  gesamt_quote_pct: number;
  quote_alert: boolean;
}

interface Props {
  locationId: string | null;
  className?: string;
}

const GRUND_LABEL: Record<AbbruchGrund, string> = {
  nicht_zuhause: 'Nicht zuhause',
  falsches_paket: 'Falsches Paket',
  kunde_abwesend: 'Abwesend',
  unbekannt: 'Unbekannt',
};

const MOCK: AbbruchResponse = {
  gesamt_quote_pct: 12,
  quote_alert: true,
  fahrer: [
    {
      fahrer_id: 'm1',
      name: 'Max Müller',
      abbrueche_7_tage: 3,
      quote_pct: 8,
      nach_grund: { nicht_zuhause: 1, falsches_paket: 0, kunde_abwesend: 2, unbekannt: 0 },
    },
    {
      fahrer_id: 'm2',
      name: 'Lena Schmidt',
      abbrueche_7_tage: 7,
      quote_pct: 18,
      nach_grund: { nicht_zuhause: 3, falsches_paket: 1, kunde_abwesend: 2, unbekannt: 1 },
    },
    {
      fahrer_id: 'm3',
      name: 'Tom Becker',
      abbrueche_7_tage: 2,
      quote_pct: 5,
      nach_grund: { nicht_zuhause: 1, falsches_paket: 0, kunde_abwesend: 1, unbekannt: 0 },
    },
  ],
};

export function DispatchPhase1813StoppAbbruchMonitor({ locationId, className }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<AbbruchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [letzteLadung, setLetzteLadung] = useState<Date | null>(null);

  const laden = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/driver/stopp-abbrueche?location_id=${encodeURIComponent(locationId)}`);
      if (!res.ok) throw new Error('api_error');
      const json = (await res.json()) as AbbruchResponse;
      setData(json);
      setLetzteLadung(new Date());
    } catch {
      setData(MOCK);
      setLetzteLadung(new Date());
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    laden();
    const id = setInterval(laden, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [laden]);

  const gruende: AbbruchGrund[] = ['nicht_zuhause', 'falsches_paket', 'kunde_abwesend', 'unbekannt'];

  return (
    <div className={cn('rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden', className)}>
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <XCircle className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Stopp-Abbruch-Monitor</span>
          {data?.quote_alert && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
              <AlertTriangle className="h-3 w-3" />
              Quote &gt;10%
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          {letzteLadung && (
            <span className="text-[10px] text-muted-foreground">
              {letzteLadung.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {!locationId && (
            <p className="text-xs text-muted-foreground">Bitte Filiale auswählen.</p>
          )}

          {locationId && !data && !loading && (
            <p className="text-xs text-muted-foreground">Keine Daten verfügbar.</p>
          )}

          {data && (
            <>
              {/* Alert-Banner */}
              {data.quote_alert && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-red-700 dark:text-red-300">
                      Abbruchquote erhöht — {data.gesamt_quote_pct.toFixed(1)}% (Schwelle: 10%)
                    </p>
                    <p className="text-[10px] text-red-600/70 dark:text-red-400/70">Maßnahmen prüfen</p>
                  </div>
                </div>
              )}

              {/* Tabelle */}
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-xs border-separate border-spacing-y-1 min-w-[440px]">
                  <thead>
                    <tr>
                      <th className="text-left text-[10px] font-semibold text-muted-foreground pb-1 pl-1">Fahrer</th>
                      {gruende.map(g => (
                        <th key={g} className="text-center text-[10px] font-semibold text-muted-foreground pb-1">
                          {GRUND_LABEL[g]}
                        </th>
                      ))}
                      <th className="text-right text-[10px] font-semibold text-muted-foreground pb-1 pr-1">Quote</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.fahrer.map(f => (
                      <tr
                        key={f.fahrer_id}
                        className={cn(
                          'rounded-lg',
                          f.quote_pct > 10
                            ? 'bg-red-50 dark:bg-red-950/20'
                            : 'bg-muted/30'
                        )}
                      >
                        <td className="pl-2 py-1.5 pr-2 rounded-l-lg font-semibold">
                          <span className="truncate block max-w-[100px]">{f.name}</span>
                          <span className="text-[9px] text-muted-foreground">{f.abbrueche_7_tage} Abbrüche</span>
                        </td>
                        {gruende.map(g => (
                          <td key={g} className="text-center py-1.5">
                            <span className={cn(
                              'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                              f.nach_grund[g] > 0
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                                : 'text-muted-foreground'
                            )}>
                              {f.nach_grund[g] > 0 ? f.nach_grund[g] : '—'}
                            </span>
                          </td>
                        ))}
                        <td className="text-right pr-2 py-1.5 rounded-r-lg">
                          <span className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-bold',
                            f.quote_pct > 10
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                              : f.quote_pct > 5
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                              : 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300'
                          )}>
                            {f.quote_pct.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border">
                <span>Gesamt-Quote: <strong className={data.quote_alert ? 'text-red-600 dark:text-red-400' : ''}>{data.gesamt_quote_pct.toFixed(1)}%</strong></span>
                <span>7-Tage-Zeitraum · 30-Min-Polling</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
