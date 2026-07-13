'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Loader2, UtensilsCrossed } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1402 — Kitchen-Stop-Gap-Widget (Dispatch)
 *
 * Visualisiert Phase1400-API: Artikel-Engpässe in der Küche:
 *   • Liste der überlasteten Artikel mit Auslastungsbalken
 *   • Ampel ok/warnung/kritisch pro Artikel
 *   • Gesamtzahl offene Bestellungen + Empfehlung
 *   • 5-Min-Polling
 *
 * Nach Phase1397 in dispatch/client.tsx einbinden.
 */

interface ArtikelEngpass {
  name: string;
  gleichzeitig: number;
  kapazitaet_geschaetzt: number;
  auslastung_pct: number;
  niveau: 'ok' | 'warnung' | 'kritisch';
}

interface StopGapData {
  engpaesse: ArtikelEngpass[];
  gesamt_offene_bestellungen: number;
  kritische_artikel_anzahl: number;
  empfehlung: string;
}

interface Props {
  locationId: string | null;
}

const NIVEAU_STYLE = {
  ok:       { bar: 'bg-green-400',   text: 'text-green-700 dark:text-green-300',   badge: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'   },
  warnung:  { bar: 'bg-yellow-400',  text: 'text-yellow-700 dark:text-yellow-300', badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
  kritisch: { bar: 'bg-red-500',     text: 'text-red-700 dark:text-red-300',       badge: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'             },
};

export function DispatchPhase1402KitchenStopGapWidget({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<StopGapData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/admin/kitchen-stop-gap-alert?location_id=${locationId}`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        // keep previous
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [locationId]);

  const hasKritisch = (data?.kritische_artikel_anzahl ?? 0) > 0;

  return (
    <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
      >
        <UtensilsCrossed className={cn('h-4 w-4', hasKritisch ? 'text-red-500' : 'text-orange-400')} />
        <span className="font-semibold text-sm">Küchen-Engpass-Monitor</span>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-1" />}
        {data && (
          <span className="ml-1 text-xs text-muted-foreground">
            {data.gesamt_offene_bestellungen} offen
            {hasKritisch && (
              <span className="ml-1 font-bold text-red-600 dark:text-red-400">· {data.kritische_artikel_anzahl} kritisch</span>
            )}
          </span>
        )}
        {hasKritisch && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
        <span className="ml-auto">{open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {!data ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              {loading ? 'Lade Küchen-Daten…' : 'Keine Daten'}
            </div>
          ) : (
            <>
              {/* Empfehlung */}
              {data.empfehlung && (
                <div className={cn(
                  'flex items-start gap-2 rounded-lg px-3 py-2 text-xs',
                  hasKritisch
                    ? 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                    : 'bg-muted/50 text-muted-foreground'
                )}>
                  {hasKritisch && <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                  {data.empfehlung}
                </div>
              )}

              {/* Artikel-Liste */}
              <div className="space-y-2">
                {data.engpaesse.map((artikel) => {
                  const s = NIVEAU_STYLE[artikel.niveau];
                  const barW = Math.min(100, artikel.auslastung_pct);
                  return (
                    <div key={artikel.name}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn('text-sm font-medium flex-1 truncate', s.text)}>{artikel.name}</span>
                        <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0', s.badge)}>
                          ×{artikel.gleichzeitig} / {artikel.auslastung_pct}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', s.bar)}
                          style={{ width: `${barW}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="text-xs text-muted-foreground text-right">5-Min-Polling</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
