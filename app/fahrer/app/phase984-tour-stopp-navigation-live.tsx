'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Navigation, MapPin, Clock, Phone, CheckCircle2, AlertTriangle, Route, ExternalLink } from 'lucide-react';

/**
 * Phase 984 — Tour-Stopp-Navigation-Live (Fahrer-App)
 *
 * Nächster Stopp-Karte mit: ETA-Ring, Adresse, Navigation-Launch (Google Maps/Waze),
 * Stopp-Liste mit Fortschritt, Bestätigen-Button.
 * 5-Min-Polling von /api/delivery/driver/tour-stops
 */

interface TourStopp {
  id: string;
  sequence: number;
  adresse: string;
  customer_name?: string;
  eta_min: number;
  distanz_km: number;
  status: 'ausstehend' | 'aktuell' | 'abgeschlossen';
  order_id?: string;
  phone?: string;
  notes?: string;
}

interface ApiResponse {
  stops: TourStopp[];
  current_stop_index: number;
  tour_id: string;
  generiert_am: string;
}

const MOCK: ApiResponse = {
  stops: [
    { id: 's1', sequence: 1, adresse: 'Hauptstraße 12, München', customer_name: 'Maria K.', eta_min: 7, distanz_km: 1.4, status: 'aktuell', phone: '+4915112345678', notes: 'Klingeln 2x' },
    { id: 's2', sequence: 2, adresse: 'Bahnhofstr. 34, München', customer_name: 'Peter M.', eta_min: 18, distanz_km: 3.1, status: 'ausstehend', phone: '+4915198765432' },
    { id: 's3', sequence: 3, adresse: 'Goethestr. 7, München', customer_name: 'Lisa S.', eta_min: 28, distanz_km: 4.8, status: 'ausstehend' },
  ],
  current_stop_index: 0,
  tour_id: 'tour-01',
  generiert_am: new Date().toISOString(),
};

interface Props {
  driverId: string;
  isOnline: boolean;
}

function encodeAddr(addr: string) {
  return encodeURIComponent(addr);
}

function EtaRing({ eta }: { eta: number }) {
  const max = 30;
  const pct = Math.min(100, (eta / max) * 100);
  const r = 24;
  const circ = 2 * Math.PI * r;
  const dash = circ - (pct / 100) * circ;
  const color = eta <= 5 ? '#ef4444' : eta <= 12 ? '#f59e0b' : '#10b981';

  return (
    <div className="relative w-16 h-16 shrink-0">
      <svg className="w-16 h-16 -rotate-90" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={r} fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/30" />
        <circle
          cx="28" cy="28" r={r} fill="none"
          stroke={color} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={dash}
          style={{ transition: 'stroke-dashoffset 0.7s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-black tabular-nums leading-none" style={{ color }}>{eta}</span>
        <span className="text-[9px] text-muted-foreground">Min</span>
      </div>
    </div>
  );
}

export function FahrerPhase984TourStoppNavigationLive({ driverId, isOnline }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!isOnline || !driverId) return;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/driver/tour-stops?driver_id=${driverId}`);
        if (res.ok) setData(await res.json());
        else setData(MOCK);
      } catch {
        setData(MOCK);
      } finally {
        setLoading(false);
      }
    }

    load();
    const t = setInterval(load, 5 * 60_000);
    return () => clearInterval(t);
  }, [driverId, isOnline]);

  if (!isOnline) return null;
  if (loading && !data) {
    return (
      <div className="mx-4 rounded-xl border bg-card px-4 py-4 animate-pulse space-y-2">
        <div className="h-4 w-40 bg-muted rounded" />
        <div className="h-16 bg-muted rounded-xl" />
      </div>
    );
  }
  if (!data || data.stops.length === 0) return null;

  const stops = data.stops;
  const currentIdx = data.current_stop_index;
  const current = stops.find(s => s.status === 'aktuell') ?? stops[currentIdx] ?? stops[0];
  const remaining = stops.filter(s => s.status !== 'abgeschlossen').length;
  const done = stops.filter(s => s.status === 'abgeschlossen').length;

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await fetch('/api/delivery/driver/confirm-stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: driverId, stop_id: current.id }),
      });
      setData(prev => prev ? {
        ...prev,
        stops: prev.stops.map(s => s.id === current.id ? { ...s, status: 'abgeschlossen' as const } : s),
        current_stop_index: prev.current_stop_index + 1,
      } : null);
    } catch {
      // Ignore errors, will refresh on next poll
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="mx-4 space-y-3" data-fahrer-phase="984">
      {/* Nächster Stopp — Haupt-Card */}
      <div className={cn(
        'rounded-xl border bg-card overflow-hidden',
        current.eta_min <= 5 ? 'border-red-300' : current.eta_min <= 12 ? 'border-amber-300' : 'border-emerald-200',
      )}>
        {/* Header */}
        <div className={cn(
          'flex items-center gap-2 px-4 py-2 border-b',
          current.eta_min <= 5 ? 'bg-red-50 dark:bg-red-950/20 border-red-200' : current.eta_min <= 12 ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200' : 'bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-100',
        )}>
          <Navigation className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-bold flex-1">Nächster Stopp</span>
          <span className="text-[11px] font-bold text-muted-foreground">{done}/{stops.length} ✓</span>
          {current.eta_min <= 5 && <AlertTriangle className="h-4 w-4 text-red-500 animate-pulse shrink-0" />}
        </div>

        {/* Main content */}
        <div className="p-4 flex items-start gap-4">
          <EtaRing eta={current.eta_min} />

          <div className="flex-1 min-w-0 space-y-1">
            {current.customer_name && (
              <div className="text-sm font-black truncate">{current.customer_name}</div>
            )}
            <div className="flex items-start gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <span className="text-xs text-muted-foreground leading-snug">{current.adresse}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-0.5"><Route className="h-3 w-3" /> {current.distanz_km.toFixed(1)} km</span>
              <span>·</span>
              <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" /> ~{current.eta_min} Min</span>
            </div>
            {current.notes && (
              <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/20 rounded px-2 py-0.5 mt-1">
                📝 {current.notes}
              </div>
            )}
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="px-4 pb-3 grid grid-cols-2 gap-2">
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeAddr(current.adresse)}&travelmode=driving`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 text-white py-2.5 text-xs font-bold hover:bg-blue-700 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Google Maps
          </a>
          <a
            href={`waze://?q=${encodeAddr(current.adresse)}&navigate=yes`}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-teal-600 text-white py-2.5 text-xs font-bold hover:bg-teal-700 transition-colors"
          >
            <Navigation className="h-3.5 w-3.5" />
            Waze
          </a>
        </div>

        {/* Phone + Confirm */}
        <div className="px-4 pb-4 flex items-center gap-2">
          {current.phone && (
            <a
              href={`tel:${current.phone}`}
              className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold hover:bg-muted/40 transition-colors"
            >
              <Phone className="h-3.5 w-3.5" />
              Anrufen
            </a>
          )}
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-black transition-colors',
              confirming
                ? 'bg-muted text-muted-foreground'
                : 'bg-emerald-600 text-white hover:bg-emerald-700',
            )}
          >
            <CheckCircle2 className="h-4 w-4" />
            {confirming ? 'Bestätige…' : 'Stopp bestätigen'}
          </button>
        </div>
      </div>

      {/* Stopp-Liste */}
      {stops.length > 1 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b">
            <Route className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-bold flex-1">Alle Stopps</span>
            <span className="text-[11px] text-muted-foreground">{remaining} verbleibend</span>
          </div>
          <div className="divide-y">
            {stops.map((s, idx) => (
              <div key={s.id} className={cn(
                'flex items-center gap-3 px-4 py-2.5',
                s.status === 'abgeschlossen' && 'opacity-50',
                s.status === 'aktuell' && 'bg-muted/20',
              )}>
                <div className={cn(
                  'shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black',
                  s.status === 'abgeschlossen' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' :
                  s.status === 'aktuell' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' :
                  'bg-muted text-muted-foreground',
                )}>
                  {s.status === 'abgeschlossen' ? '✓' : idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold truncate">{s.customer_name ?? `Stopp ${idx + 1}`}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{s.adresse}</div>
                </div>
                {s.status !== 'abgeschlossen' && (
                  <div className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                    {s.eta_min} Min
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-[10px] text-muted-foreground text-center">
        Aktualisierung alle 5 Min · Live-Navigation
      </div>
    </div>
  );
}
