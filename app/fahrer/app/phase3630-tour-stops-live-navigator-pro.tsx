'use client';

import { useState } from 'react';
import { MapPin, Navigation, Phone, CheckCircle2, Clock, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

interface Stop {
  id: string;
  sequence: number;
  bestellnummer: string;
  kunde_name: string;
  adresse: string;
  plz: string | null;
  lat: number | null;
  lng: number | null;
  telefon: string | null;
  eta_earliest: string | null;
  eta_latest: string | null;
  bezahlt: boolean;
  zahlungsart: string;
  betrag: number;
  notiz: string | null;
  abgeschlossen: boolean;
}

interface Props {
  stops: Stop[];
  aktiverStoppIdx: number;
}

const ZAHLUNGSART_COLOR: Record<string, string> = { bar: 'text-orange-600 bg-orange-50', karte: 'text-emerald-600 bg-emerald-50', online: 'text-blue-600 bg-blue-50' };

function etaLabel(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function mapsUrl(lat: number | null, lng: number | null, adresse: string, plz: string | null) {
  if (lat && lng) return `https://maps.google.com/?q=${lat},${lng}`;
  return `https://maps.google.com/?q=${encodeURIComponent([adresse, plz].filter(Boolean).join(' '))}`;
}

export function FahrerPhase3630TourStopsLiveNavigatorPro({ stops, aktiverStoppIdx }: Props) {
  const [expanded, setExpanded] = useState<string | null>(stops[aktiverStoppIdx]?.id ?? null);

  const abgeschlossen = stops.filter(s => s.abgeschlossen).length;
  const gesamt = stops.length;
  const fortschritt = gesamt > 0 ? Math.round((abgeschlossen / gesamt) * 100) : 0;
  const aktuell = stops[aktiverStoppIdx];

  return (
    <div className="space-y-3 pb-4">
      {/* Fortschrittsbalken */}
      <div className="px-1">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>{abgeschlossen} von {gesamt} Stopps erledigt</span>
          <span className="font-bold text-gray-700">{fortschritt}%</span>
        </div>
        <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-2.5 bg-emerald-500 rounded-full transition-all"
            style={{ width: `${fortschritt}%` }}
          />
        </div>
      </div>

      {/* Hero: Aktueller Stopp */}
      {aktuell && !aktuell.abgeschlossen && (
        <div className="rounded-xl border-2 border-blue-400 bg-blue-50 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Navigation className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-blue-600 font-semibold uppercase">Aktueller Stopp #{aktuell.sequence}</div>
              <div className="font-bold text-gray-900 truncate">{aktuell.kunde_name}</div>
            </div>
            {aktuell.eta_earliest && (
              <div className="flex items-center gap-1 text-xs text-blue-700 bg-blue-100 rounded-full px-2 py-0.5 flex-shrink-0">
                <Clock className="w-3 h-3" />
                ETA {etaLabel(aktuell.eta_earliest)}
              </div>
            )}
          </div>
          <div className="text-sm text-gray-700">{aktuell.adresse}{aktuell.plz ? `, ${aktuell.plz}` : ''}</div>
          {aktuell.notiz && (
            <div className="flex items-start gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
              <span>{aktuell.notiz}</span>
            </div>
          )}
          <div className="flex gap-2">
            <a
              href={mapsUrl(aktuell.lat, aktuell.lng, aktuell.adresse, aktuell.plz)}
              target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 text-white rounded-lg py-2 text-sm font-semibold"
            >
              <Navigation className="w-4 h-4" />
              Navigation
            </a>
            {aktuell.telefon && (
              <a
                href={`tel:${aktuell.telefon}`}
                className="flex items-center justify-center gap-1.5 bg-gray-100 text-gray-700 rounded-lg py-2 px-3 text-sm font-semibold"
              >
                <Phone className="w-4 h-4" />
              </a>
            )}
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className={`px-2 py-0.5 rounded-full font-medium ${ZAHLUNGSART_COLOR[aktuell.zahlungsart] ?? 'text-gray-600 bg-gray-100'}`}>
              {aktuell.bezahlt ? 'Bezahlt' : aktuell.zahlungsart === 'bar' ? `Bar ${aktuell.betrag.toFixed(2)} €` : `${aktuell.zahlungsart}`}
            </span>
            <span className="font-bold text-gray-700">{aktuell.betrag.toFixed(2)} €</span>
          </div>
        </div>
      )}

      {/* Alle Stopps */}
      <div className="space-y-1.5">
        {stops.map((s, i) => (
          <div key={s.id} className={`rounded-xl border ${s.abgeschlossen ? 'border-emerald-200 bg-emerald-50 opacity-70' : i === aktiverStoppIdx ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'}`}>
            <button
              className="w-full flex items-center gap-2 p-2.5 text-left"
              onClick={() => setExpanded(expanded === s.id ? null : s.id)}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${s.abgeschlossen ? 'bg-emerald-500 text-white' : i === aktiverStoppIdx ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                {s.abgeschlossen ? <CheckCircle2 className="w-3.5 h-3.5" /> : s.sequence}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{s.kunde_name}</div>
                <div className="text-xs text-gray-500 truncate">{s.adresse}</div>
              </div>
              {s.eta_earliest && !s.abgeschlossen && (
                <div className="text-xs text-gray-500 flex-shrink-0">{etaLabel(s.eta_earliest)}</div>
              )}
              {expanded === s.id ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
            </button>

            {expanded === s.id && (
              <div className="px-3 pb-2.5 pt-0 space-y-2 border-t border-gray-100">
                <div className="text-sm text-gray-700">{s.adresse}{s.plz ? `, ${s.plz}` : ''}</div>
                {s.notiz && (
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">{s.notiz}</div>
                )}
                <div className="flex gap-2">
                  <a
                    href={mapsUrl(s.lat, s.lng, s.adresse, s.plz)}
                    target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1 bg-blue-600 text-white rounded-lg py-1.5 text-xs font-semibold"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    Navi
                  </a>
                  {s.telefon && (
                    <a href={`tel:${s.telefon}`} className="flex items-center justify-center gap-1 bg-gray-100 text-gray-700 rounded-lg py-1.5 px-3 text-xs font-semibold">
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span className={`px-2 py-0.5 rounded-full font-medium ${ZAHLUNGSART_COLOR[s.zahlungsart] ?? 'text-gray-600 bg-gray-100'}`}>
                    {s.bezahlt ? 'Bezahlt' : s.zahlungsart}
                  </span>
                  <span className="font-bold">{s.betrag.toFixed(2)} €</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
