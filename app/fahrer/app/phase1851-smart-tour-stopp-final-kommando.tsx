'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  CheckCircle2, ChevronRight, Clock, MapPin, Navigation, Package, Phone, Route, Zap,
} from 'lucide-react';

/**
 * Phase 1851 — Smart Tour-Stopp Final-Kommando (Fahrer-App)
 *
 * Primäre Navigation-Karte für die Fahrer-App:
 * - Aktueller Stopp mit Adresse und ETA-Countdown
 * - Fortschrittsanzeige (Stops erledigt / gesamt)
 * - Schnell-Aktionen: Navigation starten, Anrufen, Bestätigen
 * - Nächste Stopps als Vorschau
 * Mobile-first, großer Touch-Bereich
 */

interface TourStop {
  id: string;
  position?: number;
  address: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  status: string;
  eta?: string | null;
  order_id?: string;
  bestellnummer?: string | null;
}

interface Props {
  stops: TourStop[];
  onNavigate?: (stop: TourStop) => void;
  onConfirm?: (stop: TourStop) => void;
  onCall?: (phone: string) => void;
}

function useCountdown(eta: string | null | undefined): string {
  const [label, setLabel] = useState('—');
  useEffect(() => {
    if (!eta) { setLabel('—'); return; }
    const update = () => {
      const sek = Math.floor((new Date(eta).getTime() - Date.now()) / 1000);
      if (sek <= 0) { setLabel('Jetzt'); return; }
      const m = Math.floor(sek / 60);
      const s = sek % 60;
      setLabel(`${m}:${String(s).padStart(2, '0')}`);
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [eta]);
  return label;
}

function AktuellerStoppKarte({ stop, onNavigate, onConfirm, onCall }: {
  stop: TourStop;
  onNavigate?: (s: TourStop) => void;
  onConfirm?: (s: TourStop) => void;
  onCall?: (phone: string) => void;
}) {
  const countdown = useCountdown(stop.eta);

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.address)}`;

  return (
    <div className="rounded-2xl border-2 border-matcha-500 bg-matcha-50 p-4 shadow-lg">
      {/* Badge */}
      <div className="flex items-center justify-between mb-3">
        <span className="flex items-center gap-1.5 text-xs font-bold text-matcha-700 bg-matcha-100 px-2.5 py-1 rounded-full">
          <Zap className="h-3 w-3" />
          Aktueller Stopp
        </span>
        {stop.eta && (
          <div className="text-right">
            <div className="font-mono font-black text-2xl text-matcha-800 tabular-nums leading-none">
              {countdown}
            </div>
            <div className="text-[9px] text-matcha-600 font-semibold">Min verbleibend</div>
          </div>
        )}
      </div>

      {/* Adresse */}
      <div className="flex items-start gap-2 mb-3">
        <MapPin className="h-4 w-4 text-matcha-600 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-gray-900 leading-snug">{stop.address}</p>
          {stop.customer_name && (
            <p className="text-xs text-gray-500 mt-0.5">{stop.customer_name}</p>
          )}
          {stop.bestellnummer && (
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">#{stop.bestellnummer}</p>
          )}
        </div>
      </div>

      {/* Aktions-Buttons */}
      <div className="grid grid-cols-3 gap-2">
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-1 rounded-xl bg-matcha-600 text-white py-3 px-2 active:opacity-80 transition-opacity"
        >
          <Navigation className="h-5 w-5" />
          <span className="text-[10px] font-bold">Navi</span>
        </a>
        {stop.customer_phone && onCall && (
          <button
            onClick={() => onCall(stop.customer_phone!)}
            className="flex flex-col items-center gap-1 rounded-xl bg-white border border-gray-200 text-gray-700 py-3 px-2 active:bg-gray-50 transition-colors"
          >
            <Phone className="h-5 w-5" />
            <span className="text-[10px] font-bold">Anrufen</span>
          </button>
        )}
        <button
          onClick={() => onConfirm?.(stop)}
          className={cn(
            'flex flex-col items-center gap-1 rounded-xl py-3 px-2 transition-colors active:opacity-80',
            stop.customer_phone && onCall ? 'bg-green-600 text-white' : 'col-span-2 bg-green-600 text-white'
          )}
        >
          <CheckCircle2 className="h-5 w-5" />
          <span className="text-[10px] font-bold">Geliefert</span>
        </button>
      </div>
    </div>
  );
}

function NaechsterStoppVorschau({ stop, position }: { stop: TourStop; position: number }) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-white border border-gray-100">
      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
        <span className="text-xs font-bold text-gray-600">{position}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-800 truncate">{stop.address}</p>
        {stop.customer_name && (
          <p className="text-[10px] text-gray-500 truncate">{stop.customer_name}</p>
        )}
      </div>
      {stop.eta && (
        <div className="text-[10px] font-bold text-muted-foreground shrink-0 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {Math.max(0, Math.round((new Date(stop.eta).getTime() - Date.now()) / 60_000))} Min
        </div>
      )}
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
    </div>
  );
}

export function FahrerPhase1851SmartTourStoppFinalKommando({ stops, onNavigate, onConfirm, onCall }: Props) {
  const sorted = useMemo(
    () => [...stops].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    [stops]
  );

  const pending = sorted.filter((s) => !['delivered', 'geliefert', 'abgeschlossen'].includes(s.status));
  const done = sorted.filter((s) => ['delivered', 'geliefert', 'abgeschlossen'].includes(s.status));

  const aktuell = pending[0] ?? null;
  const naechste = pending.slice(1, 4);

  const pct = sorted.length > 0 ? Math.round((done.length / sorted.length) * 100) : 0;

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center">
        <Route className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-40" />
        <p className="text-sm text-muted-foreground">Keine aktive Tour</p>
      </div>
    );
  }

  if (!aktuell) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center">
        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-matcha-600" />
        <p className="font-bold text-sm text-matcha-700">Tour abgeschlossen!</p>
        <p className="text-xs text-muted-foreground mt-1">Alle {sorted.length} Stopps erledigt</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Fortschrittsleiste */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-matcha-500 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center gap-1 text-xs font-bold text-muted-foreground shrink-0">
          <Package className="h-3.5 w-3.5" />
          {done.length}/{sorted.length}
        </div>
      </div>

      {/* Aktueller Stopp */}
      <AktuellerStoppKarte
        stop={aktuell}
        onNavigate={onNavigate}
        onConfirm={onConfirm}
        onCall={onCall}
      />

      {/* Nächste Stopps */}
      {naechste.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 px-1">
            Nächste Stopps
          </p>
          <div className="space-y-1.5">
            {naechste.map((s, i) => (
              <NaechsterStoppVorschau key={s.id} stop={s} position={done.length + i + 2} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
