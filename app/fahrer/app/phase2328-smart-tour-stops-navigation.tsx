'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, ExternalLink, MapPin, Navigation, Phone } from 'lucide-react';

type StoppStatus = 'pending' | 'active' | 'completed';

type TourStopp = {
  id: string;
  reihenfolge: number;
  kunde_name: string | null;
  kunde_adresse: string | null;
  kunde_telefon: string | null;
  gesamtbetrag: number | null;
  geliefert_am: string | null;
  eta_min: number | null;
  distanz_km: number | null;
  notizen?: string | null;
};

function stoppStatus(s: TourStopp, idx: number, stopps: TourStopp[]): StoppStatus {
  if (s.geliefert_am) return 'completed';
  const prevAllDone = stopps.slice(0, idx).every((p) => !!p.geliefert_am);
  if (prevAllDone && !s.geliefert_am) return 'active';
  return 'pending';
}

function navUrl(adresse: string | null): string {
  if (!adresse) return '#';
  const encoded = encodeURIComponent(adresse);
  return `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
}

function statusLabel(s: StoppStatus): string {
  if (s === 'completed') return 'Geliefert';
  if (s === 'active') return 'Aktuell';
  return 'Ausstehend';
}

function statusBg(s: StoppStatus): string {
  if (s === 'completed') return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
  if (s === 'active') return 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 ring-1 ring-blue-400 dark:ring-blue-600';
  return 'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700';
}

function statusDot(s: StoppStatus): string {
  if (s === 'completed') return 'bg-green-500';
  if (s === 'active') return 'bg-blue-500 animate-pulse';
  return 'bg-gray-400';
}

type Props = {
  stops: TourStopp[];
  batchId?: string;
};

export function FahrerPhase2328SmartTourStopsNavigation({ stops, batchId }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [open, setOpen] = useState(true);

  const enriched = useMemo(
    () =>
      stops
        .slice()
        .sort((a, b) => a.reihenfolge - b.reihenfolge)
        .map((s, idx, arr) => ({ ...s, _status: stoppStatus(s, idx, arr) })),
    [stops],
  );

  const aktuellerStopp = enriched.find((s) => s._status === 'active');
  const erledigtCount = enriched.filter((s) => s._status === 'completed').length;
  const fortschrittPct = Math.round((erledigtCount / Math.max(1, enriched.length)) * 100);

  if (!stops.length) return null;

  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4 mb-3">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between gap-2"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="font-semibold text-blue-800 dark:text-blue-200 text-sm">
            Tour-Stopps Navigation
          </span>
          <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">
            {erledigtCount}/{enriched.length} erledigt
          </span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-blue-500 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-blue-500 shrink-0" />
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {/* Fortschrittsbalken */}
          <div className="rounded-lg bg-white dark:bg-gray-800 border border-blue-100 dark:border-blue-900 p-2.5">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Tour-Fortschritt</span>
              <span className="text-xs font-bold text-blue-700 dark:text-blue-300 tabular-nums">{fortschrittPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-500"
                style={{ width: `${fortschrittPct}%` }}
              />
            </div>
          </div>

          {/* Aktueller Stopp Hero */}
          {aktuellerStopp && (
            <div className="rounded-xl border-2 border-blue-400 dark:border-blue-600 bg-white dark:bg-gray-800 p-3.5 shadow-sm">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Aktueller Stopp · {aktuellerStopp.reihenfolge} von {enriched.length}
                </span>
              </div>
              <div className="font-bold text-base text-gray-900 dark:text-white mb-0.5">
                {aktuellerStopp.kunde_name ?? 'Kunde'}
              </div>
              <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300 mb-2">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                {aktuellerStopp.kunde_adresse ?? '–'}
              </div>
              <div className="flex gap-2">
                {aktuellerStopp.kunde_adresse && (
                  <a
                    href={navUrl(aktuellerStopp.kunde_adresse)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold py-2 hover:bg-blue-700 transition"
                  >
                    <Navigation className="h-4 w-4" /> Navigation starten
                  </a>
                )}
                {aktuellerStopp.kunde_telefon && (
                  <a
                    href={`tel:${aktuellerStopp.kunde_telefon}`}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-semibold px-3 py-2 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                  >
                    <Phone className="h-4 w-4" />
                  </a>
                )}
              </div>
              {aktuellerStopp.eta_min && (
                <div className="mt-2 text-center text-xs text-blue-600 dark:text-blue-400 font-semibold">
                  ETA: ca. {aktuellerStopp.eta_min} Min
                  {aktuellerStopp.distanz_km && ` · ${aktuellerStopp.distanz_km.toFixed(1)} km`}
                </div>
              )}
            </div>
          )}

          {/* Stopp-Liste */}
          <div className="space-y-1.5">
            {enriched.map((s) => (
              <div key={s.id} className={`rounded-lg border overflow-hidden ${statusBg(s._status)}`}>
                <button
                  className="w-full flex items-center gap-2.5 p-2.5 text-left"
                  onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                  disabled={s._status === 'completed'}
                >
                  {/* Status-Indikator */}
                  <div className={`h-4 w-4 rounded-full shrink-0 flex items-center justify-center ${statusDot(s._status)}`}>
                    {s._status === 'completed' && <Check className="h-2.5 w-2.5 text-white" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500">#{s.reihenfolge}</span>
                      <span className="font-semibold text-sm text-gray-800 dark:text-gray-100 truncate">
                        {s.kunde_name ?? 'Kunde'}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                      {s.kunde_adresse ?? '–'}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-1.5">
                    {s.eta_min !== null && s._status !== 'completed' && (
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                        {s.eta_min} Min
                      </span>
                    )}
                    <span className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 ${
                      s._status === 'completed' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' :
                      s._status === 'active' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' :
                      'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}>
                      {statusLabel(s._status)}
                    </span>
                  </div>
                </button>

                {/* Erweiterte Stopp-Details */}
                {expanded === s.id && s._status !== 'completed' && (
                  <div className="border-t border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/60 px-3 py-2.5 space-y-2">
                    {s.gesamtbetrag !== null && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500 dark:text-gray-400">Betrag</span>
                        <span className="font-bold text-gray-800 dark:text-white">{s.gesamtbetrag.toFixed(2)} €</span>
                      </div>
                    )}
                    {s.distanz_km !== null && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500 dark:text-gray-400">Entfernung</span>
                        <span className="font-bold text-gray-800 dark:text-white">{s.distanz_km.toFixed(1)} km</span>
                      </div>
                    )}
                    {s.notizen && (
                      <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 rounded p-1.5">
                        💬 {s.notizen}
                      </div>
                    )}
                    <div className="flex gap-2">
                      {s.kunde_adresse && (
                        <a
                          href={navUrl(s.kunde_adresse)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-semibold py-1.5 hover:bg-blue-200 dark:hover:bg-blue-900/60 transition"
                        >
                          <ExternalLink className="h-3 w-3" /> Maps
                        </a>
                      )}
                      {s.kunde_telefon && (
                        <a
                          href={`tel:${s.kunde_telefon}`}
                          className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-semibold py-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                        >
                          <Phone className="h-3 w-3" /> Anrufen
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500 text-right">
            Stopp-Reihenfolge · Google Maps Navigation · Echtzeit-Status
          </p>
        </div>
      )}
    </div>
  );
}
