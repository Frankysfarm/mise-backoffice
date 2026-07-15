'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Clock, Coffee, RefreshCw } from 'lucide-react';

/**
 * Phase 1783 — Fahrer-Pausen-Compliance-Widget (Dispatch)
 *
 * Phase1781-API: Tabelle Fahrer + Pausenstatus + Warnung bei Verstoß.
 * 10-Min-Polling; in dispatch/client.tsx.
 */

interface FahrerPausenStatus {
  fahrer_id: string;
  name: string;
  schicht_dauer_h: number;
  pausen_dauer_min: number;
  pausen_pflicht_min: number;
  verstoss: boolean;
  verstoss_art: 'keine_pause' | 'pause_zu_kurz' | null;
  letzte_pause_vor_min: number | null;
}

interface Antwort {
  fahrer: FahrerPausenStatus[];
  verstoss_anzahl: number;
  location_id: string;
  generiert_am: string;
}

interface Props {
  locationId: string | null;
  className?: string;
}

function VerstossChip({ art }: { art: FahrerPausenStatus['verstoss_art'] }) {
  if (!art) return null;
  return (
    <span className="flex items-center gap-0.5 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
      <AlertTriangle className="h-2.5 w-2.5" />
      {art === 'keine_pause' ? 'Keine Pause' : 'Pause zu kurz'}
    </span>
  );
}

export function DispatchPhase1783FahrerPausenComplianceWidget({ locationId, className }: Props) {
  const [data, setData] = useState<Antwort | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  async function load() {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-pausen-compliance?location_id=${locationId}`);
      if (res.ok) {
        setData(await res.json());
        setLastFetch(new Date());
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  return (
    <div className={cn('rounded-xl border border-border bg-card mb-3', className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Coffee className="h-4 w-4 text-saffron" />
          <span className="text-sm font-bold">Fahrer-Pausen-Compliance</span>
          {loading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
          {data && data.verstoss_anzahl > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
              <AlertTriangle className="h-3 w-3" />
              {data.verstoss_anzahl} Verstoß{data.verstoss_anzahl > 1 ? 'e' : ''}
            </span>
          )}
        </div>
        {lastFetch && (
          <span className="text-[10px] text-muted-foreground">
            {lastFetch.getHours().toString().padStart(2, '0')}:{lastFetch.getMinutes().toString().padStart(2, '0')} Uhr
          </span>
        )}
      </div>

      <div className="px-4 py-3 space-y-2">
        {data && data.verstoss_anzahl > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
            <p className="text-xs font-bold text-red-800 dark:text-red-200">
              {data.verstoss_anzahl} Fahrer{data.verstoss_anzahl > 1 ? '' : '/-in'} {data.verstoss_anzahl > 1 ? 'haben' : 'hat'} Pausenpflicht verletzt — bitte informieren.
            </p>
          </div>
        )}

        {data && data.fahrer.length > 0 ? (
          <div className="space-y-1.5">
            {data.fahrer.map(f => (
              <div
                key={f.fahrer_id}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 border',
                  f.verstoss
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    : 'bg-muted/40 border-transparent',
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={cn(
                      'text-xs font-bold',
                      f.verstoss ? 'text-red-800 dark:text-red-200' : 'text-foreground',
                    )}>
                      {f.name}
                    </p>
                    {f.verstoss && <VerstossChip art={f.verstoss_art} />}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-muted-foreground">
                      Schicht {f.schicht_dauer_h.toFixed(1)}h
                    </span>
                    {f.pausen_pflicht_min > 0 && (
                      <>
                        <span className="text-[10px] text-muted-foreground">·</span>
                        <span className="text-[10px] text-muted-foreground">
                          Pause: {f.pausen_dauer_min}/{f.pausen_pflicht_min} Min
                        </span>
                      </>
                    )}
                    {f.letzte_pause_vor_min !== null && (
                      <>
                        <span className="text-[10px] text-muted-foreground">·</span>
                        <span className="text-[10px] text-muted-foreground">
                          Letzte Pause vor {f.letzte_pause_vor_min} Min
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="shrink-0">
                  {f.pausen_pflicht_min === 0 ? (
                    <span className="text-[10px] text-matcha-600 dark:text-matcha-400 font-bold">OK</span>
                  ) : f.verstoss ? (
                    <Clock className="h-4 w-4 text-red-500" />
                  ) : (
                    <span className="text-[10px] text-matcha-600 dark:text-matcha-400 font-bold">✓</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : !loading && (
          <p className="text-sm text-muted-foreground text-center py-2">
            {locationId ? 'Keine Fahrer-Daten verfügbar.' : 'Bitte Filiale auswählen.'}
          </p>
        )}
      </div>
    </div>
  );
}
