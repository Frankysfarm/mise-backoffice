'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, Coffee } from 'lucide-react';

/**
 * Phase 1784 — Eigene Pause-Erinnerung (Fahrer-App)
 *
 * Alert wenn Schicht >6h ohne ausreichende Pause (30 Min).
 * Countdown bis nächste empfohlene Pause; isOnline-Guard; 5-Min-Polling.
 */

interface PauseErinnerungAntwort {
  fahrer_id: string;
  schicht_dauer_h: number;
  pausen_dauer_min: number;
  naechste_pause_in_min: number | null;
  pause_pflicht_aktiv: boolean;
  pause_ausreichend: boolean;
  hinweis: string | null;
}

interface Props {
  driverId: string | null;
  isOnline: boolean;
  className?: string;
}

async function fetchPauseStatus(driverId: string): Promise<PauseErinnerungAntwort> {
  try {
    const res = await fetch(`/api/delivery/driver/pause-erinnerung?driver_id=${driverId}`);
    if (res.ok) return res.json();
  } catch {}
  // Mock: simulate >6h shift without enough pause
  const schicht = 6.5;
  const pausen = 10;
  return {
    fahrer_id: driverId,
    schicht_dauer_h: schicht,
    pausen_dauer_min: pausen,
    naechste_pause_in_min: 20,
    pause_pflicht_aktiv: schicht >= 6,
    pause_ausreichend: pausen >= 30,
    hinweis: pausen < 30 ? 'Bitte mach bald eine Pause — du bist seit über 6 Stunden im Einsatz.' : null,
  };
}

export function FahrerPhase1784EigenePauseErinnerung({ driverId, isOnline, className }: Props) {
  const [data, setData] = useState<PauseErinnerungAntwort | null>(null);

  async function load() {
    if (!driverId) return;
    const result = await fetchPauseStatus(driverId);
    setData(result);
  }

  useEffect(() => {
    if (!isOnline || !driverId) return;
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, driverId]);

  if (!isOnline || !data) return null;
  // Only show if pause is relevant (shift ≥ 6h)
  if (!data.pause_pflicht_aktiv) return null;
  // Hide if pause is sufficient
  if (data.pause_ausreichend) return null;

  const dringend = data.schicht_dauer_h >= 7 && !data.pause_ausreichend;

  return (
    <div className={cn(
      'rounded-xl border p-4 mb-3',
      dringend
        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
      className,
    )}>
      <div className="flex items-start gap-3">
        <Coffee className={cn(
          'h-5 w-5 shrink-0 mt-0.5',
          dringend ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400',
        )} />
        <div className="flex-1 space-y-1">
          <p className={cn(
            'text-sm font-bold',
            dringend ? 'text-red-800 dark:text-red-200' : 'text-amber-800 dark:text-amber-200',
          )}>
            {dringend ? '⚠ Pause dringend erforderlich!' : 'Pause empfohlen'}
          </p>
          {data.hinweis && (
            <p className={cn(
              'text-xs',
              dringend ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300',
            )}>
              {data.hinweis}
            </p>
          )}

          <div className="flex items-center gap-4 mt-2 flex-wrap">
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Schicht</p>
              <p className={cn(
                'text-sm font-black tabular-nums',
                dringend ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300',
              )}>
                {data.schicht_dauer_h.toFixed(1)}h
              </p>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Pausen</p>
              <p className={cn(
                'text-sm font-black tabular-nums',
                dringend ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300',
              )}>
                {data.pausen_dauer_min} / 30 Min
              </p>
            </div>
            {data.naechste_pause_in_min !== null && (
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <div>
                  <p className="text-[9px] text-muted-foreground">Empfohlen in</p>
                  <p className="text-sm font-black tabular-nums text-foreground">
                    {data.naechste_pause_in_min} Min
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
