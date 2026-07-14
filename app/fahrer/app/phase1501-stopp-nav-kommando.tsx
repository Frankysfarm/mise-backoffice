'use client';

import { useMemo, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Navigation, MapPin, Phone, CheckCircle2, Clock, Package, AlertTriangle } from 'lucide-react';

// Phase 1501 — Stopp-Nav-Kommando (Fahrer-App)
// Kompakte Navigationszentrale für den aktuellen Stopp:
// Zeigt Adresse, ETA, Kundentelefon und 1-Tap-Navigation-Button.
// Optimiert für mobile Einhand-Bedienung während der Tour.

interface Stop {
  id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
  kunde_name?: string | null;
  kunde_adresse?: string | null;
  kunde_plz?: string | null;
  kunde_stadt?: string | null;
  kunde_telefon?: string | null;
  bestellnummer?: string | null;
  eta_min?: number | null;
}

interface Props {
  stops: Stop[];
  onNavigate?: (stop: Stop) => void;
  onKundenkontakt?: (telefon: string) => void;
  onStoppAbschliessen?: (stopId: string) => void;
}

export function FahrerPhase1501StoppNavKommando({ stops, onNavigate, onKundenkontakt, onStoppAbschliessen }: Props) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const offeneStopps = useMemo(
    () => stops.filter(s => !s.geliefert_am).sort((a, b) => a.reihenfolge - b.reihenfolge),
    [stops],
  );

  const aktuell = offeneStopps[0] ?? null;
  const naechster = offeneStopps[1] ?? null;

  if (!aktuell) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-5 text-center">
        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
        <p className="text-base font-bold text-emerald-700">Alle Stopps erledigt!</p>
        <p className="text-sm text-emerald-600 mt-1">Tour abgeschlossen. Rückfahrt antritt.</p>
      </div>
    );
  }

  const adressFull = [
    aktuell.kunde_adresse,
    aktuell.kunde_plz && aktuell.kunde_stadt ? `${aktuell.kunde_plz} ${aktuell.kunde_stadt}` : (aktuell.kunde_stadt ?? null),
  ].filter(Boolean).join(', ');

  const navUrl = adressFull
    ? `https://maps.google.com/?q=${encodeURIComponent(adressFull)}`
    : null;

  const erledigt = stops.filter(s => s.geliefert_am).length;
  const gesamt = stops.length;

  return (
    <div className="space-y-3">
      {/* Fortschritts-Chip */}
      <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-stone-100 border border-stone-200">
        <span className="text-xs font-bold text-stone-600">
          Stopp {erledigt + 1} von {gesamt}
        </span>
        <div className="flex gap-1">
          {stops.map((s, i) => (
            <span
              key={s.id}
              className={cn(
                'w-2.5 h-2.5 rounded-full',
                s.geliefert_am ? 'bg-emerald-500' : i === erledigt ? 'bg-blue-500 animate-pulse' : 'bg-stone-300',
              )}
            />
          ))}
        </div>
      </div>

      {/* Haupt-Stopp-Karte */}
      <div className="rounded-2xl border-2 border-blue-300 bg-blue-50 overflow-hidden shadow-md">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-600">
          <MapPin className="w-4 h-4 text-white" />
          <span className="text-[11px] font-black uppercase tracking-widest text-white/90">
            Aktueller Stopp #{aktuell.reihenfolge}
          </span>
          {aktuell.bestellnummer && (
            <span className="ml-auto text-[11px] text-blue-200 font-mono">
              #{aktuell.bestellnummer}
            </span>
          )}
        </div>

        <div className="px-4 py-4 space-y-3">
          {/* Kundename */}
          <div>
            <p className="text-xl font-black text-blue-900 leading-tight">
              {aktuell.kunde_name ?? 'Kunde'}
            </p>
            {adressFull && (
              <p className="text-sm text-blue-700 mt-0.5">{adressFull}</p>
            )}
          </div>

          {/* ETA */}
          {aktuell.eta_min != null && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-blue-600" />
              <span className="font-semibold text-blue-800">
                ETA: ca. {aktuell.eta_min} Min
              </span>
            </div>
          )}

          {/* Navigation + Anruf */}
          <div className="flex gap-3 pt-1">
            {navUrl ? (
              <a
                href={navUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm rounded-xl py-3.5 transition-colors"
              >
                <Navigation className="w-4 h-4" />
                Navigieren
              </a>
            ) : (
              <button
                onClick={() => onNavigate?.(aktuell)}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white font-bold text-sm rounded-xl py-3.5"
              >
                <Navigation className="w-4 h-4" />
                Navigieren
              </button>
            )}

            {aktuell.kunde_telefon && (
              <a
                href={`tel:${aktuell.kunde_telefon}`}
                onClick={() => onKundenkontakt?.(aktuell.kunde_telefon!)}
                className="flex items-center justify-center gap-2 bg-white border-2 border-blue-300 text-blue-700 font-bold text-sm rounded-xl px-4 py-3.5 hover:bg-blue-50 transition-colors"
              >
                <Phone className="w-4 h-4" />
                Anrufen
              </a>
            )}
          </div>

          {/* Abschließen */}
          <button
            onClick={() => onStoppAbschliessen?.(aktuell.id)}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base rounded-xl py-4 mt-1 shadow-lg shadow-emerald-500/20 transition-colors"
          >
            <CheckCircle2 className="w-5 h-5" />
            Stopp abschließen
          </button>
        </div>
      </div>

      {/* Vorschau nächster Stopp */}
      {naechster && (
        <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 flex items-center gap-3">
          <Package className="w-4 h-4 text-stone-400 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-stone-500 uppercase tracking-wide">Nächster Stopp</p>
            <p className="text-sm font-semibold text-stone-700 truncate">
              {naechster.kunde_name ?? 'Kunde'} — {naechster.kunde_adresse ?? 'Adresse'}
            </p>
          </div>
          {naechster.eta_min != null && (
            <span className="ml-auto text-xs font-bold text-stone-500 flex-shrink-0">
              ~{naechster.eta_min} Min
            </span>
          )}
        </div>
      )}
    </div>
  );
}
