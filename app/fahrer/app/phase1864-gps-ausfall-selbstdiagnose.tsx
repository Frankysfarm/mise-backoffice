'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Phone, RefreshCw, WifiOff } from 'lucide-react';

/**
 * Phase 1864 — GPS-Ausfall-Selbstdiagnose (Fahrer-App)
 *
 * Wenn eigener GPS-Status kritisch (>10 Min kein Update): schrittweise Hilfe-Anleitung.
 * Countdown 30s → Support-Alert wenn Problem nicht gelöst wird.
 * isOnline-Guard. 1-Min-Polling.
 * GET /api/delivery/admin/gps-ausfall (Phase 1856).
 */

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

type GpsLevel = 'ok' | 'warn' | 'kritisch';

interface ApiAntwort {
  fahrer: Array<{
    id: string;
    letztes_update_vor_min: number | null;
    alert_level: GpsLevel;
  }>;
}

const SCHRITTE = [
  {
    titel: 'GPS-Berechtigung prüfen',
    beschreibung: 'Einstellungen → Apps → Mise → Standort → "Immer" auswählen.',
  },
  {
    titel: 'App neu starten',
    beschreibung: 'App vollständig schließen (aus Hintergrund-Apps entfernen) und erneut öffnen.',
  },
  {
    titel: 'Handy-GPS prüfen',
    beschreibung: 'Einstellungen → Standort → GPS einschalten. Kurz ins Freie gehen.',
  },
  {
    titel: 'Mobilfunk / WLAN prüfen',
    beschreibung: 'Flugmodus kurz an- und ausschalten. Auf Netzempfang achten.',
  },
];

export function FahrerPhase1864GpsAusfallSelbstdiagnose({ driverId, locationId, isOnline }: Props) {
  const [level, setLevel] = useState<GpsLevel | null>(null);
  const [minSeit, setMinSeit] = useState<number | null>(null);
  const [aktiverSchritt, setAktiverSchritt] = useState(0);
  const [countdown, setCountdown] = useState(30);
  const [supportAlertSent, setSupportAlertSent] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!driverId || !locationId || !isOnline) return;

    const laden = async () => {
      try {
        const res = await fetch(
          `/api/delivery/admin/gps-ausfall?location_id=${locationId}`,
          { cache: 'no-store' },
        );
        if (res.ok) {
          const json: ApiAntwort = await res.json();
          const eigener = json.fahrer?.find((f) => f.id === driverId);
          if (eigener) {
            setLevel(eigener.alert_level);
            setMinSeit(eigener.letztes_update_vor_min);
          } else {
            setLevel('ok');
          }
        }
      } catch {
        setLevel('ok');
      }
    };

    laden();
    const id = setInterval(laden, 60 * 1000);
    return () => clearInterval(id);
  }, [driverId, locationId, isOnline]);

  // Countdown starten wenn kritisch
  useEffect(() => {
    if (level === 'kritisch' && !supportAlertSent) {
      setCountdown(30);
      countdownRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            setSupportAlertSent(true);
            if (countdownRef.current) clearInterval(countdownRef.current);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    } else {
      if (countdownRef.current) clearInterval(countdownRef.current);
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [level, supportAlertSent]);

  if (!isOnline || level === null || level === 'ok') return null;

  const istKritisch = level === 'kritisch';

  return (
    <div
      className={cn(
        'rounded-2xl border overflow-hidden',
        istKritisch
          ? 'border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-950/30'
          : 'border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30',
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <WifiOff
          className={cn('h-5 w-5 shrink-0', istKritisch ? 'text-red-500' : 'text-amber-500')}
        />
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              'text-sm font-bold',
              istKritisch ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300',
            )}
          >
            {istKritisch ? 'GPS-Ausfall erkannt' : 'GPS-Signal schwach'}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {minSeit !== null
              ? `Kein GPS-Update seit ${minSeit} Min`
              : 'Standortübertragung unterbrochen'}
          </div>
        </div>
        {istKritisch && !supportAlertSent && (
          <div className="shrink-0 flex flex-col items-center">
            <div
              className={cn(
                'h-9 w-9 rounded-full flex items-center justify-center text-sm font-black',
                countdown <= 10 ? 'bg-red-500 text-white animate-pulse' : 'bg-red-100 dark:bg-red-900 text-red-600',
              )}
            >
              {countdown}
            </div>
            <div className="text-[9px] text-muted-foreground mt-0.5">Support</div>
          </div>
        )}
      </div>

      {/* Support-Alert (nach Countdown) */}
      {supportAlertSent && (
        <div className="mx-4 mb-3 rounded-xl bg-red-500 px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-white shrink-0" />
          <div className="flex-1">
            <div className="text-xs font-bold text-white">Support wurde benachrichtigt</div>
            <div className="text-[10px] text-red-100">Dein Dispatcher kontaktiert dich gleich.</div>
          </div>
          <a
            href="tel:+4924121234567"
            className="shrink-0 rounded-lg bg-white px-3 py-1.5 flex items-center gap-1.5 text-xs font-bold text-red-600"
          >
            <Phone className="h-3 w-3" />
            Anrufen
          </a>
        </div>
      )}

      {/* Hilfe-Schritte */}
      <div className="px-4 pb-4 space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
          Schritt-für-Schritt Hilfe
        </div>
        {SCHRITTE.map((schritt, i) => {
          const erledigt = i < aktiverSchritt;
          const aktiv = i === aktiverSchritt;
          return (
            <button
              key={i}
              onClick={() => setAktiverSchritt(erledigt ? i : i + 1 <= SCHRITTE.length ? i + 1 : i)}
              className={cn(
                'w-full text-left rounded-xl border px-4 py-3 flex items-start gap-3 transition',
                erledigt
                  ? 'bg-matcha-50 dark:bg-matcha-950/30 border-matcha-200 dark:border-matcha-700 opacity-70'
                  : aktiv
                  ? istKritisch
                    ? 'bg-red-100 dark:bg-red-900/40 border-red-300 dark:border-red-600'
                    : 'bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-600'
                  : 'bg-white/60 dark:bg-white/5 border-border opacity-50',
              )}
            >
              <div
                className={cn(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black',
                  erledigt
                    ? 'bg-matcha-500 text-white'
                    : aktiv
                    ? istKritisch
                      ? 'bg-red-500 text-white'
                      : 'bg-amber-500 text-white'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {erledigt ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    'text-xs font-bold',
                    erledigt
                      ? 'text-matcha-700 dark:text-matcha-300'
                      : aktiv
                      ? 'text-foreground'
                      : 'text-muted-foreground',
                  )}
                >
                  {schritt.titel}
                </div>
                {aktiv && (
                  <div className="text-[11px] text-muted-foreground mt-1">{schritt.beschreibung}</div>
                )}
              </div>
              {aktiv ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
              )}
            </button>
          );
        })}

        {/* Alle Schritte abgehakt → Erfolgs-Feedback */}
        {aktiverSchritt >= SCHRITTE.length && (
          <div className="rounded-xl bg-matcha-50 dark:bg-matcha-950/30 border border-matcha-200 dark:border-matcha-700 px-4 py-3 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-matcha-600 shrink-0" />
            <div className="flex-1">
              <div className="text-xs font-bold text-matcha-700 dark:text-matcha-300">
                Alle Schritte abgeschlossen
              </div>
              <div className="text-[11px] text-muted-foreground">
                GPS sollte jetzt aktiv sein. Kurz warten…
              </div>
            </div>
            <button
              onClick={() => {
                setAktiverSchritt(0);
                setSupportAlertSent(false);
              }}
              className="shrink-0 rounded-lg bg-matcha-100 dark:bg-matcha-900 px-3 py-1.5 flex items-center gap-1.5 text-xs font-bold text-matcha-700 dark:text-matcha-300"
            >
              <RefreshCw className="h-3 w-3" />
              Neu
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
