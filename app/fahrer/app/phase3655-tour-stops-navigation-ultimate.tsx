'use client';

import { useState, useEffect, useCallback } from 'react';
import { Navigation, Phone, MapPin, Clock, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Package, CreditCard, MessageSquare, Bike } from 'lucide-react';

interface TourStopp {
  stopp_id: string;
  stopp_nr: number;
  adresse: string;
  kunde_name: string;
  status: 'ausstehend' | 'unterwegs' | 'geliefert' | 'problem';
  eta_min: number | null;
  zahlungsart: 'bar' | 'karte' | 'bezahlt';
  notiz: string | null;
  telefon: string | null;
  betrag: number;
  sonderwunsch: boolean;
}

interface ApiResponse {
  stopps: TourStopp[];
  aktiver_stopp_id: string | null;
  fortschritt_pct: number;
  verbleibende_stopps: number;
  tour_eta_min: number;
  tour_id: string | null;
}

const MOCK: ApiResponse = {
  tour_id: 'tour-42',
  aktiver_stopp_id: 's2',
  fortschritt_pct: 33,
  verbleibende_stopps: 4,
  tour_eta_min: 58,
  stopps: [
    {
      stopp_id: 's1', stopp_nr: 1, adresse: 'Aachener Str. 44, 52062 Aachen', kunde_name: 'K. Müller',
      status: 'geliefert', eta_min: null, zahlungsart: 'bezahlt', notiz: null, telefon: null, betrag: 18.90, sonderwunsch: false,
    },
    {
      stopp_id: 's2', stopp_nr: 2, adresse: 'Pontstraße 56, 52062 Aachen', kunde_name: 'A. Schmidt',
      status: 'unterwegs', eta_min: 6, zahlungsart: 'karte', notiz: '3. Etage, kein Aufzug', telefon: '+49 176 1234567', betrag: 23.50, sonderwunsch: true,
    },
    {
      stopp_id: 's3', stopp_nr: 3, adresse: 'Münsterplatz 3, 52062 Aachen', kunde_name: 'M. Weber',
      status: 'ausstehend', eta_min: 19, zahlungsart: 'bar', notiz: null, telefon: '+49 151 9876543', betrag: 14.80, sonderwunsch: false,
    },
    {
      stopp_id: 's4', stopp_nr: 4, adresse: 'Wilhelmstr. 22, 52070 Aachen', kunde_name: 'L. Fischer',
      status: 'ausstehend', eta_min: 33, zahlungsart: 'bezahlt', notiz: 'Hintereingang', telefon: null, betrag: 31.20, sonderwunsch: false,
    },
    {
      stopp_id: 's5', stopp_nr: 5, adresse: 'Jülicher Str. 112, 52070 Aachen', kunde_name: 'S. Braun',
      status: 'ausstehend', eta_min: 46, zahlungsart: 'bar', notiz: null, telefon: '+49 160 5556789', betrag: 12.40, sonderwunsch: false,
    },
  ],
};

const STATUS_DOT: Record<string, string> = {
  geliefert: 'bg-emerald-500',
  unterwegs: 'bg-blue-500',
  ausstehend: 'bg-gray-300 dark:bg-gray-600',
  problem: 'bg-red-500',
};
const ZAHLUNGSART_LABEL: Record<string, { label: string; cls: string }> = {
  bar: { label: 'Bar', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  karte: { label: 'Karte', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  bezahlt: { label: '✓ bezahlt', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
};

function googleMapsUrl(adresse: string) {
  return `https://maps.google.com/?q=${encodeURIComponent(adresse)}`;
}

export function FahrerPhase3655TourStopsNavigationUltimate({
  driverId,
  activeBatch,
}: {
  driverId: string | null;
  activeBatch?: { id: string; stops?: TourStopp[] } | null;
}) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [expanded, setExpanded] = useState<string | null>(MOCK.aktiver_stopp_id);

  const load = useCallback(async () => {
    if (!driverId) return;
    try {
      const r = await fetch(`/api/delivery/fahrer/tour-stopps?driver_id=${driverId}`, { cache: 'no-store' });
      if (r.ok) { const d = await r.json(); if (d?.stopps?.length) setData(d); }
    } catch {}
  }, [driverId]);

  useEffect(() => { load(); }, [load]);

  if (!data.stopps.length) return null;

  const aktiverStopp = data.stopps.find(s => s.stopp_id === data.aktiver_stopp_id);

  return (
    <div className="space-y-3">
      {/* Hero — Aktiver Stopp */}
      {aktiverStopp && (
        <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 text-white p-4 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
                {aktiverStopp.stopp_nr}
              </div>
              <span className="text-xs font-semibold uppercase tracking-wide opacity-80">Nächster Stopp</span>
            </div>
            {aktiverStopp.eta_min !== null && (
              <div className="flex items-center gap-1 bg-white/20 rounded-full px-3 py-1 text-sm font-bold">
                <Clock className="w-3.5 h-3.5" />
                {aktiverStopp.eta_min} min
              </div>
            )}
          </div>

          <div className="text-base font-bold mb-1 leading-snug">{aktiverStopp.adresse}</div>
          <div className="text-sm opacity-80 mb-3">{aktiverStopp.kunde_name} · {aktiverStopp.betrag.toFixed(2)} €</div>

          {/* Sonderwunsch-Alert */}
          {aktiverStopp.sonderwunsch && (
            <div className="flex items-center gap-2 bg-amber-400/30 border border-amber-400/50 rounded-lg px-3 py-1.5 mb-3 text-xs font-medium text-amber-100">
              <AlertTriangle className="w-3.5 h-3.5" />
              Sonderwunsch beachten!
            </div>
          )}

          {/* Notiz */}
          {aktiverStopp.notiz && (
            <div className="flex items-center gap-2 bg-white/15 rounded-lg px-3 py-1.5 mb-3 text-xs opacity-90">
              <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
              {aktiverStopp.notiz}
            </div>
          )}

          {/* Aktions-Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <a
              href={googleMapsUrl(aktiverStopp.adresse)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-white text-blue-600 font-bold rounded-xl py-2.5 text-sm active:opacity-80"
            >
              <Navigation className="w-4 h-4" />
              Navigieren
            </a>
            {aktiverStopp.telefon ? (
              <a
                href={`tel:${aktiverStopp.telefon}`}
                className="flex items-center justify-center gap-2 bg-white/20 text-white font-bold rounded-xl py-2.5 text-sm border border-white/30 active:opacity-80"
              >
                <Phone className="w-4 h-4" />
                Anrufen
              </a>
            ) : (
              <div className="flex items-center justify-center gap-2 bg-white/10 text-white/50 font-bold rounded-xl py-2.5 text-sm border border-white/20">
                <Phone className="w-4 h-4" />
                Kein Tel.
              </div>
            )}
          </div>

          {/* Zahlungsart */}
          <div className="mt-2 flex items-center justify-between">
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${ZAHLUNGSART_LABEL[aktiverStopp.zahlungsart].cls}`}>
              <CreditCard className="w-3 h-3 inline mr-1" />
              {ZAHLUNGSART_LABEL[aktiverStopp.zahlungsart].label}
            </span>
            <span className="text-xs opacity-70">{aktiverStopp.stopp_nr}/{data.stopps.length} Stopps</span>
          </div>
        </div>
      )}

      {/* Fortschrittsbalken */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
          <span className="flex items-center gap-1"><Bike className="w-3.5 h-3.5" />Tour-Fortschritt</span>
          <span>{data.fortschritt_pct}% · noch {data.verbleibende_stopps} Stopps · ~{data.tour_eta_min} min</span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all"
            style={{ width: `${data.fortschritt_pct}%` }}
          />
        </div>
      </div>

      {/* Alle Stopps */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Alle Stopps</span>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {data.stopps.map(s => {
            const isExpanded = expanded === s.stopp_id;
            const isAktiv = s.stopp_id === data.aktiver_stopp_id;
            return (
              <div key={s.stopp_id}>
                <button
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left ${isAktiv ? 'bg-blue-50 dark:bg-blue-950/30' : ''}`}
                  onClick={() => setExpanded(e => e === s.stopp_id ? null : s.stopp_id)}
                >
                  {/* Status-Dot */}
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${STATUS_DOT[s.status]} ${s.status === 'unterwegs' ? 'ring-2 ring-blue-300 ring-offset-1' : ''}`} />

                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{s.adresse}</span>
                      {s.eta_min !== null && s.status !== 'geliefert' && (
                        <span className="text-xs text-blue-600 dark:text-blue-400 flex-shrink-0 font-bold">{s.eta_min} min</span>
                      )}
                      {s.status === 'geliefert' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {s.kunde_name} · {s.betrag.toFixed(2)} €
                      {s.sonderwunsch && <span className="ml-1 text-amber-500">⚠</span>}
                    </div>
                  </div>

                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-300 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-300 flex-shrink-0" />}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-3 space-y-2 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700">
                    {s.notiz && (
                      <div className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900 rounded-lg p-2 mt-2">
                        <MessageSquare className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                        {s.notiz}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${ZAHLUNGSART_LABEL[s.zahlungsart].cls}`}>
                        {ZAHLUNGSART_LABEL[s.zahlungsart].label}
                      </span>
                    </div>
                    {s.status !== 'geliefert' && (
                      <div className="grid grid-cols-2 gap-2">
                        <a
                          href={googleMapsUrl(s.adresse)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 bg-blue-600 text-white rounded-lg py-2 text-xs font-bold active:opacity-80"
                        >
                          <Navigation className="w-3.5 h-3.5" />Navi
                        </a>
                        {s.telefon && (
                          <a
                            href={`tel:${s.telefon}`}
                            className="flex items-center justify-center gap-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg py-2 text-xs font-bold active:opacity-80"
                          >
                            <Phone className="w-3.5 h-3.5" />Anruf
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
