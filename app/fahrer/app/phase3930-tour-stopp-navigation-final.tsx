'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, Phone, Navigation, CheckCircle2, Clock, Package, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

interface TourStopp {
  id: string;
  reihenfolge: number;
  status: 'ausstehend' | 'unterwegs' | 'geliefert';
  kunde_name: string | null;
  adresse: string | null;
  telefon: string | null;
  eta_min: number | null;
  kommentar: string | null;
  pakete: number;
  lat: number | null;
  lng: number | null;
}

interface TourMeta {
  tour_id: string;
  score: number;
  geliefert: number;
  gesamt: number;
}

const MOCK_STOPPS: TourStopp[] = [
  { id: 's1', reihenfolge: 1, status: 'geliefert', kunde_name: 'Müller', adresse: 'Hauptstr. 12, Berlin', telefon: '+49 30 1234567', eta_min: null, kommentar: null, pakete: 2, lat: 52.52, lng: 13.405 },
  { id: 's2', reihenfolge: 2, status: 'unterwegs', kunde_name: 'Schmidt', adresse: 'Berliner Allee 45, Berlin', telefon: '+49 30 2345678', eta_min: 5, kommentar: 'Bitte klingeln — 3. OG', pakete: 1, lat: 52.525, lng: 13.412 },
  { id: 's3', reihenfolge: 3, status: 'ausstehend', kunde_name: 'Weber', adresse: 'Kastanienallee 8, Berlin', telefon: '+49 30 3456789', eta_min: 14, kommentar: null, pakete: 3, lat: 52.531, lng: 13.418 },
  { id: 's4', reihenfolge: 4, status: 'ausstehend', kunde_name: 'Fischer', adresse: 'Rosenthaler Str. 22, Berlin', telefon: null, eta_min: 22, kommentar: null, pakete: 1, lat: 52.528, lng: 13.401 },
];
const MOCK_META: TourMeta = { tour_id: 't1', score: 82, geliefert: 1, gesamt: 4 };

function statusDot(s: TourStopp['status']) {
  if (s === 'geliefert') return 'bg-emerald-500';
  if (s === 'unterwegs') return 'bg-blue-500 animate-pulse';
  return 'bg-slate-300';
}

function mapsUrl(adresse: string | null, lat: number | null, lng: number | null) {
  if (lat && lng) return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  if (adresse) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}`;
  return null;
}

function wazeUrl(lat: number | null, lng: number | null, adresse: string | null) {
  if (lat && lng) return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  if (adresse) return `https://waze.com/ul?q=${encodeURIComponent(adresse ?? '')}&navigate=yes`;
  return null;
}

export function FahrerPhase3930TourStoppNavigationFinal({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [stopps, setStopps] = useState<TourStopp[]>(MOCK_STOPPS);
  const [meta, setMeta] = useState<TourMeta>(MOCK_META);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    if (!driverId || !isOnline) return;
    try {
      const res = await fetch(`/api/delivery/fahrer/tour-stopps?driver_id=${driverId}&location_id=${locationId ?? ''}`);
      if (res.ok) {
        const d = await res.json();
        if (Array.isArray(d.stopps)) setStopps(d.stopps);
        if (d.meta) setMeta(d.meta);
      }
    } catch { /* Mock-Fallback */ }
  }, [driverId, locationId, isOnline]);

  useEffect(() => { load(); const id = setInterval(load, 10000); return () => clearInterval(id); }, [load]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  if (!isOnline) return null;

  const aktiv = stopps.find(s => s.status === 'unterwegs') ?? stopps.find(s => s.status === 'ausstehend') ?? null;
  const fortschritt = meta.gesamt > 0 ? Math.round((meta.geliefert / meta.gesamt) * 100) : 0;

  return (
    <div className="rounded-xl border border-blue-100 bg-white p-4 space-y-3 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Navigation className="h-4 w-4 text-blue-600 shrink-0" />
        <span className="font-semibold text-sm text-slate-800">Tour-Stopps · Navigation Final</span>
        <span className={`ml-auto text-xs font-bold tabular-nums px-2 py-0.5 rounded-full ${meta.score >= 80 ? 'bg-emerald-100 text-emerald-700' : meta.score >= 65 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'}`}>
          Score {meta.score}
        </span>
      </div>

      {/* Fortschrittsbalken */}
      <div>
        <div className="flex justify-between text-[10px] text-slate-500 mb-1">
          <span>{meta.geliefert} von {meta.gesamt} geliefert</span>
          <span>{fortschritt}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-500"
            style={{ width: `${fortschritt}%` }}
          />
        </div>
      </div>

      {/* Aktiver Stopp — Hero-Card */}
      {aktiv && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-bold text-slate-800">{aktiv.kunde_name ?? `Stopp ${aktiv.reihenfolge}`}</div>
                <div className="text-xs text-slate-500 leading-tight">{aktiv.adresse}</div>
              </div>
            </div>
            {aktiv.eta_min !== null && (
              <div className="text-right shrink-0">
                <div className="text-lg font-black text-blue-700 tabular-nums">{aktiv.eta_min} Min</div>
                <div className="text-[9px] text-slate-400">ETA</div>
              </div>
            )}
          </div>

          {aktiv.kommentar && (
            <div className="flex items-start gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-2 py-1.5">
              <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
              <span className="text-[11px] text-amber-700">{aktiv.kommentar}</span>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <Package className="h-3 w-3" /> {aktiv.pakete} Paket{aktiv.pakete !== 1 ? 'e' : ''}
            </div>
            <div className="ml-auto flex gap-1.5">
              {aktiv.telefon && (
                <a href={`tel:${aktiv.telefon}`}
                  className="flex items-center gap-1 rounded-lg bg-emerald-600 text-white px-2.5 py-1 text-[11px] font-semibold">
                  <Phone className="h-3 w-3" /> Anrufen
                </a>
              )}
              {mapsUrl(aktiv.adresse, aktiv.lat, aktiv.lng) && (
                <a href={mapsUrl(aktiv.adresse, aktiv.lat, aktiv.lng)!} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-lg bg-blue-600 text-white px-2.5 py-1 text-[11px] font-semibold">
                  <MapPin className="h-3 w-3" /> Maps
                </a>
              )}
              {wazeUrl(aktiv.lat, aktiv.lng, aktiv.adresse) && (
                <a href={wazeUrl(aktiv.lat, aktiv.lng, aktiv.adresse)!} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-lg bg-sky-500 text-white px-2.5 py-1 text-[11px] font-semibold">
                  <Navigation className="h-3 w-3" /> Waze
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Alle Stopps */}
      <div className="space-y-1.5">
        {stopps.map(s => {
          const isOpen = expanded === s.id;
          const isAktiv = s.id === aktiv?.id;
          if (isAktiv) return null;
          return (
            <div key={s.id}
              className={`rounded-lg border p-2 cursor-pointer ${s.status === 'geliefert' ? 'border-emerald-100 bg-emerald-50' : 'border-slate-100 bg-slate-50'}`}
              onClick={() => setExpanded(isOpen ? null : s.id)}>
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${statusDot(s.status)}`} />
                <span className="text-xs font-semibold text-slate-700 flex-1 truncate">{s.kunde_name ?? `Stopp ${s.reihenfolge}`}</span>
                {s.status === 'geliefert' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                {s.eta_min !== null && s.status !== 'geliefert' && (
                  <span className="text-[10px] text-slate-500 tabular-nums flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5" /> {s.eta_min}m
                  </span>
                )}
                {isOpen ? <ChevronUp className="h-3 w-3 text-slate-400 shrink-0" /> : <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />}
              </div>
              {isOpen && (
                <div className="mt-2 pt-2 border-t border-slate-200 space-y-1.5">
                  {s.adresse && <div className="text-[10px] text-slate-500">{s.adresse}</div>}
                  {s.kommentar && (
                    <div className="flex items-start gap-1 rounded bg-amber-50 px-1.5 py-1">
                      <AlertTriangle className="h-2.5 w-2.5 text-amber-400 shrink-0 mt-0.5" />
                      <span className="text-[10px] text-amber-700">{s.kommentar}</span>
                    </div>
                  )}
                  <div className="flex gap-1.5">
                    {s.telefon && (
                      <a href={`tel:${s.telefon}`}
                        className="flex items-center gap-0.5 rounded bg-emerald-100 text-emerald-700 px-1.5 py-0.5 text-[10px] font-semibold">
                        <Phone className="h-2.5 w-2.5" /> Anruf
                      </a>
                    )}
                    {mapsUrl(s.adresse, s.lat, s.lng) && (
                      <a href={mapsUrl(s.adresse, s.lat, s.lng)!} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-0.5 rounded bg-blue-100 text-blue-700 px-1.5 py-0.5 text-[10px] font-semibold">
                        <MapPin className="h-2.5 w-2.5" /> Maps
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-[10px] text-slate-400 flex items-center gap-1">
        <Navigation className="h-3 w-3" />
        <span>Tour-Stopps Final · Hero-Navi · 10-Sek-Polling</span>
      </div>
    </div>
  );
}
