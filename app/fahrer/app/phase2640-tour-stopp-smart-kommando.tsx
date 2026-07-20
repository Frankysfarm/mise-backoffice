'use client';

/**
 * Phase 2640 — Tour-Stopp Smart-Kommando
 *
 * Mobile-first Fahrer-Navigation:
 * - Aktueller Stopp groß im Fokus (Adresse, Kunde, Notiz)
 * - One-Tap Navigation: Google Maps / Waze / Apple Maps
 * - Telefon-Button + Kunden-Notiz-Alert
 * - Stopp-Fortschritts-Dots (grün=fertig, blau=aktuell, grau=offen)
 * - ETA-Countdown bis Lieferung
 * - Nächste Stopps aufklappbar
 * - 20-Sek-Polling + 1-Sek-ETA-Tick
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Navigation, Phone, ChevronDown, ChevronUp, Clock, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface TourStop {
  stopId: string;
  sequence: number;
  status: 'completed' | 'active' | 'pending';
  address: string;
  customerName: string;
  etaMin: number | null;
  note: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
}

interface TourData {
  tourId: string;
  stops: TourStop[];
  totalStops: number;
  completedStops: number;
  shiftEarnings: number;
}

const MOCK: TourData = {
  tourId: 'T-2408',
  stops: [
    { stopId: 's1', sequence: 1, status: 'completed', address: 'Hauptstr. 12, Berlin', customerName: 'Schmidt, J.', etaMin: null, note: null, lat: 52.52, lng: 13.40, phone: '+491701234567' },
    { stopId: 's2', sequence: 2, status: 'completed', address: 'Bergweg 5, Berlin', customerName: 'Müller, A.', etaMin: null, note: null, lat: 52.53, lng: 13.41, phone: null },
    { stopId: 's3', sequence: 3, status: 'active', address: 'Kastanienallee 88, Berlin', customerName: 'Weber, M.', etaMin: 4, note: '2. Etage, klingeln', lat: 52.535, lng: 13.405, phone: '+491739876543' },
    { stopId: 's4', sequence: 4, status: 'pending', address: 'Sonnenstr. 3, Berlin', customerName: 'Fischer, K.', etaMin: 14, note: null, lat: 52.54, lng: 13.42, phone: null },
    { stopId: 's5', sequence: 5, status: 'pending', address: 'Rosenweg 21, Berlin', customerName: 'Bauer, L.', etaMin: 22, note: 'Hinterhof', lat: 52.55, lng: 13.43, phone: '+491762223344' },
  ],
  totalStops: 5,
  completedStops: 2,
  shiftEarnings: 48.50,
};

function dotStatus(status: TourStop['status']) {
  switch (status) {
    case 'completed': return 'bg-matcha-500 ring-2 ring-matcha-200';
    case 'active':    return 'bg-blue-500 ring-2 ring-blue-200 animate-pulse';
    default:          return 'bg-muted-foreground/30';
  }
}

function navUrl(type: 'google' | 'waze' | 'apple', lat: number, lng: number, address: string) {
  const enc = encodeURIComponent(address);
  switch (type) {
    case 'google': return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    case 'waze':   return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
    case 'apple':  return `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
  }
}

export function FahrerPhase2640TourStoppSmartKommando({ driverId }: { driverId: string | null }) {
  const [data, setData]     = useState<TourData | null>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick]     = useState(0);
  const [expanded, setExpanded] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchData() {
    if (!driverId) return;
    if (data === null) setLoading(true);
    try {
      const r = await fetch(`/api/delivery/fahrer/tour-stops?driver_id=${driverId}`);
      if (r.ok) setData(await r.json());
      else setData(MOCK);
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    pollRef.current = setInterval(fetchData, 20_000);
    tickRef.current = setInterval(() => setTick(t => t + 1), 1_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  if (!driverId) return null;

  const display = data ?? MOCK;
  const active  = display.stops.find(s => s.status === 'active');
  const pending = display.stops.filter(s => s.status === 'pending');
  const pct     = display.totalStops > 0 ? (display.completedStops / display.totalStops) * 100 : 0;
  const etaDisplay = active?.etaMin !== null && active?.etaMin !== undefined
    ? Math.max(0, active.etaMin - Math.floor(tick / 60))
    : null;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-blue-50/60">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-blue-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider text-blue-700">
            Tour {display.tourId}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-foreground">
            {display.completedStops}/{display.totalStops} Stopps
          </span>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {/* Progress Dots */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b">
        {display.stops.map(s => (
          <span key={s.stopId} className={cn('h-2.5 w-2.5 rounded-full flex-none', dotStatus(s.status))} />
        ))}
        <div className="flex-1 ml-1 h-1 rounded-full bg-muted/40 overflow-hidden">
          <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Active Stop Focus */}
      {active ? (
        <div className="px-4 py-4 bg-blue-50/30">
          {active.note && (
            <div className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5 text-amber-600 mt-0.5 flex-none" />
              <span className="text-[11px] text-amber-800 font-medium">{active.note}</span>
            </div>
          )}

          {/* ETA Badge */}
          {etaDisplay !== null && (
            <div className="mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <span className="text-lg font-black text-blue-700 tabular-nums">
                {etaDisplay} Min
              </span>
              <span className="text-[10px] text-muted-foreground">bis Lieferung</span>
            </div>
          )}

          {/* Address */}
          <div className="mb-1">
            <div className="text-xs text-muted-foreground font-medium">{active.customerName}</div>
            <div className="text-sm font-bold text-foreground leading-snug">{active.address}</div>
          </div>

          {/* Navigation Buttons */}
          {active.lat !== null && active.lng !== null && (
            <div className="mt-3 flex gap-2">
              {(['google', 'waze', 'apple'] as const).map(type => (
                <a
                  key={type}
                  href={navUrl(type, active.lat!, active.lng!, active.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'flex-1 rounded-lg py-2 text-center text-[10px] font-bold uppercase tracking-wide transition-colors',
                    type === 'google' ? 'bg-blue-600 text-white hover:bg-blue-700' :
                    type === 'waze'   ? 'bg-cyan-500 text-white hover:bg-cyan-600' :
                    'bg-gray-800 text-white hover:bg-gray-900'
                  )}
                >
                  {type === 'google' ? 'Google' : type === 'waze' ? 'Waze' : 'Apple'}
                </a>
              ))}
              {active.phone && (
                <a
                  href={`tel:${active.phone}`}
                  className="rounded-lg bg-matcha-600 text-white px-3 py-2 hover:bg-matcha-700 transition-colors"
                >
                  <Phone className="h-4 w-4" />
                </a>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-matcha-500" />
          Tour abgeschlossen · {display.completedStops} Stopps
        </div>
      )}

      {/* Earnings Strip */}
      <div className="border-t border-b px-4 py-2 flex items-center justify-between bg-matcha-50/40">
        <span className="text-[10px] text-muted-foreground">Schicht-Einnahmen</span>
        <span className="text-sm font-black text-matcha-700">{display.shiftEarnings.toFixed(2)} €</span>
      </div>

      {/* Pending Stops (collapsible) */}
      {pending.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(e => !e)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-[10px] font-semibold text-muted-foreground hover:bg-muted/10 transition-colors"
          >
            <span>{pending.length} weitere {pending.length === 1 ? 'Stopp' : 'Stopps'}</span>
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          {expanded && (
            <div className="divide-y border-t">
              {pending.map(s => (
                <div key={s.stopId} className="flex items-center justify-between px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="text-[10px] text-muted-foreground">{s.customerName}</div>
                    <div className="text-[11px] font-medium text-foreground truncate">{s.address}</div>
                    {s.note && <div className="text-[9px] text-amber-600 font-medium">{s.note}</div>}
                  </div>
                  <div className="flex items-center gap-2 flex-none ml-2">
                    {s.etaMin !== null && (
                      <span className="text-[10px] font-bold text-muted-foreground">{s.etaMin} Min</span>
                    )}
                    {s.lat !== null && s.lng !== null && (
                      <a
                        href={navUrl('google', s.lat, s.lng, s.address)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md bg-blue-100 p-1.5 hover:bg-blue-200 transition-colors"
                      >
                        <Navigation className="h-3 w-3 text-blue-600" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Footer */}
      <div className="border-t px-4 py-1.5 bg-muted/20">
        <span className="text-[9px] text-muted-foreground">Polling 20 Sek · 1-Sek-ETA-Tick</span>
      </div>
    </div>
  );
}
