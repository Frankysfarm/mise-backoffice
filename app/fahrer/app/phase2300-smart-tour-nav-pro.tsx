'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, MapPin, Navigation, Phone, Clock } from 'lucide-react';

type Stopp = {
  id: string;
  reihenfolge: number;
  kunde_name: string | null;
  kunde_adresse: string | null;
  kunde_telefon: string | null;
  gesamtbetrag: number | null;
  geliefert_am: string | null;
  eta_min: number | null;
  distanz_km: number | null;
  notizen: string | null;
};

type Props = {
  stops: Stopp[];
  batchId: string;
};

function naviUrl(adresse: string): string {
  const encoded = encodeURIComponent(adresse);
  if (typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    return `maps://maps.apple.com/?daddr=${encoded}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
}

function statusFarbe(s: Stopp): string {
  if (s.geliefert_am) return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700';
  return 'bg-white dark:bg-gray-800 border-stone-200 dark:border-stone-600';
}

function eurofmt(v: number | null): string {
  if (v === null) return '';
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

export function FahrerPhase2300SmartTourNavPro({ stops, batchId }: Props) {
  const [open, setOpen] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const sortedStops = useMemo(
    () => [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge),
    [stops],
  );

  const geliefertCount = sortedStops.filter((s) => s.geliefert_am).length;
  const ausstehend = sortedStops.filter((s) => !s.geliefert_am);
  const naechsterStopp = ausstehend[0] ?? null;

  if (stops.length === 0) return null;

  return (
    <div className="rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 overflow-hidden mb-3">
      <button
        className="w-full flex items-center justify-between px-4 py-3"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="font-bold text-sm text-blue-900 dark:text-blue-200">
            Tour-Navigation Pro
          </span>
          <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">
            {geliefertCount}/{sortedStops.length} geliefert
          </span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-blue-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-blue-400" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Fortschrittsbalken */}
          <div className="w-full bg-blue-100 dark:bg-blue-900/30 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${sortedStops.length > 0 ? (geliefertCount / sortedStops.length) * 100 : 0}%` }}
            />
          </div>

          {/* Nächster Stopp hervorgehoben */}
          {naechsterStopp && (
            <div className="rounded-xl border-2 border-blue-400 dark:border-blue-500 bg-white dark:bg-gray-800 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-wide">Nächster Stopp</span>
              </div>
              <div className="flex items-start gap-2 mb-2">
                <MapPin className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-100 leading-tight">
                    {naechsterStopp.kunde_name ?? 'Kunde'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {naechsterStopp.kunde_adresse ?? '—'}
                  </p>
                  {naechsterStopp.eta_min !== null && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 text-amber-500" />
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                        ETA {naechsterStopp.eta_min} min
                      </span>
                      {naechsterStopp.distanz_km !== null && (
                        <span className="text-xs text-gray-400">· {naechsterStopp.distanz_km.toFixed(1)} km</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {naechsterStopp.kunde_adresse && (
                  <a
                    href={naviUrl(naechsterStopp.kunde_adresse)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-xl transition-colors"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    Navigation starten
                  </a>
                )}
                {naechsterStopp.kunde_telefon && (
                  <a
                    href={`tel:${naechsterStopp.kunde_telefon}`}
                    className="flex items-center justify-center gap-1 px-3 py-2 bg-stone-100 dark:bg-stone-700 text-stone-700 dark:text-stone-200 text-xs font-semibold rounded-xl transition-colors hover:bg-stone-200"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Alle Stopps */}
          <div className="space-y-1.5">
            {sortedStops.map((s, idx) => {
              const isExpanded = expandedId === s.id;
              const istNaechster = !s.geliefert_am && idx === sortedStops.findIndex((x) => !x.geliefert_am);
              return (
                <div
                  key={s.id}
                  className={`rounded-xl border overflow-hidden ${statusFarbe(s)} ${istNaechster ? 'ring-2 ring-blue-400 dark:ring-blue-500' : ''}`}
                >
                  <button
                    className="w-full flex items-center justify-between px-3 py-2 text-left"
                    onClick={() => setExpandedId((v) => (v === s.id ? null : s.id))}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center bg-stone-200 dark:bg-stone-600 text-stone-600 dark:text-stone-200 shrink-0">
                        {s.reihenfolge}
                      </span>
                      {s.geliefert_am ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                      ) : (
                        <MapPin className="w-4 h-4 text-blue-400 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className={`text-xs font-semibold truncate ${s.geliefert_am ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-100'}`}>
                          {s.kunde_name ?? 'Kunde'}
                        </p>
                        <p className="text-[10px] text-gray-400 truncate">{s.kunde_adresse ?? '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {s.eta_min !== null && !s.geliefert_am && (
                        <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">{s.eta_min} min</span>
                      )}
                      {s.geliefert_am ? (
                        <span className="text-[10px] text-green-500 font-semibold">Geliefert</span>
                      ) : null}
                      {isExpanded ? <ChevronUp className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-stone-100 dark:border-stone-600 px-3 py-2 space-y-1.5">
                      {s.gesamtbetrag !== null && (
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          Betrag: <strong>{eurofmt(s.gesamtbetrag)}</strong>
                        </div>
                      )}
                      {s.notizen && (
                        <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded px-2 py-1">
                          {s.notizen}
                        </div>
                      )}
                      <div className="flex gap-2">
                        {s.kunde_adresse && !s.geliefert_am && (
                          <a
                            href={naviUrl(s.kunde_adresse)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg transition-colors"
                          >
                            <Navigation className="w-3 h-3" />
                            Navigieren
                          </a>
                        )}
                        {s.kunde_telefon && (
                          <a
                            href={`tel:${s.kunde_telefon}`}
                            className="flex items-center justify-center gap-1 px-3 py-1.5 bg-stone-100 dark:bg-stone-700 text-stone-700 dark:text-stone-200 text-xs font-semibold rounded-lg"
                          >
                            <Phone className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {geliefertCount === sortedStops.length && (
            <div className="rounded-xl bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-700 px-3 py-2 text-center text-xs font-bold text-green-700 dark:text-green-300">
              Tour abgeschlossen! Alle {sortedStops.length} Stopps geliefert.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
