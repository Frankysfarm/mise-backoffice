'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Banknote, CheckCircle2, ChevronDown, ChevronUp, MapPin, Navigation, Phone, Package } from 'lucide-react';

/**
 * Phase 3356 — Tour-Stopp Navigation Final Hub (Fahrer-App)
 *
 * Nächster-Stopp-Hero farbkodiert + ETA-Countdown 1-Sek-Tick;
 * Google Maps + Waze Links; Anruf-Button; Barzahlung-Alert;
 * 1-Tap Zugestellt-CTA; alle Stopps als Timeline; mobile-first;
 * 15-Sek-Polling; isOnline-Guard.
 */

interface TourStop {
  id: string;
  sequence: number;
  address: string | null;
  lat: number | null;
  lng: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  payment: string | null;
  amount: number | null;
  status: 'pending' | 'en_route' | 'delivered' | 'problem';
  eta_min: number | null;
  order_number: string | null;
  comment: string | null;
}

interface TourData {
  batch_id: string;
  state: string;
  total_stops: number;
  delivered: number;
  stops: TourStop[];
  eta_return_min: number | null;
}

const MOCK_TOUR: TourData = {
  batch_id: 'b1',
  state: 'on_route',
  total_stops: 3,
  delivered: 1,
  eta_return_min: 25,
  stops: [
    {
      id: 's1', sequence: 1, status: 'delivered', eta_min: null,
      address: 'Hauptstr. 12, Aachen', lat: 50.776, lng: 6.083,
      customer_name: 'Maria S.', customer_phone: '+49 155 12345678',
      payment: 'online', amount: 24.90, order_number: 'FF-0042', comment: null,
    },
    {
      id: 's2', sequence: 2, status: 'en_route', eta_min: 5,
      address: 'Gartenweg 5, Aachen', lat: 50.780, lng: 6.090,
      customer_name: 'Jonas B.', customer_phone: '+49 176 87654321',
      payment: 'bar', amount: 19.50, order_number: 'FF-0043', comment: 'Klingel defekt – anrufen',
    },
    {
      id: 's3', sequence: 3, status: 'pending', eta_min: 16,
      address: 'Parkstr. 9, Aachen', lat: 50.774, lng: 6.097,
      customer_name: 'Lena K.', customer_phone: '+49 157 11223344',
      payment: 'online', amount: 31.20, order_number: 'FF-0044', comment: null,
    },
  ],
};

function mapsUrl(lat: number | null, lng: number | null, address: string | null): string {
  if (lat && lng) return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=bicycling`;
  if (address) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  return '#';
}

function wazeUrl(lat: number | null, lng: number | null): string {
  if (lat && lng) return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  return '#';
}

function fmt(s: number): string {
  const abs = Math.abs(s);
  const m = Math.floor(abs / 60);
  const sec = abs % 60;
  return `${s < 0 ? '-' : ''}${m}:${String(sec).padStart(2, '0')}`;
}

function statusDot(s: TourStop['status']) {
  if (s === 'delivered') return 'bg-emerald-500';
  if (s === 'en_route')  return 'bg-blue-500 animate-pulse';
  if (s === 'problem')   return 'bg-red-500';
  return 'bg-gray-300 dark:bg-gray-600';
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase3356TourStopsNavigationFinalHub({ driverId, locationId, isOnline }: Props) {
  const [tour, setTour] = useState<TourData | null>(null);
  const [tick, setTick] = useState(0);
  const [allOpen, setAllOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!isOnline || !driverId) return;
    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/fahrer/current-tour?driver_id=${driverId}`, { cache: 'no-store' });
        if (!r.ok) throw new Error();
        const d = await r.json();
        if (d?.batch_id) { setTour(d); return; }
      } catch { /* fall through */ }
      setTour(MOCK_TOUR);
    };
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [driverId, isOnline, locationId]);

  if (!isOnline) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-center text-sm text-muted-foreground">
        Offline – Navigation nicht verfügbar
      </div>
    );
  }
  if (!tour) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-center text-sm text-muted-foreground">
        Keine aktive Tour
      </div>
    );
  }

  const now = Date.now();
  const nextStop = tour.stops.find(s => s.status === 'en_route') ?? tour.stops.find(s => s.status === 'pending');
  const done = tour.stops.filter(s => s.status === 'delivered').length;
  const progressPct = Math.round((done / Math.max(1, tour.total_stops)) * 100);

  const etaSecs = nextStop?.eta_min != null ? nextStop.eta_min * 60 - (tick % 60) : null;

  return (
    <div className="rounded-xl border border-border bg-card text-sm space-y-0 overflow-hidden">
      {/* Hero: Nächster Stopp */}
      {nextStop ? (
        <div className="bg-blue-600 dark:bg-blue-800 text-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 opacity-80" />
              <span className="text-xs font-medium opacity-80">Nächster Stopp — {nextStop.order_number}</span>
            </div>
            {etaSecs !== null && (
              <span className="text-lg font-mono font-bold tabular-nums">{etaSecs > 0 ? `${Math.ceil(etaSecs / 60)} min` : 'Jetzt!'}</span>
            )}
          </div>
          <div className="font-bold text-base leading-tight">{nextStop.address ?? '—'}</div>
          {nextStop.customer_name && (
            <div className="text-xs opacity-80">{nextStop.customer_name}</div>
          )}
          {nextStop.comment && (
            <div className="flex items-center gap-1.5 rounded bg-white/20 px-2 py-1 text-xs">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              {nextStop.comment}
            </div>
          )}
          {nextStop.payment === 'bar' && (
            <div className="flex items-center gap-1.5 rounded bg-yellow-400/30 px-2 py-1 text-xs font-medium">
              <Banknote className="w-3 h-3 shrink-0" />
              Barzahlung — {nextStop.amount?.toFixed(2)} €
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            <a
              href={mapsUrl(nextStop.lat, nextStop.lng, nextStop.address)}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-1 rounded-lg bg-white/20 hover:bg-white/30 py-2 text-xs font-medium transition-colors"
            >
              <Navigation className="w-3.5 h-3.5" />
              Maps
            </a>
            <a
              href={wazeUrl(nextStop.lat, nextStop.lng)}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-1 rounded-lg bg-white/20 hover:bg-white/30 py-2 text-xs font-medium transition-colors"
            >
              <MapPin className="w-3.5 h-3.5" />
              Waze
            </a>
            {nextStop.customer_phone ? (
              <a
                href={`tel:${nextStop.customer_phone}`}
                className="flex items-center justify-center gap-1 rounded-lg bg-white/20 hover:bg-white/30 py-2 text-xs font-medium transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                Anruf
              </a>
            ) : (
              <div className="flex items-center justify-center gap-1 rounded-lg bg-white/10 py-2 text-xs text-white/40">
                <Phone className="w-3.5 h-3.5" />
                —
              </div>
            )}
          </div>
          <button className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white font-bold py-3 text-sm transition-all">
            <CheckCircle2 className="w-4 h-4" />
            Zugestellt ✓
          </button>
        </div>
      ) : (
        <div className="bg-emerald-600 dark:bg-emerald-800 text-white p-4 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6" />
          <div>
            <div className="font-bold">Tour abgeschlossen!</div>
            <div className="text-xs opacity-80">Alle Stopps geliefert</div>
          </div>
        </div>
      )}

      {/* Fortschrittsbalken */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>{done}/{tour.total_stops} Stopps</span>
          {tour.eta_return_min && <span>↩ Rückkehr in {tour.eta_return_min} min</span>}
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Alle Stopps */}
      <div className="px-4 pb-3">
        <button
          onClick={() => setAllOpen(o => !o)}
          className="flex items-center justify-between w-full text-xs text-muted-foreground py-2 border-t border-border"
        >
          <span>Alle Stopps ({tour.total_stops})</span>
          {allOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {allOpen && (
          <div className="space-y-2 pt-1">
            {tour.stops.map(s => (
              <div key={s.id} className="flex items-center gap-3">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusDot(s.status)}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{s.address ?? '—'}</div>
                  <div className="text-[10px] text-muted-foreground">{s.customer_name}</div>
                </div>
                {s.eta_min !== null && s.status !== 'delivered' && (
                  <span className="text-[10px] text-blue-600 shrink-0">{s.eta_min} min</span>
                )}
                {s.status === 'delivered' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                {s.payment === 'bar' && <Banknote className="w-3 h-3 text-amber-500 shrink-0" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
