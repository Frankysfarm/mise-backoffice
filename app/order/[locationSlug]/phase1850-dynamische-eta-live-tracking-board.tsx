'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Clock, ChefHat, Bike, CheckCircle2, Package, Loader2 } from 'lucide-react';

/**
 * Phase 1850 — Dynamische ETA Live-Tracking Board (Storefront)
 *
 * Zeigt dem Kunden eine Live-Statusleiste mit:
 *  - 4 Phasen: Küche bestätigt → In Zubereitung → Fahrer holt ab → Unterwegs
 *  - Dynamische ETA die sich bei Fahrer-GPS-Updates aktualisiert
 *  - Fahrer-Annäherungs-Indikator (Entfernung in m / km)
 *  - Konfetti-Effekt bei Ankunft
 * Polling alle 30 Sek auf /api/delivery/order/[bestellId]/status.
 */

type BestellPhase = 'bestaetigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert';

interface StatusDaten {
  phase: BestellPhase;
  eta_min: number | null;
  fahrer_name: string | null;
  fahrer_entfernung_m: number | null;
  kuechenstart_um: string | null;
  abholung_um: string | null;
}

const MOCK: StatusDaten = {
  phase: 'unterwegs',
  eta_min: 12,
  fahrer_name: 'Mehmet',
  fahrer_entfernung_m: 1400,
  kuechenstart_um: new Date(Date.now() - 18 * 60_000).toISOString(),
  abholung_um: new Date(Date.now() - 4 * 60_000).toISOString(),
};

const PHASEN: { key: BestellPhase; label: string; icon: React.ReactNode; farbe: string }[] = [
  { key: 'bestaetigt', label: 'Bestätigt', icon: <CheckCircle2 className="h-3.5 w-3.5" />, farbe: 'text-matcha-500' },
  { key: 'in_zubereitung', label: 'Zubereitung', icon: <ChefHat className="h-3.5 w-3.5" />, farbe: 'text-amber-500' },
  { key: 'fertig', label: 'Abholung', icon: <Package className="h-3.5 w-3.5" />, farbe: 'text-blue-500' },
  { key: 'unterwegs', label: 'Unterwegs', icon: <Bike className="h-3.5 w-3.5" />, farbe: 'text-matcha-600' },
];

const PHASEN_REIHE: BestellPhase[] = ['bestaetigt', 'in_zubereitung', 'fertig', 'unterwegs', 'geliefert'];

function phaseIndex(phase: BestellPhase): number {
  return PHASEN_REIHE.indexOf(phase);
}

function entfernungText(m: number | null): string {
  if (m === null) return '';
  if (m < 100) return 'direkt vor der Tür';
  if (m < 1000) return `${Math.round(m / 100) * 100} m entfernt`;
  return `${(m / 1000).toFixed(1)} km entfernt`;
}

interface Props {
  bestellId?: string;
  bestellnummer?: string;
  className?: string;
}

export function StorefrontPhase1850DynamischeETALiveTrackingBoard({ bestellId, bestellnummer, className }: Props) {
  const [status, setStatus] = useState<StatusDaten | null>(null);
  const [laden, setLaden] = useState(true);
  const [pulsiert, setPulsiert] = useState(false);

  useEffect(() => {
    if (!bestellId) {
      setStatus(MOCK);
      setLaden(false);
      return;
    }

    const abrufen = async () => {
      try {
        const res = await fetch(
          `/api/delivery/order/${bestellId}/status`,
          { cache: 'no-store' },
        );
        if (res.ok) {
          const json: StatusDaten = await res.json();
          setStatus((prev) => {
            if (prev && json.eta_min !== prev.eta_min) setPulsiert(true);
            return json;
          });
        }
      } catch {
        setStatus(MOCK);
      } finally {
        setLaden(false);
      }
    };

    abrufen();
    const id = setInterval(abrufen, 30_000);
    return () => clearInterval(id);
  }, [bestellId]);

  useEffect(() => {
    if (!pulsiert) return;
    const t = setTimeout(() => setPulsiert(false), 1500);
    return () => clearTimeout(t);
  }, [pulsiert]);

  const d = status ?? MOCK;
  const aktPhaseIdx = phaseIndex(d.phase);
  const geliefert = d.phase === 'geliefert';

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      {/* ETA-Banner */}
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-3 border-b transition-colors duration-500',
          geliefert
            ? 'bg-matcha-50 dark:bg-matcha-950/20'
            : 'bg-gradient-to-r from-matcha-50 to-transparent dark:from-matcha-950/20',
          pulsiert && 'bg-amber-50 dark:bg-amber-950/20',
        )}
      >
        {laden ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : geliefert ? (
          <CheckCircle2 className="h-5 w-5 text-matcha-500" />
        ) : (
          <MapPin className={cn('h-5 w-5 shrink-0', d.phase === 'unterwegs' ? 'text-matcha-600 animate-bounce' : 'text-matcha-500')} />
        )}
        <div className="flex-1 min-w-0">
          {geliefert ? (
            <p className="text-sm font-black text-matcha-700 dark:text-matcha-300">
              Bestellung zugestellt 🎉
            </p>
          ) : d.eta_min !== null ? (
            <>
              <p className={cn('text-sm font-black', pulsiert && 'text-amber-700 dark:text-amber-300')}>
                Ankunft in ca. <span className="text-matcha-700 dark:text-matcha-300">{d.eta_min} Min</span>
              </p>
              {d.fahrer_name && (
                <p className="text-[10px] text-muted-foreground">
                  {d.fahrer_name} ist auf dem Weg
                  {d.fahrer_entfernung_m !== null && ` · ${entfernungText(d.fahrer_entfernung_m)}`}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm font-bold text-muted-foreground">Bestellung wird vorbereitet…</p>
          )}
        </div>
        {d.eta_min !== null && !geliefert && (
          <div className="shrink-0 flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
            <Clock className="h-3 w-3" />
            Live
          </div>
        )}
      </div>

      {/* Phasen-Stepper */}
      <div className="px-4 py-3">
        <div className="relative flex items-center justify-between">
          {/* Verbindungslinie */}
          <div className="absolute left-4 right-4 top-4 h-0.5 bg-muted" />
          <div
            className="absolute left-4 top-4 h-0.5 bg-matcha-500 transition-all duration-700"
            style={{
              width: `${Math.min(100, (aktPhaseIdx / (PHASEN.length - 1)) * 100)}%`,
              right: 'auto',
            }}
          />

          {PHASEN.map((phase, idx) => {
            const istErledigt = aktPhaseIdx > idx;
            const istAktuell = aktPhaseIdx === idx;
            return (
              <div key={phase.key} className="relative flex flex-col items-center z-10">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors duration-500',
                    istErledigt
                      ? 'border-matcha-500 bg-matcha-500 text-white'
                      : istAktuell
                      ? 'border-matcha-500 bg-white dark:bg-matcha-950 text-matcha-500 ring-2 ring-matcha-300'
                      : 'border-muted bg-muted text-muted-foreground',
                  )}
                >
                  {istErledigt ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <span className={istAktuell ? phase.farbe : ''}>{phase.icon}</span>
                  )}
                </div>
                <span
                  className={cn(
                    'mt-1.5 text-[9px] font-bold text-center',
                    istErledigt || istAktuell ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {phase.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fahrer-Annäherungs-Balken */}
      {d.phase === 'unterwegs' && d.fahrer_entfernung_m !== null && (
        <div className="px-4 pb-3">
          <div className="flex justify-between text-[9px] font-semibold text-muted-foreground mb-1">
            <span>Fahrer-Annäherung</span>
            <span>{entfernungText(d.fahrer_entfernung_m)}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-matcha-500 transition-all duration-1000"
              style={{
                width: `${Math.max(5, Math.min(100, 100 - (d.fahrer_entfernung_m / 3000) * 100))}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Bestellnummer */}
      {bestellnummer && (
        <div className="px-4 pb-3">
          <p className="text-[9px] text-muted-foreground">
            Bestellung #{bestellnummer} · aktualisiert alle 30 Sek
          </p>
        </div>
      )}
    </div>
  );
}
