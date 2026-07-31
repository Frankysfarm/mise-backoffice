'use client';

import { useEffect, useState } from 'react';
import {
  MapPin, Phone, Navigation, CheckCircle2, Clock, WifiOff,
  AlertCircle, Package, ChevronDown, ChevronUp, Zap, ArrowRight,
} from 'lucide-react';

// Phase 5304 — Tour-Stopp-Navigator V4
// Neu: Schritt-für-Schritt-Hinweise; Warte-Warnung bei hohem Delay-Risiko;
// Swipe-freundliche Stopp-Karten; Batch-Überblick-Summary; Offline-Banner; Mock-Fallback

interface TourStop {
  id: string;
  reihenfolge: number;
  adresse: string;
  kunde_name: string | null;
  telefon: string | null;
  bestellnummer: string | null;
  status: 'ausstehend' | 'unterwegs' | 'angekommen' | 'abgeliefert';
  eta_min: number | null;
  notiz: string | null;
  items_count: number | null;
  betrag: number | null;
  priority: 'express' | 'normal';
  delay_risk: 'low' | 'medium' | 'high';
  navi_hinweis: string | null;
}

interface TourSummary {
  stops_total: number;
  stops_done: number;
  umsatz_gesamt: number;
  effizienz_pct: number;
  batch_id: string | null;
}

const MOCK_STOPS: TourStop[] = [
  { id: '1', reihenfolge: 1, adresse: 'Pontstraße 3, 52062 Aachen',      kunde_name: 'Marie Schmidt', telefon: '+4924112345', bestellnummer: '#1052', status: 'angekommen', eta_min: 0,  notiz: 'Klingel defekt — bitte anrufen!', items_count: 3, betrag: 24.90, priority: 'express', delay_risk: 'low',    navi_hinweis: 'Eingang seitlich, Hinterhof' },
  { id: '2', reihenfolge: 2, adresse: 'Jülicher Str. 7, 52070 Aachen',   kunde_name: 'Tom Bauer',     telefon: '+4924198765', bestellnummer: '#1053', status: 'ausstehend', eta_min: 8,  notiz: null,                               items_count: 2, betrag: 18.50, priority: 'normal', delay_risk: 'medium', navi_hinweis: null },
  { id: '3', reihenfolge: 3, adresse: 'Berliner Ring 12, 52072 Aachen',  kunde_name: 'Lena Weber',    telefon: null,           bestellnummer: '#1054', status: 'ausstehend', eta_min: 18, notiz: '3. OG links',                       items_count: 4, betrag: 31.20, priority: 'normal', delay_risk: 'high',   navi_hinweis: '3. OG — kein Aufzug' },
];

const MOCK_SUMMARY: TourSummary = {
  stops_total: 3, stops_done: 0, umsatz_gesamt: 74.60, effizienz_pct: 87, batch_id: 'B7',
};

type StatusKey = TourStop['status'];

function statusInfo(s: StatusKey): { label: string; color: string; bg: string; border: string } {
  switch (s) {
    case 'abgeliefert': return { label: 'Abgeliefert', color: 'text-green-400',  bg: 'bg-green-900/30',  border: 'border-green-800/40'  };
    case 'angekommen':  return { label: 'Angekommen',  color: 'text-yellow-300', bg: 'bg-yellow-900/30', border: 'border-yellow-800/40' };
    case 'unterwegs':   return { label: 'Unterwegs',   color: 'text-blue-300',   bg: 'bg-blue-900/30',   border: 'border-blue-800/40'   };
    default:            return { label: 'Ausstehend',  color: 'text-gray-400',   bg: 'bg-gray-800/40',   border: 'border-gray-700/40'   };
  }
}

const DELAY_STYLE: Record<TourStop['delay_risk'], { label: string; color: string; bg: string }> = {
  low:    { label: '',               color: '',                bg: ''                   },
  medium: { label: 'Risiko Mittel', color: 'text-yellow-300', bg: 'bg-yellow-900/20'   },
  high:   { label: 'Delay Risiko!', color: 'text-red-300',    bg: 'bg-red-900/30'      },
};

function openMaps(adresse: string) {
  window.open(`https://maps.google.com/?q=${encodeURIComponent(adresse)}`, '_blank', 'noopener');
}

function callPhone(tel: string) {
  window.location.href = `tel:${tel}`;
}

export function FahrerPhase5304TourStoppNavigatorV4({
  driverId,
  locationId,
  isOnline = true,
}: {
  driverId: string;
  locationId: string | null;
  isOnline?: boolean;
}) {
  const [stops, setStops] = useState<TourStop[] | null>(null);
  const [summary, setSummary] = useState<TourSummary | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['1']));
  const [error, setError] = useState(false);

  async function load() {
    const params = new URLSearchParams({ driver_id: driverId, v: '4' });
    if (locationId) params.set('location_id', locationId);
    const res = await fetch(`/api/delivery/fahrer/tour-stops?${params}`).catch(() => null);
    if (res?.ok) {
      const j = await res.json();
      setStops(Array.isArray(j) ? j : (j.stops ?? MOCK_STOPS));
      setSummary(j.summary ?? MOCK_SUMMARY);
      setError(false);
    } else {
      setStops(MOCK_STOPS);
      setSummary(MOCK_SUMMARY);
      setError(true);
    }
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, locationId]);

  const allStops = stops ?? MOCK_STOPS;
  const sum      = summary ?? MOCK_SUMMARY;

  const done = allStops.filter(s => s.status === 'abgeliefert').length;
  const nextStop = allStops.find(s => s.status !== 'abgeliefert');

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 text-white text-sm overflow-hidden">
      {/* Offline-Banner */}
      {!isOnline && (
        <div className="flex items-center gap-2 bg-orange-950/60 border-b border-orange-800/50 px-3 py-2">
          <WifiOff size={13} className="text-orange-400" />
          <span className="text-xs text-orange-300">Offline — letzte Daten werden angezeigt</span>
        </div>
      )}

      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Navigation size={15} className="text-indigo-400" />
          <span className="font-semibold">Tour-Navigator V4</span>
          {sum.batch_id && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">{sum.batch_id}</span>}
          {error && <span className="text-xs text-yellow-500 border border-yellow-700 rounded px-1">Mock</span>}
        </div>
        <span className="text-xs text-gray-400">{done}/{sum.stops_total} Stopps</span>
      </div>

      {/* Summary Bar */}
      <div className="px-4 py-2 border-b border-gray-800">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
          <span>Tour-Fortschritt</span>
          <span>Effizienz <strong className={`${sum.effizienz_pct >= 85 ? 'text-green-400' : sum.effizienz_pct >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>{sum.effizienz_pct}%</strong></span>
        </div>
        <div className="h-2 rounded-full bg-gray-700">
          <div className="h-2 rounded-full bg-indigo-500 transition-all" style={{ width: `${(done / sum.stops_total) * 100}%` }} />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>€ {sum.umsatz_gesamt.toFixed(2)} gesamt</span>
          <span>{sum.stops_total - done} verbleibend</span>
        </div>
      </div>

      {/* Next-Stop Highlight */}
      {nextStop && nextStop.status === 'angekommen' && (
        <div className="mx-3 mt-3 flex items-center gap-2 rounded-lg border border-yellow-700/50 bg-yellow-950/30 px-3 py-2">
          <Zap size={13} className="text-yellow-400 flex-shrink-0" />
          <span className="text-xs text-yellow-300 font-medium">Du bist da — Bestellung übergeben!</span>
        </div>
      )}

      {/* Stop Cards */}
      <div className="px-3 pt-3 pb-3 space-y-2">
        {allStops.map(stop => {
          const si = statusInfo(stop.status);
          const ds = DELAY_STYLE[stop.delay_risk];
          const open = expanded.has(stop.id);
          const isNext = stop.id === nextStop?.id;

          return (
            <div
              key={stop.id}
              className={`rounded-xl border transition-all ${si.border} ${si.bg} ${isNext && stop.status !== 'abgeliefert' ? 'ring-1 ring-indigo-500/50' : ''}`}
            >
              {/* Stop Header */}
              <button className="w-full px-3 py-3 flex items-start gap-2 text-left" onClick={() => toggle(stop.id)}>
                {/* Position Badge */}
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${stop.status === 'abgeliefert' ? 'bg-green-700 text-white' : 'bg-indigo-700 text-white'}`}>
                  {stop.status === 'abgeliefert' ? '✓' : stop.reihenfolge}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {stop.priority === 'express' && <Zap size={11} className="text-orange-400 flex-shrink-0" />}
                    <span className="font-medium text-white truncate">{stop.kunde_name ?? 'Kunde'}</span>
                    {stop.bestellnummer && <span className="text-xs text-gray-400">{stop.bestellnummer}</span>}
                  </div>
                  <p className="text-xs text-gray-400 truncate">{stop.adresse}</p>
                  {ds.label && (
                    <span className={`inline-block text-xs mt-0.5 ${ds.color}`}>{ds.label}</span>
                  )}
                </div>

                <div className="flex-shrink-0 flex flex-col items-end gap-1">
                  <span className={`text-xs font-medium ${si.color}`}>{si.label}</span>
                  {stop.eta_min !== null && stop.eta_min > 0 && (
                    <span className="text-xs text-gray-400">{stop.eta_min} Min</span>
                  )}
                  {open ? <ChevronUp size={13} className="text-gray-500" /> : <ChevronDown size={13} className="text-gray-500" />}
                </div>
              </button>

              {/* Expandierter Inhalt */}
              {open && (
                <div className="border-t border-gray-700/50 px-3 pt-2 pb-3 space-y-2">
                  {/* Navi-Hinweis */}
                  {stop.navi_hinweis && (
                    <div className="flex items-start gap-1.5 rounded-lg bg-indigo-950/30 border border-indigo-800/30 px-2.5 py-1.5">
                      <MapPin size={11} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                      <span className="text-xs text-indigo-300">{stop.navi_hinweis}</span>
                    </div>
                  )}

                  {/* Notiz */}
                  {stop.notiz && (
                    <div className="flex items-start gap-1.5 rounded-lg bg-yellow-950/20 border border-yellow-800/20 px-2.5 py-1.5">
                      <AlertCircle size={11} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                      <span className="text-xs text-yellow-300">{stop.notiz}</span>
                    </div>
                  )}

                  {/* Delay-Warnung */}
                  {stop.delay_risk === 'high' && (
                    <div className="flex items-center gap-1.5 rounded-lg bg-red-950/30 border border-red-800/40 px-2.5 py-1.5">
                      <AlertCircle size={11} className="text-red-400 flex-shrink-0" />
                      <span className="text-xs text-red-300">Hohes Verzögerungs-Risiko — zügig weiterfahren!</span>
                    </div>
                  )}

                  {/* Bestell-Info */}
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-0.5"><Package size={10} />{stop.items_count ?? 1} Artikel</span>
                    {stop.betrag && <span>€ {stop.betrag.toFixed(2)}</span>}
                  </div>

                  {/* Action Buttons */}
                  {stop.status !== 'abgeliefert' && (
                    <div className="flex gap-2 mt-1">
                      <button
                        onClick={() => openMaps(stop.adresse)}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium py-2 transition-colors"
                      >
                        <Navigation size={12} /> Navigation
                      </button>
                      {stop.telefon && (
                        <button
                          onClick={() => callPhone(stop.telefon!)}
                          className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700 text-white text-xs font-medium px-3 py-2 transition-colors"
                        >
                          <Phone size={12} />
                        </button>
                      )}
                    </div>
                  )}
                  {stop.status === 'abgeliefert' && (
                    <div className="flex items-center gap-1.5 text-green-400 text-xs">
                      <CheckCircle2 size={12} />
                      <span>Abgeliefert</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {allStops.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-xs">
            <CheckCircle2 size={20} className="mx-auto mb-2 text-green-600" />
            Keine aktiven Tour-Stopps
          </div>
        )}
      </div>
    </div>
  );
}
