'use client';

import { useState, useEffect, useCallback } from 'react';
import { Navigation, MapPin, Clock, Route, CheckCircle2, AlertTriangle, Zap, Package, Phone, ExternalLink, ChevronDown, ChevronUp, Star } from 'lucide-react';

interface TourStop {
  nr: number;
  stop_id: string;
  adresse: string;
  etage: string | null;
  tuerkode: string | null;
  kunde_name: string;
  kunde_telefon: string | null;
  betrag: number;
  status: 'ausstehend' | 'aktiv' | 'geliefert' | 'verspaetet';
  eta_min: number | null;
  distanz_km: number;
  anmerkung: string | null;
  payment_method: 'cash' | 'card' | 'online';
  bewertung_offen: boolean;
}

interface NavApp {
  name: string;
  icon: string;
  url_template: string;
  verfuegbar: boolean;
}

interface ApiData {
  tour_id: string;
  stopps: TourStop[];
  gesamt_stopps: number;
  fertig_stopps: number;
  verbleibend_km: number;
  geschaetzte_restzeit_min: number;
  nav_apps: NavApp[];
  fahrer_lat: number | null;
  fahrer_lng: number | null;
  optimiert: boolean;
}

const NAV_APPS: NavApp[] = [
  { name: 'Google Maps', icon: '🗺️', url_template: 'https://www.google.com/maps/dir/?api=1&destination=', verfuegbar: true },
  { name: 'Waze',        icon: '🔵', url_template: 'https://waze.com/ul?navigate=yes&q=',                 verfuegbar: true },
];

const MOCK: ApiData = {
  tour_id: 'T-2024-001',
  gesamt_stopps: 5,
  fertig_stopps: 2,
  verbleibend_km: 4.8,
  geschaetzte_restzeit_min: 22,
  fahrer_lat: 50.7753,
  fahrer_lng: 6.0838,
  optimiert: true,
  nav_apps: NAV_APPS,
  stopps: [
    {
      nr: 1, stop_id: 's1', adresse: 'Jülicher Str. 77, 52070 Aachen',
      etage: '2. OG', tuerkode: '1234#', kunde_name: 'Herr Müller', kunde_telefon: '+4917012345678',
      betrag: 18.50, status: 'geliefert', eta_min: null, distanz_km: 2.1,
      anmerkung: null, payment_method: 'online', bewertung_offen: true,
    },
    {
      nr: 2, stop_id: 's2', adresse: 'Adalbertsteinweg 44, 52070 Aachen',
      etage: null, tuerkode: null, kunde_name: 'Frau Schmidt', kunde_telefon: '+4917087654321',
      betrag: 22.00, status: 'geliefert', eta_min: null, distanz_km: 1.8,
      anmerkung: 'Bitte klingeln — 2x lang', payment_method: 'cash', bewertung_offen: false,
    },
    {
      nr: 3, stop_id: 's3', adresse: 'Elisengarten 3, 52062 Aachen',
      etage: 'EG', tuerkode: null, kunde_name: 'Familie Weber', kunde_telefon: null,
      betrag: 35.50, status: 'aktiv', eta_min: 5, distanz_km: 1.4,
      anmerkung: 'Hund im Eingang — nicht erschrecken', payment_method: 'card', bewertung_offen: false,
    },
    {
      nr: 4, stop_id: 's4', adresse: 'Pontstraße 58, 52062 Aachen',
      etage: '3. OG', tuerkode: '9876*', kunde_name: 'Herr Koch', kunde_telefon: '+4917099988877',
      betrag: 12.00, status: 'ausstehend', eta_min: 14, distanz_km: 1.8,
      anmerkung: null, payment_method: 'online', bewertung_offen: false,
    },
    {
      nr: 5, stop_id: 's5', adresse: 'Kármánstr. 5, 52062 Aachen',
      etage: null, tuerkode: null, kunde_name: 'Frau Braun', kunde_telefon: null,
      betrag: 28.00, status: 'ausstehend', eta_min: 22, distanz_km: 1.6,
      anmerkung: null, payment_method: 'card', bewertung_offen: false,
    },
  ],
};

const STATUS_STYLE: Record<string, { dot: string; label: string; text: string; bg: string }> = {
  geliefert:  { dot: 'bg-green-500',   label: 'Geliefert',  text: 'text-green-600',   bg: 'bg-green-50' },
  aktiv:      { dot: 'bg-blue-500',    label: 'Aktiv',      text: 'text-blue-600',    bg: 'bg-blue-50' },
  ausstehend: { dot: 'bg-slate-400',   label: 'Ausstehend', text: 'text-slate-500',   bg: 'bg-slate-50' },
  verspaetet: { dot: 'bg-red-500',     label: 'Verspätet',  text: 'text-red-600',     bg: 'bg-red-50' },
};

const PAY_STYLE: Record<string, string> = {
  cash:   '💵 Bar',
  card:   '💳 Karte',
  online: '✅ Bezahlt',
};

interface Props {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase4985SmartTourStoppNavV11({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);
  const [expandedStop, setExpandedStop] = useState<string | null>('s3');

  const load = useCallback(async () => {
    if (!driverId || !locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/driver/tour-stops-v11?driver_id=${driverId}&location_id=${locationId}`);
      if (r.ok) { const j = await r.json(); if (!j.error) setData(j); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [driverId, locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const buildNavUrl = (app: NavApp, adresse: string) => {
    return `${app.url_template}${encodeURIComponent(adresse)}`;
  };

  const progressPct = data.gesamt_stopps > 0 ? (data.fertig_stopps / data.gesamt_stopps) * 100 : 0;

  if (!isOnline) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 text-center text-gray-400 text-sm">
        Tour-Navigation offline nicht verfügbar
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-gradient-to-r from-matcha-800 to-matcha-700 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Route size={16} className="text-accent" />
            <span className="text-sm font-bold text-white">Tour-Navigation V11</span>
            {data.optimiert && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent font-medium">KI-optimiert</span>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs text-matcha-200">{data.verbleibend_km} km · {data.geschaetzte_restzeit_min} Min</div>
          </div>
        </div>

        {/* Progress Circles */}
        <div className="flex gap-1.5 mb-2">
          {data.stopps.map(s => (
            <div
              key={s.nr}
              className={`flex-1 h-2 rounded-full ${
                s.status === 'geliefert' ? 'bg-green-400' :
                s.status === 'aktiv'     ? 'bg-accent' :
                s.status === 'verspaetet'? 'bg-red-400' : 'bg-white/20'
              }`}
            />
          ))}
        </div>
        <div className="text-xs text-matcha-200">
          {data.fertig_stopps} von {data.gesamt_stopps} Stopps geliefert
        </div>
      </div>

      {/* Stop List */}
      <div className="divide-y divide-gray-100">
        {data.stopps.map(s => {
          const ss = STATUS_STYLE[s.status];
          const isExpanded = expandedStop === s.stop_id;
          const isActive = s.status === 'aktiv';

          return (
            <div
              key={s.stop_id}
              className={`${isActive ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}
            >
              {/* Stop Header */}
              <button
                onClick={() => setExpandedStop(isExpanded ? null : s.stop_id)}
                className="w-full text-left px-4 py-3"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    s.status === 'geliefert' ? 'bg-green-100 text-green-700' :
                    s.status === 'aktiv'     ? 'bg-blue-500 text-white' :
                    s.status === 'verspaetet'? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {s.status === 'geliefert' ? '✓' : s.nr}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${s.status === 'geliefert' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                        {s.kunde_name}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${ss.bg} ${ss.text} font-medium`}>{ss.label}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate">{s.adresse}</div>
                    {s.eta_min !== null && (
                      <div className="flex items-center gap-1 mt-0.5 text-[10px] text-blue-600">
                        <Clock size={10} /> ETA: {s.eta_min} Min
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-sm font-bold ${s.payment_method === 'cash' ? 'text-orange-600' : 'text-gray-700'}`}>
                      €{s.betrag.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-gray-400">{PAY_STYLE[s.payment_method]}</div>
                    {isExpanded ? <ChevronUp size={14} className="text-gray-400 ml-auto mt-1" /> : <ChevronDown size={14} className="text-gray-400 ml-auto mt-1" />}
                  </div>
                </div>
              </button>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-3">
                  {/* Address Details */}
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
                    <div className="flex items-start gap-2">
                      <MapPin size={13} className="text-gray-400 mt-0.5 shrink-0" />
                      <span className="text-xs text-gray-700">{s.adresse}</span>
                    </div>
                    {s.etage && (
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <span className="text-gray-400">🏢</span>
                        <span>{s.etage}</span>
                      </div>
                    )}
                    {s.tuerkode && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">🔑</span>
                        <span className="text-xs font-mono font-bold text-gray-700 bg-yellow-100 px-2 py-0.5 rounded">
                          {s.tuerkode}
                        </span>
                      </div>
                    )}
                    {s.anmerkung && (
                      <div className="flex items-start gap-2">
                        <AlertTriangle size={12} className="text-amber-500 mt-0.5 shrink-0" />
                        <span className="text-xs text-amber-700">{s.anmerkung}</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  {s.status !== 'geliefert' && (
                    <div className="space-y-2">
                      {/* Nav Apps */}
                      <div className="flex gap-2">
                        {data.nav_apps.filter(a => a.verfuegbar).map(app => (
                          <a
                            key={app.name}
                            href={buildNavUrl(app, s.adresse)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-matcha-800 text-white text-xs font-semibold"
                          >
                            <span>{app.icon}</span>
                            <span>{app.name.split(' ')[0]}</span>
                            <ExternalLink size={11} />
                          </a>
                        ))}
                      </div>

                      {/* Phone Button */}
                      {s.kunde_telefon && (
                        <a
                          href={`tel:${s.kunde_telefon}`}
                          className="flex items-center justify-center gap-2 w-full py-2 rounded-xl border border-gray-200 text-gray-700 text-xs font-medium"
                        >
                          <Phone size={13} />
                          Anrufen
                        </a>
                      )}
                    </div>
                  )}

                  {/* Review Reminder */}
                  {s.bewertung_offen && s.status === 'geliefert' && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-yellow-50 border border-yellow-200">
                      <Star size={13} className="text-yellow-500" />
                      <span className="text-xs text-yellow-700 font-medium">Kunden-Bewertung noch offen</span>
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
