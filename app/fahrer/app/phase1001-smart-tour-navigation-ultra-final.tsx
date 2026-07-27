'use client';

import { useState, useEffect, useCallback } from 'react';
import { Navigation, MapPin, Clock, CheckCircle2, AlertTriangle, Zap, Phone, Map, ChevronRight, Package } from 'lucide-react';

/**
 * Phase 1001 — Smart-Tour-Navigation Ultra Final (Fahrer-App)
 *
 * Nächster-Stopp-Fokus mit ETA-Countdown (1-Sek-Tick)
 * Stopp-Sequenz mit Farbkodierung geliefert/aktiv/ausstehend
 * Quick-Nav: Google Maps / Waze / Apple Maps
 * Kunden-Kontakt + Tour-Fortschritt
 * 30-Sek-Polling; isOnline-Guard; Mock-Fallback
 */

type StoppStatus = 'geliefert' | 'aktiv' | 'ausstehend';

interface TourStopp {
  id: string;
  nr: number;
  kundenname: string;
  adresse: string;
  adresse_lat: number | null;
  adresse_lng: number | null;
  telefon: string | null;
  status: StoppStatus;
  eta_min: number | null;
  lieferzeit_min: number | null;
  notiz: string | null;
  artikel_anzahl: number;
}

interface TourData {
  tour_id: string;
  stopps: TourStopp[];
  naechster_stopp: TourStopp | null;
  eta_naechster_min: number;
  stopps_erledigt: number;
  stopps_gesamt: number;
  distanz_rest_km: number;
  ist_online: boolean;
}

const MOCK: TourData = {
  tour_id: 't-demo',
  eta_naechster_min: 8,
  stopps_erledigt: 2,
  stopps_gesamt: 5,
  distanz_rest_km: 4.2,
  ist_online: true,
  naechster_stopp: {
    id: 's3', nr: 3, kundenname: 'Bettina Weber', adresse: 'Pontstraße 14, Aachen',
    adresse_lat: 50.7753, adresse_lng: 6.0839, telefon: '+49 241 123456', status: 'aktiv',
    eta_min: 8, lieferzeit_min: null, notiz: 'Klingel 2. OG links', artikel_anzahl: 3,
  },
  stopps: [
    { id: 's1', nr: 1, kundenname: 'Klaus Schmidt',   adresse: 'Adalbertsteinweg 12', adresse_lat: null, adresse_lng: null, telefon: null, status: 'geliefert',  eta_min: null, lieferzeit_min: 19, notiz: null,              artikel_anzahl: 2 },
    { id: 's2', nr: 2, kundenname: 'Anna Müller',     adresse: 'Jülicher Str. 8',     adresse_lat: null, adresse_lng: null, telefon: null, status: 'geliefert',  eta_min: null, lieferzeit_min: 23, notiz: null,              artikel_anzahl: 1 },
    { id: 's3', nr: 3, kundenname: 'Bettina Weber',   adresse: 'Pontstraße 14',       adresse_lat: 50.7753, adresse_lng: 6.0839, telefon: '+49 241 123456', status: 'aktiv',      eta_min: 8,    lieferzeit_min: null, notiz: 'Klingel 2. OG', artikel_anzahl: 3 },
    { id: 's4', nr: 4, kundenname: 'Thomas Bauer',    adresse: 'Habsburgerallee 5',   adresse_lat: null, adresse_lng: null, telefon: null, status: 'ausstehend', eta_min: 18,   lieferzeit_min: null, notiz: null,              artikel_anzahl: 2 },
    { id: 's5', nr: 5, kundenname: 'Sabine Fischer',  adresse: 'Vaalser Str. 20',     adresse_lat: null, adresse_lng: null, telefon: null, status: 'ausstehend', eta_min: 30,   lieferzeit_min: null, notiz: null,              artikel_anzahl: 1 },
  ],
};

const STATUS_CFG: Record<StoppStatus, { dot: string; bg: string; text: string; borderColor: string }> = {
  geliefert:  { dot: 'bg-green-500',  bg: 'bg-green-50 dark:bg-green-950',  text: 'text-green-700 dark:text-green-300',  borderColor: 'border-green-200 dark:border-green-800' },
  aktiv:      { dot: 'bg-blue-500 animate-pulse', bg: 'bg-blue-50 dark:bg-blue-950', text: 'text-blue-700 dark:text-blue-300',   borderColor: 'border-blue-300 dark:border-blue-700'  },
  ausstehend: { dot: 'bg-muted-foreground', bg: 'bg-muted/50',              text: 'text-muted-foreground',               borderColor: 'border-border'                          },
};

function openNavigation(adresse: string, lat: number | null, lng: number | null, app: 'google' | 'waze' | 'apple') {
  const encoded = encodeURIComponent(adresse);
  const coords = lat && lng ? `${lat},${lng}` : null;
  const urls: Record<string, string> = {
    google: coords ? `https://www.google.com/maps/dir/?api=1&destination=${coords}` : `https://www.google.com/maps/search/?q=${encoded}`,
    waze:   coords ? `https://waze.com/ul?ll=${coords}&navigate=yes` : `https://waze.com/ul?q=${encoded}&navigate=yes`,
    apple:  coords ? `https://maps.apple.com/?daddr=${coords}` : `https://maps.apple.com/?q=${encoded}`,
  };
  window.open(urls[app], '_blank');
}

export function FahrerPhase1001SmartTourNavigationUltraFinal({
  driverId,
  isOnline,
}: {
  driverId?: string | null;
  isOnline?: boolean;
}) {
  const [data, setData] = useState<TourData>(MOCK);
  const [etaSec, setEtaSec] = useState(MOCK.eta_naechster_min * 60);
  const [useMock, setUseMock] = useState(true);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!driverId || !isOnline) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/fahrer/aktuelle-tour?driver_id=${driverId}`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error();
      const d = await res.json();
      if (d?.tour_id) {
        setData(d);
        setEtaSec((d.eta_naechster_min ?? 0) * 60);
        setUseMock(false);
      }
    } catch {
      setUseMock(true);
    } finally {
      setLoading(false);
    }
  }, [driverId, isOnline]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    if (!driverId || !isOnline) return;
    const iv = setInterval(fetchData, 30_000);
    return () => clearInterval(iv);
  }, [fetchData, driverId, isOnline]);

  useEffect(() => {
    const t = setInterval(() => setEtaSec(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const fortschritt = Math.round((data.stopps_erledigt / Math.max(data.stopps_gesamt, 1)) * 100);
  const etaMin = Math.floor(etaSec / 60);
  const etaSecRest = etaSec % 60;
  const naechster = data.naechster_stopp;

  if (!data.stopps.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 flex flex-col items-center gap-2 text-muted-foreground">
        <CheckCircle2 className="h-8 w-8 text-green-500" />
        <span className="text-sm font-medium">Keine aktive Tour</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Nächster-Stopp-Hero */}
      {naechster && (
        <div className="bg-blue-600 dark:bg-blue-800 text-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Navigation className="h-4 w-4" />
              <span className="text-sm font-semibold">Nächster Stopp</span>
              {useMock && <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded">Demo</span>}
            </div>
            <div className="text-2xl font-bold tabular-nums">
              {etaMin}:{String(etaSecRest).padStart(2, '0')} min
            </div>
          </div>

          <div>
            <div className="font-semibold">{naechster.kundenname}</div>
            <div className="text-sm text-blue-100 flex items-center gap-1">
              <MapPin className="h-3 w-3" />{naechster.adresse}
            </div>
            {naechster.notiz && (
              <div className="text-xs text-blue-200 mt-0.5 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />{naechster.notiz}
              </div>
            )}
            <div className="text-xs text-blue-200 mt-0.5 flex items-center gap-1">
              <Package className="h-3 w-3" />{naechster.artikel_anzahl} Artikel · Stopp {naechster.nr} von {data.stopps_gesamt}
            </div>
          </div>

          {/* Navigation-Buttons */}
          <div className="grid grid-cols-3 gap-2">
            {(['google', 'waze', 'apple'] as const).map(app => (
              <button
                key={app}
                onClick={() => openNavigation(naechster.adresse, naechster.adresse_lat, naechster.adresse_lng, app)}
                className="flex items-center justify-center gap-1 bg-white/20 hover:bg-white/30 rounded-lg py-2 text-xs font-medium transition-colors"
              >
                <Map className="h-3 w-3" />
                {app === 'google' ? 'Google' : app === 'waze' ? 'Waze' : 'Apple'}
              </button>
            ))}
          </div>

          {/* Telefon */}
          {naechster.telefon && (
            <a
              href={`tel:${naechster.telefon}`}
              className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 rounded-lg py-2 text-sm font-medium transition-colors"
            >
              <Phone className="h-4 w-4" />
              Kunde anrufen
            </a>
          )}
        </div>
      )}

      {/* Tour-Fortschritt */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium">{data.stopps_erledigt} / {data.stopps_gesamt} Stopps</span>
          <span className="text-xs text-muted-foreground">{data.distanz_rest_km.toFixed(1)} km verbleibend</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-500"
            style={{ width: `${fortschritt}%` }}
          />
        </div>
      </div>

      {/* Stopp-Liste */}
      <div className="divide-y divide-border">
        {data.stopps.map(s => {
          const cfg = STATUS_CFG[s.status];
          return (
            <div key={s.id} className={`flex items-center gap-3 px-3 py-2.5 ${cfg.bg}`}>
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${s.status === 'geliefert' ? 'bg-green-100 dark:bg-green-900 text-green-700' : s.status === 'aktiv' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700' : 'bg-muted text-muted-foreground'}`}>
                {s.status === 'geliefert' ? '✓' : s.nr}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium truncate ${cfg.text}`}>{s.kundenname}</div>
                <div className="text-[10px] text-muted-foreground truncate">{s.adresse}</div>
              </div>
              <div className="flex-shrink-0 text-right">
                {s.status === 'geliefert' && s.lieferzeit_min && (
                  <span className="text-[10px] text-green-600 dark:text-green-400 font-medium tabular-nums">{s.lieferzeit_min}m ✓</span>
                )}
                {s.status !== 'geliefert' && s.eta_min !== null && (
                  <span className={`text-[10px] font-medium tabular-nums ${s.status === 'aktiv' ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}`}>
                    ~{s.eta_min}m
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
