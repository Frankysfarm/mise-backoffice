'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Target, ChevronDown, ChevronUp, Trophy, Clock } from 'lucide-react';

/**
 * Phase 1900 — Schicht-Ziel-Fortschritt (Fahrer-App)
 *
 * Fortschrittsbalken Verdienst-Ziel heute; Schicht-Countdown;
 * Motivations-Badge bei Zielerreichung. isOnline-Guard; Collapsible; 10-Min-Polling.
 */

interface SchichtZielDaten {
  ziel_euro: number;
  verdient_euro: number;
  fortschritt_pct: number;
  ziel_erreicht: boolean;
  schicht_ende_utc: string | null;
  verbleibende_min: number | null;
  motivations_text: string;
}

const MOCK: SchichtZielDaten = {
  ziel_euro: 100,
  verdient_euro: 67.5,
  fortschritt_pct: 67.5,
  ziel_erreicht: false,
  schicht_ende_utc: null,
  verbleibende_min: 180,
  motivations_text: 'Du bist auf gutem Weg — noch 32,50 € bis zum Tagesziel!',
};

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
  className?: string;
}

export function FahrerPhase1900SchichtZielFortschritt({ driverId, locationId, isOnline, className }: Props) {
  const [daten, setDaten] = useState<SchichtZielDaten | null>(null);
  const [offen, setOffen] = useState(true);

  useEffect(() => {
    if (!isOnline || !driverId || !locationId) return;

    const laden = async () => {
      try {
        const res = await fetch(
          `/api/delivery/driver/schicht-ziel-fortschritt?driver_id=${driverId}&location_id=${locationId}`,
        );
        if (!res.ok) throw new Error('API Fehler');
        setDaten(await res.json());
      } catch {
        setDaten(MOCK);
      }
    };

    laden();
    const id = setInterval(laden, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [isOnline, driverId, locationId]);

  if (!isOnline || !daten) return null;

  const fehlendEuro = Math.max(0, daten.ziel_euro - daten.verdient_euro);
  const balkenBreite = Math.min(100, Math.round(daten.fortschritt_pct));
  const balkenFarbe =
    daten.ziel_erreicht
      ? 'bg-green-500'
      : daten.fortschritt_pct >= 75
      ? 'bg-amber-500'
      : 'bg-blue-500';

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <Target className="h-4 w-4 text-blue-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Schicht-Ziel</span>
        {daten.ziel_erreicht && (
          <span className="ml-1 text-[10px] font-bold rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 flex items-center gap-1">
            <Trophy className="h-3 w-3" /> Erreicht!
          </span>
        )}
        {!daten.ziel_erreicht && (
          <span className="ml-1 text-[10px] font-semibold text-muted-foreground">
            {balkenBreite}%
          </span>
        )}
        {offen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
        )}
      </button>

      {offen && (
        <div className="p-4 space-y-3">
          {/* Ziel-erreicht Banner */}
          {daten.ziel_erreicht && (
            <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 px-4 py-3 flex items-center gap-3">
              <Trophy className="h-8 w-8 text-yellow-500 shrink-0" />
              <div>
                <p className="text-sm font-bold text-green-800 dark:text-green-200">Tagesziel erreicht!</p>
                <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
                  {daten.verdient_euro.toFixed(2)} € verdient — Ziel: {daten.ziel_euro.toFixed(2)} €
                </p>
              </div>
            </div>
          )}

          {/* Fortschritts-KPIs */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border bg-muted/30 px-3 py-2 text-center">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Verdient</div>
              <div className="text-lg font-black tabular-nums mt-0.5 text-green-600 dark:text-green-400">
                {daten.verdient_euro.toFixed(2)} €
              </div>
            </div>
            <div className="rounded-xl border bg-muted/30 px-3 py-2 text-center">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Tagesziel</div>
              <div className="text-lg font-black tabular-nums mt-0.5">
                {daten.ziel_euro.toFixed(2)} €
              </div>
            </div>
          </div>

          {/* Fortschrittsbalken */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground">Fortschritt</span>
              <span className="text-[10px] font-bold tabular-nums">{balkenBreite}%</span>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', balkenFarbe)}
                style={{ width: `${balkenBreite}%` }}
              />
            </div>
            {!daten.ziel_erreicht && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Noch <span className="font-bold text-foreground">{fehlendEuro.toFixed(2)} €</span> bis zum Ziel
              </p>
            )}
          </div>

          {/* Schicht-Countdown */}
          {daten.verbleibende_min !== null && (
            <div className="rounded-xl border bg-muted/30 px-3 py-2 flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <span className="text-xs text-muted-foreground">Schicht noch</span>
                <span className="text-sm font-bold tabular-nums ml-2">
                  {daten.verbleibende_min >= 60
                    ? `${Math.floor(daten.verbleibende_min / 60)}h ${daten.verbleibende_min % 60}min`
                    : `${daten.verbleibende_min} min`}
                </span>
              </div>
            </div>
          )}

          {/* Motivationstext */}
          <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 px-3 py-2">
            <p className="text-xs text-blue-800 dark:text-blue-200">{daten.motivations_text}</p>
          </div>

          <p className="text-[10px] text-muted-foreground text-right">Aktualisierung alle 10 Min</p>
        </div>
      )}
    </div>
  );
}
