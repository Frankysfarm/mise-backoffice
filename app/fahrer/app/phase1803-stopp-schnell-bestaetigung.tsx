'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, MapPin, Clock, MessageSquare, Send, Loader2 } from 'lucide-react';

/**
 * Phase 1803 — Stopp-Schnell-Bestätigung (Fahrer-App)
 *
 * Schnell-Panel zum Bestätigen des aktuellen Tour-Stopps:
 * Adresse, ETA, optionale Notiz, Bestätigungs-Button.
 * Nutzt /api/delivery/driver/stopp-bestaetigen (Mock-Fallback).
 * isOnline-Guard; kein Polling nötig.
 */

interface AktiverStopp {
  stopp_nr: number;
  adresse: string;
  kunde_name?: string | null;
  bestellnummer?: string | null;
  eta_min?: number | null;
  lat?: number | null;
  lng?: number | null;
}

interface Props {
  driverId: string | null;
  isOnline: boolean;
  className?: string;
}

function buildMockStopp(): AktiverStopp {
  return {
    stopp_nr: 2,
    adresse: 'Unter den Linden 5, 10117 Berlin',
    kunde_name: 'M. Schulz',
    bestellnummer: '#1039',
    eta_min: 4,
    lat: 52.5166,
    lng: 13.3897,
  };
}

type Phase = 'idle' | 'senden' | 'erfolg' | 'fehler';

export function FahrerPhase1803StoppSchnellBestaetigung({ driverId, isOnline, className }: Props) {
  const [stopp, setStopp] = useState<AktiverStopp | null>(null);
  const [notiz, setNotiz] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [showNotiz, setShowNotiz] = useState(false);

  useEffect(() => {
    if (!driverId || !isOnline) {
      setStopp(buildMockStopp());
      return;
    }
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/driver/tour-stops?driver_id=${driverId}`);
        if (res.ok) {
          const json = await res.json();
          const aktiv = (json.stopps ?? []).find((s: AktiverStopp) => s.stopp_nr && (json.stopps ?? []).some((x: { status?: string; stopp_nr: number }) => x.status === 'aktiv' && x.stopp_nr === s.stopp_nr));
          setStopp(aktiv ?? buildMockStopp());
        } else {
          setStopp(buildMockStopp());
        }
      } catch {
        setStopp(buildMockStopp());
      }
    };
    load();
  }, [driverId, isOnline]);

  const bestaetigen = useCallback(async () => {
    if (!stopp || phase === 'senden') return;
    setPhase('senden');
    try {
      const res = await fetch('/api/delivery/driver/stopp-bestaetigen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: driverId, stopp_nr: stopp.stopp_nr, notiz: notiz || undefined }),
      });
      setPhase(res.ok ? 'erfolg' : 'fehler');
    } catch {
      setPhase('fehler');
    }
    setTimeout(() => setPhase('idle'), 3000);
  }, [stopp, phase, driverId, notiz]);

  if (!isOnline || !stopp) return null;

  const mapsUrl = stopp.lat && stopp.lng
    ? `https://maps.google.com/?q=${stopp.lat},${stopp.lng}`
    : `https://maps.google.com/?q=${encodeURIComponent(stopp.adresse)}`;

  return (
    <div className={cn('rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <MapPin className="h-4 w-4 shrink-0 text-matcha-600" />
        <span className="font-display text-sm font-bold uppercase tracking-wider truncate">
          Aktueller Stopp
        </span>
        {stopp.bestellnummer && (
          <span className="rounded-full bg-matcha-50 dark:bg-matcha-950/30 border border-matcha-200 dark:border-matcha-800 px-2 py-0.5 text-[10px] font-bold text-matcha-700 dark:text-matcha-300">
            {stopp.bestellnummer}
          </span>
        )}
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Adresse */}
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 hover:bg-muted/50 transition-colors"
        >
          <MapPin className="h-4 w-4 shrink-0 text-matcha-600 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-foreground leading-tight">{stopp.adresse}</div>
            {stopp.kunde_name && (
              <div className="text-[11px] text-muted-foreground mt-0.5">{stopp.kunde_name}</div>
            )}
          </div>
          {stopp.eta_min !== null && stopp.eta_min !== undefined && (
            <div className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-matcha-700 dark:text-matcha-300">
              <Clock className="h-3 w-3" />
              {stopp.eta_min} Min
            </div>
          )}
        </a>

        {/* Notiz-Toggle */}
        <button
          onClick={() => setShowNotiz(v => !v)}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <MessageSquare className="h-3 w-3" />
          {showNotiz ? 'Notiz ausblenden' : 'Notiz hinzufügen'}
        </button>

        {showNotiz && (
          <textarea
            value={notiz}
            onChange={e => setNotiz(e.target.value)}
            placeholder="Notiz zum Stopp (z.B. Klingel defekt, Hintereingang)…"
            rows={2}
            className="w-full rounded-lg border bg-muted/30 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-matcha-500 placeholder:text-muted-foreground"
          />
        )}

        {/* Bestätigungs-Button */}
        <button
          onClick={bestaetigen}
          disabled={phase === 'senden' || phase === 'erfolg'}
          className={cn(
            'w-full flex items-center justify-center gap-2 rounded-xl py-3 font-bold text-sm transition-all',
            phase === 'erfolg'
              ? 'bg-matcha-500 text-white cursor-default'
              : phase === 'fehler'
              ? 'bg-red-500 text-white'
              : phase === 'senden'
              ? 'bg-matcha-400 text-white cursor-not-allowed'
              : 'bg-matcha-600 hover:bg-matcha-700 text-white active:scale-95',
          )}
        >
          {phase === 'senden' ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Wird bestätigt…</>
          ) : phase === 'erfolg' ? (
            <><CheckCircle2 className="h-4 w-4" /> Stopp bestätigt!</>
          ) : phase === 'fehler' ? (
            <><Send className="h-4 w-4" /> Fehler — erneut versuchen</>
          ) : (
            <><CheckCircle2 className="h-4 w-4" /> Stopp #{stopp.stopp_nr} bestätigen</>
          )}
        </button>
      </div>
    </div>
  );
}
