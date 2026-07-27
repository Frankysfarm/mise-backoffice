'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, Navigation, Clock, CheckCircle2, Package, AlertTriangle, Phone, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Phase 4000 — Tour-Stop Navigation Hub
 * Alle Tour-Stopps mit ETA, Adresse, Status, Navigationslinkts;
 * Aktueller Stopp hervorgehoben; Fortschrittsbalken;
 * Telefon-Schnellwahl; 15-Sek-Polling; Mock-Fallback.
 */

interface TourStopp {
  idx: number;
  id: string;
  adresse: string;
  kunde: string;
  telefon?: string;
  status: 'geliefert' | 'aktiv' | 'ausstehend';
  eta_min: number | null;
  betrag: number;
  anmerkung?: string;
  lat?: number;
  lng?: number;
}

interface TourData {
  tour_id: string;
  stopps: TourStopp[];
  gesamt_stopps: number;
  fertig_stopps: number;
  naechste_eta_min: number | null;
  fortschritt_pct: number;
}

const MOCK: TourData = {
  tour_id: 'T-1042',
  stopps: [
    { idx: 0, id: 's1', adresse: 'Hauptstraße 12, Aachen', kunde: 'Hans Müller', telefon: '+49 241 123456', status: 'geliefert', eta_min: null, betrag: 28.50 },
    { idx: 1, id: 's2', adresse: 'Parkweg 5, Aachen', kunde: 'Anna Schmidt', telefon: '+49 241 234567', status: 'geliefert', eta_min: null, betrag: 15.90 },
    { idx: 2, id: 's3', adresse: 'Lindenallee 8, Aachen', kunde: 'Peter Weber', telefon: '+49 152 345678', status: 'aktiv', eta_min: 6, betrag: 42.00, anmerkung: 'Klingel funktioniert nicht', lat: 50.776, lng: 6.083 },
    { idx: 3, id: 's4', adresse: 'Gartenstraße 23, Aachen', kunde: 'Maria Bauer', status: 'ausstehend', eta_min: 18, betrag: 19.80 },
    { idx: 4, id: 's5', adresse: 'Am Markt 7, Aachen', kunde: 'Klaus Fischer', telefon: '+49 241 456789', status: 'ausstehend', eta_min: 27, betrag: 33.60 },
  ],
  gesamt_stopps: 5,
  fertig_stopps: 2,
  naechste_eta_min: 6,
  fortschritt_pct: 40,
};

function statusIcon(s: TourStopp['status']) {
  if (s === 'geliefert') return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
  if (s === 'aktiv')     return <Navigation className="h-4 w-4 text-blue-500 animate-pulse shrink-0" />;
  return                        <Package className="h-4 w-4 text-slate-400 shrink-0" />;
}

function statusBg(s: TourStopp['status']) {
  if (s === 'geliefert') return 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900';
  if (s === 'aktiv')     return 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 ring-1 ring-blue-300 dark:ring-blue-700';
  return 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700';
}

function naviUrl(stopp: TourStopp): string {
  if (stopp.lat && stopp.lng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${stopp.lat},${stopp.lng}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stopp.adresse)}`;
}

export function FahrerPhase4000TourStopNavHub({ tourId }: { tourId?: string | null }) {
  const [data, setData] = useState<TourData>(MOCK);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['s3']));
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!tourId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/fahrer/tour-stopps?tour_id=${tourId}`);
      if (res.ok) {
        const d = await res.json();
        if (d?.stopps) setData(d);
      }
    } catch { /* Mock-Fallback */ }
    setLoading(false);
  }, [tourId]);

  useEffect(() => { load(); const id = setInterval(load, 15000); return () => clearInterval(id); }, [load]);

  function toggle(id: string) {
    setExpanded(s => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  const aktiv = data.stopps.find(s => s.status === 'aktiv');

  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-800 overflow-hidden bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-blue-600 dark:bg-blue-800">
        <Navigation className="h-4 w-4 text-white shrink-0" />
        <span className="font-display text-sm font-black text-white">Tour {data.tour_id}</span>
        {loading && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-white/70 animate-pulse" />}
        <div className="ml-auto text-right">
          <div className="text-white text-sm font-black tabular-nums">
            {data.fertig_stopps}/{data.gesamt_stopps}
          </div>
          <div className="text-blue-200 text-[10px]">Stopps</div>
        </div>
      </div>

      {/* Fortschrittsbalken */}
      <div className="h-2 bg-blue-100 dark:bg-blue-900">
        <div
          className="h-full bg-blue-500 transition-all duration-700"
          style={{ width: `${data.fortschritt_pct}%` }}
        />
      </div>

      {/* Nächste ETA Banner */}
      {aktiv && (
        <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-800">
          <Clock className="h-3.5 w-3.5 text-blue-600 shrink-0" />
          <span className="text-xs font-bold text-blue-700 dark:text-blue-400">
            Nächster Stopp: <span className="font-black">{aktiv.kunde}</span>
            {aktiv.eta_min !== null && ` · ~${aktiv.eta_min} Min`}
          </span>
          <a
            href={naviUrl(aktiv)}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-black text-white active:scale-95 transition"
          >
            <Navigation className="h-3 w-3" />
            Navigieren
          </a>
        </div>
      )}

      {/* Stopp-Liste */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {data.stopps.map((stopp, i) => {
          const isOpen = expanded.has(stopp.id);
          const past = stopp.status === 'geliefert';

          return (
            <div key={stopp.id} className={`rounded-none border ${statusBg(stopp.status)}`}>
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                onClick={() => toggle(stopp.id)}
              >
                {/* Index */}
                <div className={`shrink-0 rounded-full h-6 w-6 flex items-center justify-center text-[10px] font-black ${past ? 'bg-emerald-500 text-white' : stopp.status === 'aktiv' ? 'bg-blue-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-foreground'}`}>
                  {past ? '✓' : i + 1}
                </div>

                {/* Status-Icon */}
                {statusIcon(stopp.status)}

                {/* Adresse + Kunde */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-foreground truncate">{stopp.adresse}</div>
                  <div className="text-[10px] text-muted-foreground">{stopp.kunde}</div>
                </div>

                {/* ETA / Betrag */}
                <div className="shrink-0 text-right">
                  {stopp.eta_min !== null && (
                    <div className="text-xs font-bold text-blue-600 tabular-nums">{stopp.eta_min} Min</div>
                  )}
                  <div className="text-[10px] text-muted-foreground tabular-nums">
                    {stopp.betrag.toFixed(2)} €
                  </div>
                </div>

                {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
              </button>

              {/* Detail-Panel */}
              {isOpen && (
                <div className="px-4 pb-3 space-y-2 border-t border-current/10">
                  {stopp.anmerkung && (
                    <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 px-3 py-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <span className="text-[11px] text-amber-700 dark:text-amber-400">{stopp.anmerkung}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <a
                      href={naviUrl(stopp)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-black text-white active:scale-95 transition"
                    >
                      <Navigation className="h-3.5 w-3.5" />
                      Google Maps
                    </a>
                    <a
                      href={`https://waze.com/ul?q=${encodeURIComponent(stopp.adresse)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-2 text-[11px] font-black text-white active:scale-95 transition"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      Waze
                    </a>
                    {stopp.telefon && (
                      <a
                        href={`tel:${stopp.telefon}`}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-black text-white active:scale-95 transition"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        Anrufen
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 px-4 py-2 border-t bg-muted/10 text-[9px] text-muted-foreground">
        <MapPin className="h-3 w-3 shrink-0" />
        <span>{data.fertig_stopps} von {data.gesamt_stopps} Stopps erledigt · {data.fortschritt_pct}% Fortschritt</span>
        <span className="ml-auto">15s-Polling</span>
      </div>
    </div>
  );
}
