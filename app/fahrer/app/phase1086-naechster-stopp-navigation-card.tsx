'use client';

import { useEffect, useState } from 'react';
import { Bell, Clock, ExternalLink, MapPin, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1086 — Nächster-Stopp-Navigation-Card (Fahrer-App)
// Adresse + Google Maps Link + Klingel/Etage-Info + Timer seit Pickup

interface Stop {
  id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
  order: {
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    kunde_plz: string | null;
    kunde_lat: number | null;
    kunde_lng: number | null;
    gesamtbetrag: number;
    kunde_notiz?: string | null;
    kunde_lieferhinweis?: string | null;
    kunde_telefon?: string | null;
  };
}

interface Props {
  stops: Stop[];
  batchStartedAt: string | null;
  isOnline: boolean;
}

function mapsLink(stop: Stop): string {
  const { kunde_lat, kunde_lng, kunde_adresse, kunde_plz } = stop.order;
  if (kunde_lat && kunde_lng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${kunde_lat},${kunde_lng}`;
  }
  const addr = [kunde_adresse, kunde_plz].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;
}

function extractEtage(notiz: string): string | null {
  const m = notiz.match(/(?:etage|eg|og|dg|ebg|stock|stockwerk|hinterhaus|haus\s*[a-z]|\d+\.\s*(?:etage|og|eg))/i);
  return m ? m[0] : null;
}

function extractKlingel(notiz: string): string | null {
  const m = notiz.match(/(?:klingel|klingelschild|türschild|name\s*auf\s*klingel)[:\s]*([^\n,;.]{1,30})/i);
  return m ? m[1].trim() : null;
}

export function FahrerPhase1086NaechsterStoppNavigationCard({ stops, batchStartedAt, isOnline }: Props) {
  const [elapsedSec, setElapsedSec] = useState(0);

  const nextStop = stops.find(s => !s.geliefert_am);

  useEffect(() => {
    if (!batchStartedAt) return;
    const update = () => setElapsedSec(Math.floor((Date.now() - new Date(batchStartedAt).getTime()) / 1000));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [batchStartedAt]);

  if (!isOnline || !nextStop) return null;

  const hinweis = nextStop.order.kunde_lieferhinweis ?? nextStop.order.kunde_notiz ?? '';
  const etage = hinweis ? extractEtage(hinweis) : null;
  const klingel = hinweis ? extractKlingel(hinweis) : null;

  const elapsedMin = Math.floor(elapsedSec / 60);
  const elapsedS = elapsedSec % 60;

  return (
    <div className="rounded-xl border border-blue-400 shadow-md overflow-hidden bg-blue-50 dark:bg-blue-900/20">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-blue-600 text-white">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4" />
          <span className="text-sm font-bold">Nächster Stopp #{nextStop.reihenfolge}</span>
        </div>
        <div className="flex items-center gap-1 text-blue-100 text-xs tabular-nums">
          <Clock className="h-3 w-3" />
          <span>{elapsedMin}:{String(elapsedS).padStart(2, '0')}</span>
        </div>
      </div>

      <div className="px-4 py-3 space-y-2.5">
        {/* Kunde + Bestellnummer */}
        <div>
          <div className="text-xs text-blue-500 font-bold uppercase tracking-wide">#{nextStop.order.bestellnummer}</div>
          <div className="text-base font-bold text-foreground">{nextStop.order.kunde_name}</div>
        </div>

        {/* Adresse */}
        {(nextStop.order.kunde_adresse || nextStop.order.kunde_plz) && (
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-medium">{nextStop.order.kunde_adresse}</div>
              {nextStop.order.kunde_plz && <div className="text-xs text-muted-foreground">{nextStop.order.kunde_plz}</div>}
            </div>
          </div>
        )}

        {/* Etage / Klingel */}
        {(etage || klingel) && (
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-amber-500 shrink-0" />
            <div className="text-sm">
              {etage && <span className="font-medium capitalize">{etage}</span>}
              {etage && klingel && <span className="text-muted-foreground mx-1">·</span>}
              {klingel && <span className="text-muted-foreground">Klingel: {klingel}</span>}
            </div>
          </div>
        )}

        {/* Hinweis (raw) — nur wenn kein Extract möglich */}
        {hinweis && !etage && !klingel && (
          <div className={cn('rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-200')}>
            💬 {hinweis}
          </div>
        )}

        {/* Nav Button */}
        <a
          href={mapsLink(nextStop)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-white font-bold text-sm py-2.5 hover:bg-blue-700 active:bg-blue-800 transition"
        >
          <Navigation className="h-4 w-4" />
          Navigation starten
          <ExternalLink className="h-3 w-3 opacity-70" />
        </a>
      </div>
    </div>
  );
}
