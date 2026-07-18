'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle2, Clock, MapPin, Navigation, Navigation2, Phone, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type StoppStatus = 'pending' | 'active' | 'done';

type TourStopp = {
  id: string;
  reihenfolge: number;
  adresse: string;
  kunde_name: string | null;
  telefon: string | null;
  lat: number | null;
  lng: number | null;
  eta_min: number | null;
  status: StoppStatus;
  notiz: string | null;
};

type TourData = {
  batch_id: string;
  stopps: TourStopp[];
  start_adresse: string;
  total_stopps: number;
  erledigte_stopps: number;
  restzeit_min: number | null;
};

type NavApp = 'google' | 'waze' | 'apple';

const NAV_APPS: { key: NavApp; label: string; icon: string; urlFn: (lat: number, lng: number, adresse: string) => string }[] = [
  {
    key: 'google',
    label: 'Google Maps',
    icon: '🗺',
    urlFn: (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`,
  },
  {
    key: 'waze',
    label: 'Waze',
    icon: '🚗',
    urlFn: (lat, lng) => `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
  },
  {
    key: 'apple',
    label: 'Apple Maps',
    icon: '🍎',
    urlFn: (lat, lng) => `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`,
  },
];

function getMockTour(): TourData {
  return {
    batch_id: 'mock-tour-1',
    start_adresse: 'Restaurant Matcha, Hauptstraße 12, Berlin',
    total_stopps: 3,
    erledigte_stopps: 1,
    restzeit_min: 24,
    stopps: [
      {
        id: 's1',
        reihenfolge: 1,
        adresse: 'Musterstraße 45, 10115 Berlin',
        kunde_name: 'Anna M.',
        telefon: null,
        lat: 52.5200,
        lng: 13.4050,
        eta_min: null,
        status: 'done',
        notiz: null,
      },
      {
        id: 's2',
        reihenfolge: 2,
        adresse: 'Berliner Allee 78, 10243 Berlin',
        kunde_name: 'Jonas K.',
        telefon: '+49 160 123 4567',
        lat: 52.5150,
        lng: 13.4300,
        eta_min: 8,
        status: 'active',
        notiz: '3. Etage, kein Aufzug',
      },
      {
        id: 's3',
        reihenfolge: 3,
        adresse: 'Friedrichstraße 120, 10117 Berlin',
        kunde_name: 'Lea B.',
        telefon: null,
        lat: 52.5100,
        lng: 13.3880,
        eta_min: 18,
        status: 'pending',
        notiz: null,
      },
    ],
  };
}

const STATUS_STYLE: Record<StoppStatus, { icon: string; ring: string; text: string; label: string }> = {
  done:    { icon: '✓',  ring: 'border-matcha-400 bg-matcha-400',  text: 'text-matcha-700',  label: 'Geliefert' },
  active:  { icon: '●',  ring: 'border-blue-500 bg-blue-500',      text: 'text-blue-700',    label: 'Aktiv' },
  pending: { icon: '○',  ring: 'border-muted-foreground/30 bg-muted/20', text: 'text-muted-foreground', label: 'Ausstehend' },
};

function NavButtons({ stopp }: { stopp: TourStopp }) {
  if (stopp.lat === null || stopp.lng === null) return null;
  return (
    <div className="flex gap-1.5 mt-2 flex-wrap">
      {NAV_APPS.map(app => (
        <a
          key={app.key}
          href={app.urlFn(stopp.lat!, stopp.lng!, stopp.adresse)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 rounded-lg border bg-white dark:bg-zinc-900 px-2 py-1 text-[10px] font-bold text-foreground hover:bg-muted/40 transition-colors shadow-sm"
        >
          <span>{app.icon}</span>
          {app.label}
        </a>
      ))}
    </div>
  );
}

function StoppKarte({ stopp, isFirst }: { stopp: TourStopp; isFirst: boolean }) {
  const s = STATUS_STYLE[stopp.status];
  const isActive = stopp.status === 'active';
  const isDone = stopp.status === 'done';

  return (
    <div className={cn(
      'rounded-xl border p-3 transition-all',
      isActive ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/20' :
      isDone   ? 'border-muted/30 bg-muted/10 opacity-60' :
                 'border-muted/20 bg-card',
    )}>
      <div className="flex items-start gap-2.5">
        {/* Nummer-Kreis */}
        <div className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-black text-white',
          s.ring,
        )}>
          {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : stopp.reihenfolge}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {stopp.kunde_name && (
              <span className="text-xs font-bold text-foreground truncate">{stopp.kunde_name}</span>
            )}
            {isActive && (
              <span className="text-[8px] font-bold rounded-full bg-blue-600 text-white px-1.5 py-0.5 animate-pulse">
                Nächster Stopp
              </span>
            )}
            {stopp.eta_min !== null && !isDone && (
              <span className="ml-auto text-[10px] font-bold text-blue-600 dark:text-blue-400 tabular-nums shrink-0">
                ~{stopp.eta_min} Min
              </span>
            )}
          </div>

          <div className="flex items-start gap-1 mt-0.5">
            <MapPin className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
            <span className="text-[10px] text-muted-foreground leading-snug">{stopp.adresse}</span>
          </div>

          {stopp.notiz && (
            <div className="mt-1 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-2 py-1 text-[9px] text-amber-700 dark:text-amber-300">
              📝 {stopp.notiz}
            </div>
          )}

          {stopp.telefon && !isDone && (
            <a
              href={`tel:${stopp.telefon}`}
              className="mt-1.5 inline-flex items-center gap-1 rounded-lg bg-matcha-50 dark:bg-matcha-950/20 border border-matcha-200 dark:border-matcha-800 px-2 py-1 text-[9px] font-bold text-matcha-700 dark:text-matcha-300 hover:bg-matcha-100 transition-colors"
            >
              <Phone className="h-2.5 w-2.5" />
              Kunden anrufen
            </a>
          )}

          {isActive && <NavButtons stopp={stopp} />}
        </div>
      </div>
    </div>
  );
}

export function FahrerPhase2295TourStoppNavigationCockpit({ tourData }: { tourData?: TourData | null }) {
  const [data, setData] = useState<TourData | null>(tourData ?? null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/driver-app/me/orders');
      if (res.ok) {
        const json = await res.json();
        if (json?.tour) setData(json.tour);
        else setData(getMockTour());
      } else {
        setData(getMockTour());
      }
    } catch {
      setData(getMockTour());
    }
  }, []);

  useEffect(() => {
    if (!tourData) {
      load();
      const id = setInterval(load, 20_000);
      return () => clearInterval(id);
    }
  }, [load, tourData]);

  const activeData = data ?? getMockTour();
  const aktStopp = activeData.stopps.find(s => s.status === 'active');
  const fortschritt = activeData.total_stopps > 0
    ? Math.round((activeData.erledigte_stopps / activeData.total_stopps) * 100)
    : 0;

  return (
    <div className="rounded-xl border bg-card p-4 mb-3 space-y-3">
      <button className="flex w-full items-center justify-between gap-2" onClick={() => setOpen(v => !v)}>
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/20">
            <Navigation2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </span>
          <div className="text-left">
            <p className="text-sm font-bold leading-tight">Tour-Stopp Navigation</p>
            <p className="text-[10px] text-muted-foreground">Stopps · GPS-Navigation · ETA</p>
          </div>
          <span className="rounded-full bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 text-[9px] font-bold text-blue-700 dark:text-blue-300 ml-1">
            {activeData.erledigte_stopps}/{activeData.total_stopps}
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <>
          {/* Fortschrittsbalken */}
          <div>
            <div className="flex justify-between text-[9px] text-muted-foreground mb-1">
              <span>{activeData.erledigte_stopps} von {activeData.total_stopps} erledigt</span>
              {activeData.restzeit_min !== null && (
                <span className="flex items-center gap-0.5">
                  <Clock className="h-2.5 w-2.5" /> ~{activeData.restzeit_min} Min verbleibend
                </span>
              )}
            </div>
            <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-700"
                style={{ width: `${fortschritt}%` }}
              />
            </div>
          </div>

          {/* Nächster Stopp Fokus */}
          {aktStopp && (
            <div className="rounded-xl border-2 border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/20 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Zap className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300">Nächster Stopp</span>
                {aktStopp.eta_min !== null && (
                  <span className="ml-auto text-sm font-black tabular-nums text-blue-600 dark:text-blue-400">~{aktStopp.eta_min} Min</span>
                )}
              </div>
              <p className="text-xs font-bold text-foreground">{aktStopp.kunde_name ?? 'Kunde'}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{aktStopp.adresse}</p>
              {aktStopp.notiz && (
                <p className="mt-1 text-[9px] text-amber-700 dark:text-amber-300 font-medium">📝 {aktStopp.notiz}</p>
              )}
              <NavButtons stopp={aktStopp} />
            </div>
          )}

          {/* Alle Stopps */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Navigation className="h-3 w-3" /> Alle Tour-Stopps
            </p>
            {activeData.stopps.map((stopp, i) => (
              <StoppKarte key={stopp.id} stopp={stopp} isFirst={i === 0} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
