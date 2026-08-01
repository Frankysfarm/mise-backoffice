'use client';

import { useEffect, useRef, useState } from 'react';
import { Route, CheckCircle2, Clock, WifiOff, AlertTriangle, ChevronDown, ChevronUp, Navigation, Phone, MessageSquare, Star } from 'lucide-react';

// Phase 5478 — Tour-Stops & Navigation Hub V11
// Neu: Multi-App-Navigation-Wähler (Google Maps/Waze/Apple); Sprach-Navigations-Hinweis;
// Distanz-Fortschritts-Ring (SVG); Kunden-Kontakt-Direktaktionen (Anruf/SMS);
// Stopp-Bewertungs-Prompt nach Abschluss; ETA-Genauigkeits-Badge;
// 7-KPI-Grid Stops/Fertig/Offen/Km/ETA-Score/Profit/Kontakte;
// GPS-Multi-App-Deeplinks; expand/collapse; Offline-Guard; 30-Sek-Poll; Mock-Fallback

type StopStatus = 'anfahrt' | 'offen' | 'fertig' | 'problem';
type Zahlung    = 'karte' | 'bar' | 'digital';
type NavApp     = 'google' | 'waze' | 'apple';

interface TourStop {
  id: string;
  seq: number;
  adresse: string;
  kunde: string;
  telefon: string;
  eta_min: number;
  eta_score: number;
  status: StopStatus;
  distanz_km: number;
  zahlung: Zahlung;
  ki_optimal: boolean;
  betrag: number;
  lat: number;
  lng: number;
  bewertung?: number;
}

interface ApiData {
  tour_id: string;
  gesamt_stops: number;
  fertig: number;
  offen: number;
  gesamt_km: number;
  eta_score_avg: number;
  profit_heute: number;
  kontakte_versuche: number;
  stops: TourStop[];
}

const MOCK: ApiData = {
  tour_id: 'T-2025',
  gesamt_stops: 7,
  fertig: 3,
  offen: 4,
  gesamt_km: 14.2,
  eta_score_avg: 87,
  profit_heute: 68.5,
  kontakte_versuche: 1,
  stops: [
    { id: 's1', seq: 1, adresse: 'Hauptstr. 12, Aachen',  kunde: 'Hans M.',   telefon: '+4915201234567', eta_min: 0,  eta_score: 95, status: 'fertig',  distanz_km: 2.1, zahlung: 'karte',   ki_optimal: true,  betrag: 18.90, lat: 50.776, lng: 6.084, bewertung: 5 },
    { id: 's2', seq: 2, adresse: 'Römerstr. 5, Aachen',   kunde: 'Lisa K.',   telefon: '+4915209876543', eta_min: 0,  eta_score: 91, status: 'fertig',  distanz_km: 1.4, zahlung: 'digital', ki_optimal: true,  betrag: 24.50, lat: 50.779, lng: 6.091, bewertung: 4 },
    { id: 's3', seq: 3, adresse: 'Adalbertsteinweg 44',   kunde: 'Tom B.',    telefon: '+4915200112233', eta_min: 0,  eta_score: 88, status: 'fertig',  distanz_km: 0.9, zahlung: 'bar',    ki_optimal: false, betrag: 12.80, lat: 50.773, lng: 6.097 },
    { id: 's4', seq: 4, adresse: 'Borngasse 17, Aachen',  kunde: 'Sara N.',   telefon: '+4915204455667', eta_min: 4,  eta_score: 82, status: 'anfahrt', distanz_km: 2.8, zahlung: 'karte',  ki_optimal: true,  betrag: 31.20, lat: 50.769, lng: 6.079 },
    { id: 's5', seq: 5, adresse: 'Elisabethstr. 8',       kunde: 'Ahmad R.',  telefon: '+4915207788990', eta_min: 11, eta_score: 78, status: 'offen',   distanz_km: 1.7, zahlung: 'digital',ki_optimal: false, betrag: 19.60, lat: 50.782, lng: 6.088 },
    { id: 's6', seq: 6, adresse: 'Pontstraße 22, Aachen', kunde: 'Maria L.',  telefon: '+4915201122334', eta_min: 16, eta_score: 74, status: 'offen',   distanz_km: 3.1, zahlung: 'karte',  ki_optimal: true,  betrag: 27.40, lat: 50.775, lng: 6.083 },
    { id: 's7', seq: 7, adresse: 'Seilgraben 3, Aachen',  kunde: 'Daniel F.', telefon: '+4915209988776', eta_min: 22, eta_score: 69, status: 'offen',   distanz_km: 2.2, zahlung: 'bar',   ki_optimal: false, betrag: 14.10, lat: 50.770, lng: 6.095 },
  ],
};

const STATUS_COLOR: Record<StopStatus, string> = {
  anfahrt: 'text-blue-400',
  offen:   'text-gray-400',
  fertig:  'text-green-400',
  problem: 'text-red-400',
};

const STATUS_LABEL: Record<StopStatus, string> = {
  anfahrt: 'Anfahrt',
  offen:   'Offen',
  fertig:  'Erledigt',
  problem: 'Problem',
};

const ZAHLUNG_LABEL: Record<Zahlung, string> = {
  karte:   'Karte',
  bar:     'Bar',
  digital: 'Digital',
};

function navUrl(stop: TourStop, app: NavApp): string {
  const dest = `${stop.lat},${stop.lng}`;
  if (app === 'google') return `https://maps.google.com/maps?daddr=${dest}`;
  if (app === 'waze')   return `https://waze.com/ul?ll=${dest}&navigate=yes`;
  return `http://maps.apple.com/?daddr=${dest}`;
}

function etaScoreColor(s: number): string {
  if (s >= 85) return 'text-green-400';
  if (s >= 70) return 'text-amber-400';
  return 'text-red-400';
}

export function FahrerPhase5478TourStopsNavHubV11({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData]         = useState<ApiData>(MOCK);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['s4']));
  const [navApp, setNavApp]     = useState<NavApp>('google');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!isOnline || !driverId) return;
    try {
      const r = await fetch(
        `/api/delivery/driver/tour?driver_id=${driverId}${locationId ? `&location_id=${locationId}` : ''}`,
      );
      if (r.ok) setData(await r.json());
    } catch { /* use mock */ }
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 30_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, locationId, isOnline]);

  if (!isOnline) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-gray-900 border border-gray-700/50 px-3 py-2">
        <WifiOff className="h-3.5 w-3.5 text-gray-600" />
        <span className="text-xs text-gray-500">Tour-Stops — offline nicht verfügbar</span>
      </div>
    );
  }

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const fortschritt_pct = Math.round((data.fertig / data.gesamt_stops) * 100);

  const NAV_APPS: { key: NavApp; label: string }[] = [
    { key: 'google', label: 'Google' },
    { key: 'waze',   label: 'Waze'   },
    { key: 'apple',  label: 'Apple'  },
  ];

  return (
    <div className="rounded-lg bg-gray-900 border border-blue-700/40 p-3 space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Route className="h-3.5 w-3.5 text-blue-400" />
          <span className="text-xs font-semibold text-white">Tour-Stops Hub V11</span>
        </div>
        {data.kontakte_versuche > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-amber-400">
            <Phone className="h-3 w-3" />
            {data.kontakte_versuche} Kontaktversuch
          </div>
        )}
      </div>

      {/* Fortschritts-Ring + KPIs */}
      <div className="flex items-center gap-3">
        {/* SVG Distanz-Ring */}
        <div className="relative shrink-0 w-14 h-14">
          <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
            <circle cx="28" cy="28" r="22" fill="none" stroke="#1f2937" strokeWidth="5" />
            <circle
              cx="28" cy="28" r="22" fill="none"
              stroke="#60a5fa" strokeWidth="5"
              strokeDasharray={`${2 * Math.PI * 22}`}
              strokeDashoffset={`${2 * Math.PI * 22 * (1 - fortschritt_pct / 100)}`}
              strokeLinecap="round"
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
            <span className="text-sm font-black text-white">{fortschritt_pct}%</span>
            <span className="text-[8px] text-gray-400">Tour</span>
          </div>
        </div>

        {/* 7-KPI-Grid */}
        <div className="grid grid-cols-4 gap-1 flex-1">
          {[
            { label: 'Stops',   value: data.gesamt_stops,   color: 'text-white'       },
            { label: 'Fertig',  value: data.fertig,         color: 'text-green-400'   },
            { label: 'Offen',   value: data.offen,          color: 'text-blue-400'    },
            { label: 'km',      value: `${data.gesamt_km.toFixed(1)}`, color: 'text-gray-300' },
            { label: 'ETA-Sc.', value: data.eta_score_avg, color: etaScoreColor(data.eta_score_avg) },
            { label: '€ Heute', value: `${data.profit_heute.toFixed(0)}`, color: 'text-emerald-400' },
            { label: 'Kontakt', value: data.kontakte_versuche, color: 'text-amber-400' },
          ].map(k => (
            <div key={k.label} className="rounded bg-gray-800 px-1 py-1 text-center">
              <div className="text-[8px] text-gray-500 leading-none">{k.label}</div>
              <div className={`text-xs font-bold ${k.color}`}>{k.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Nav-App-Wähler */}
      <div className="flex items-center gap-1.5">
        <Navigation className="h-3 w-3 text-gray-400 shrink-0" />
        <span className="text-[10px] text-gray-400">Navi:</span>
        {NAV_APPS.map(a => (
          <button
            key={a.key}
            onClick={() => setNavApp(a.key)}
            className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${
              navApp === a.key ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'
            }`}
          >
            {a.label}
          </button>
        ))}
        <span className="text-[9px] text-gray-600 ml-auto">Sprache: DE</span>
      </div>

      {/* Stopp-Liste */}
      <div className="space-y-1">
        {data.stops.map(s => {
          const isOpen = expanded.has(s.id);
          return (
            <div key={s.id} className={`rounded-lg border ${s.status === 'anfahrt' ? 'border-blue-600/60 bg-blue-900/20' : 'border-gray-700/50 bg-gray-800/40'}`}>
              <button
                onClick={() => toggle(s.id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-left"
              >
                <span className="text-[10px] text-gray-500 w-4 shrink-0">{s.seq}</span>
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.status === 'fertig' ? 'bg-green-400' : s.status === 'anfahrt' ? 'bg-blue-400' : s.status === 'problem' ? 'bg-red-400' : 'bg-gray-600'}`} />
                <span className="text-[10px] text-white truncate flex-1">{s.adresse}</span>
                {s.status !== 'fertig' && (
                  <span className="text-[10px] text-gray-400 shrink-0">{s.eta_min}m</span>
                )}
                {s.status === 'fertig' && s.bewertung && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    {Array.from({ length: s.bewertung }).map((_, i) => (
                      <Star key={i} className="h-2.5 w-2.5 text-yellow-400 fill-yellow-400" />
                    ))}
                  </div>
                )}
                {isOpen ? <ChevronUp className="h-3 w-3 text-gray-500 shrink-0" /> : <ChevronDown className="h-3 w-3 text-gray-500 shrink-0" />}
              </button>

              {isOpen && (
                <div className="px-2 pb-2 space-y-1.5 border-t border-gray-700/50 pt-1.5">
                  <div className="grid grid-cols-3 gap-1 text-center">
                    <div className="rounded bg-gray-800 px-1 py-1">
                      <div className="text-[8px] text-gray-500">Kunde</div>
                      <div className="text-[10px] text-white truncate">{s.kunde}</div>
                    </div>
                    <div className="rounded bg-gray-800 px-1 py-1">
                      <div className="text-[8px] text-gray-500">Zahlung</div>
                      <div className="text-[10px] text-amber-400">{ZAHLUNG_LABEL[s.zahlung]}</div>
                    </div>
                    <div className="rounded bg-gray-800 px-1 py-1">
                      <div className="text-[8px] text-gray-500">Betrag</div>
                      <div className="text-[10px] text-emerald-400">€{s.betrag.toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-gray-500">ETA-Score:</span>
                      <span className={`text-[9px] font-bold ${etaScoreColor(s.eta_score)}`}>{s.eta_score}</span>
                      {s.ki_optimal && (
                        <span className="text-[8px] text-indigo-400 bg-indigo-900/30 px-1 rounded">KI-Opt.</span>
                      )}
                    </div>
                    <span className="text-[9px] text-gray-500">{s.distanz_km.toFixed(1)} km</span>
                  </div>

                  {/* Aktionen */}
                  {s.status !== 'fertig' && (
                    <div className="flex gap-1.5">
                      <a
                        href={navUrl(s, navApp)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1 rounded bg-blue-600 text-white text-[10px] py-1 hover:bg-blue-500 transition-colors"
                      >
                        <Navigation className="h-3 w-3" />
                        {NAV_APPS.find(a => a.key === navApp)?.label}
                      </a>
                      <a
                        href={`tel:${s.telefon}`}
                        className="flex items-center justify-center gap-1 rounded bg-green-700 text-white text-[10px] px-2 py-1 hover:bg-green-600 transition-colors"
                      >
                        <Phone className="h-3 w-3" />
                      </a>
                      <a
                        href={`sms:${s.telefon}`}
                        className="flex items-center justify-center gap-1 rounded bg-gray-700 text-white text-[10px] px-2 py-1 hover:bg-gray-600 transition-colors"
                      >
                        <MessageSquare className="h-3 w-3" />
                      </a>
                    </div>
                  )}

                  {/* Bewertungs-Prompt nach Abschluss */}
                  {s.status === 'fertig' && !s.bewertung && (
                    <div className="flex items-center gap-1 text-[10px] text-yellow-400">
                      <Star className="h-3 w-3" />
                      Bewertung ausstehend
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
