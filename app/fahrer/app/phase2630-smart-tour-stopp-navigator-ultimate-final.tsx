'use client';

/**
 * Phase 2630 — Smart Tour-Stopp Navigator Ultimate Final (Fahrer-App)
 *
 * Vollständiger Tour-Navigator für den Fahrer:
 * – Nächster Stopp mit Adresse, ETA und Countdown
 * – Stop-Sequenz-Übersicht mit farbkodierten Status-Dots
 * – Direkte Navigation via Google/Waze/Apple Maps
 * – Verdienst- und Trinkgeld-Vorschau je Tour
 * – Schnell-Bestätigung für Zustellung
 * – Live-Fortschrittsring
 * – Realtime via Supabase
 */

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  Bike, CheckCircle2, ChevronRight, Clock, Euro,
  MapPin, Navigation, Package, Phone, Star, Timer, Zap,
} from 'lucide-react';

/* ── Types ──────────────────────────────────────────────────────── */

interface TourStop {
  id: string;
  reihenfolge: number;
  adresse: string | null;
  kunde_name: string | null;
  kunde_telefon: string | null;
  eta_min: number | null;
  geliefert_am: string | null;
  angekommen_am: string | null;
  trinkgeld?: number | null;
  betrag?: number | null;
  lat?: number | null;
  lng?: number | null;
}

interface Tour {
  id: string;
  status: string;
  started_at: string | null;
  total_eta_min: number | null;
  stops: TourStop[];
  gesamt_verdienst?: number | null;
  zone?: string | null;
}

interface Props {
  fahrerEmployeeId?: string | null;
  tour?: Tour | null;
}

/* ── Mock ───────────────────────────────────────────────────────── */

const MOCK_TOUR: Tour = {
  id: 'tour-1',
  status: 'aktiv',
  started_at: new Date(Date.now() - 18 * 60000).toISOString(),
  total_eta_min: 45,
  zone: 'Nord',
  gesamt_verdienst: 12.5,
  stops: [
    { id: 's1', reihenfolge: 1, adresse: 'Hauptstraße 12, München',    kunde_name: 'Marie S.',  kunde_telefon: '+49 171 1234567', eta_min: null, geliefert_am: new Date(Date.now() - 10 * 60000).toISOString(), angekommen_am: new Date(Date.now() - 12 * 60000).toISOString(), trinkgeld: 2.0,  betrag: 28.5, lat: 48.137, lng: 11.575 },
    { id: 's2', reihenfolge: 2, adresse: 'Bahnhofstraße 8, München',   kunde_name: 'Thomas K.', kunde_telefon: '+49 172 9876543', eta_min: 4,    geliefert_am: null, angekommen_am: new Date(Date.now() - 2 * 60000).toISOString(),  trinkgeld: null, betrag: 22.0, lat: 48.140, lng: 11.560 },
    { id: 's3', reihenfolge: 3, adresse: 'Lindenweg 5, München',       kunde_name: 'Leila B.',  kunde_telefon: null,             eta_min: 14,   geliefert_am: null, angekommen_am: null, trinkgeld: null, betrag: 35.0, lat: 48.145, lng: 11.550 },
    { id: 's4', reihenfolge: 4, adresse: 'Rosenweg 21, München',       kunde_name: 'Jan M.',    kunde_telefon: '+49 170 5551234', eta_min: 24,   geliefert_am: null, angekommen_am: null, trinkgeld: null, betrag: 18.5, lat: 48.150, lng: 11.540 },
  ],
};

/* ── Progress Ring ─────────────────────────────────────────────── */

function ProgressRing({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? done / total : 0;
  const r = 28;
  const circ = 2 * Math.PI * r;

  return (
    <div className="relative flex items-center justify-center">
      <svg width="68" height="68" viewBox="0 0 68 68">
        <circle cx="34" cy="34" r={r} fill="none" stroke="#e7e5e4" strokeWidth="5" />
        <circle
          cx="34" cy="34" r={r}
          fill="none" stroke={pct >= 1 ? '#4ade80' : '#f59e0b'} strokeWidth="5"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
          transform="rotate(-90 34 34)"
        />
        <text x="34" y="36" textAnchor="middle" fontSize="13" fontWeight="800" fill="#292524">
          {done}/{total}
        </text>
        <text x="34" y="46" textAnchor="middle" fontSize="9" fill="#a8a29e">
          Stopps
        </text>
      </svg>
    </div>
  );
}

/* ── Nav buttons ───────────────────────────────────────────────── */

function NavButtons({ adresse, lat, lng }: { adresse: string; lat?: number | null; lng?: number | null }) {
  const encoded = encodeURIComponent(adresse);
  const coord = lat && lng ? `${lat},${lng}` : encoded;

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {[
        { label: 'Google', href: `https://maps.google.com?q=${encoded}`, color: 'bg-blue-50 text-blue-700 border-blue-200' },
        { label: 'Waze',   href: `https://waze.com/ul?q=${encoded}`,     color: 'bg-purple-50 text-purple-700 border-purple-200' },
        { label: 'Apple',  href: `http://maps.apple.com/?q=${encoded}`,  color: 'bg-stone-50 text-stone-700 border-stone-200' },
      ].map(({ label, href, color }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={cn('flex items-center justify-center gap-1 text-[11px] font-bold rounded-xl border py-2 transition-all active:scale-95', color)}
        >
          <Navigation className="w-3 h-3" />
          {label}
        </a>
      ))}
    </div>
  );
}

/* ── Stop Dot Row ──────────────────────────────────────────────── */

function StopDotRow({ stops }: { stops: TourStop[] }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {stops.map(s => {
        const done   = !!s.geliefert_am;
        const active = !!s.angekommen_am && !s.geliefert_am;
        return (
          <div
            key={s.id}
            title={s.adresse ?? undefined}
            className={cn(
              'w-7 h-7 rounded-full text-[10px] font-black flex items-center justify-center border-2 transition-all',
              done   ? 'bg-matcha-400 border-matcha-500 text-white' :
              active ? 'bg-amber-400 border-amber-500 text-white ring-2 ring-amber-200 animate-pulse' :
                       'bg-stone-100 border-stone-200 text-stone-500'
            )}
          >
            {s.reihenfolge}
          </div>
        );
      })}
    </div>
  );
}

/* ── Main Component ────────────────────────────────────────────── */

export function Phase2630SmartTourStoppNavigatorUltimateFinal({ fahrerEmployeeId, tour: propTour }: Props) {
  const [tour, setTour]     = useState<Tour | null>(propTour ?? MOCK_TOUR);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (propTour) { setTour(propTour); return; }
    if (!fahrerEmployeeId) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('delivery_batches')
        .select('id, status, started_at, total_eta_min, zone, gesamt_verdienst, delivery_stops(id, reihenfolge, adresse, kunde_name, kunde_telefon, eta_min, geliefert_am, angekommen_am, trinkgeld, betrag, lat, lng)')
        .eq('fahrer_id', fahrerEmployeeId)
        .eq('status', 'aktiv')
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setTour({ ...data, stops: (data.delivery_stops as TourStop[]).sort((a, b) => a.reihenfolge - b.reihenfolge) });
      }
    } catch {}
    setLoading(false);
  }, [fahrerEmployeeId, propTour]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [load]);

  const confirmDelivery = async (stopId: string) => {
    setConfirming(stopId);
    try {
      const supabase = createClient();
      await supabase
        .from('delivery_stops')
        .update({ geliefert_am: new Date().toISOString() })
        .eq('id', stopId);
      await load();
    } catch {}
    setConfirming(null);
  };

  if (!tour) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-stone-400">
        <Bike className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <div className="text-sm font-semibold">Keine aktive Tour</div>
        <div className="text-xs mt-1">Warte auf Zuweisung vom Dispatch</div>
      </div>
    );
  }

  const doneStops   = tour.stops.filter(s => !!s.geliefert_am);
  const activeStop  = tour.stops.find(s => !!s.angekommen_am && !s.geliefert_am);
  const nextStop    = activeStop ?? tour.stops.find(s => !s.geliefert_am);
  const remaining   = tour.stops.filter(s => !s.geliefert_am);
  const elapsedMin  = tour.started_at
    ? Math.round((Date.now() - new Date(tour.started_at).getTime()) / 60000)
    : null;

  const estimatedEarnings = tour.stops
    .filter(s => !!s.geliefert_am && s.trinkgeld)
    .reduce((sum, s) => sum + (s.trinkgeld ?? 0), 0)
    + (tour.gesamt_verdienst ?? 0);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 bg-stone-50">
        <div className="flex items-center gap-2">
          <Bike className="w-4 h-4 text-saffron-600" />
          <span className="font-bold text-sm text-stone-900">Tour-Navigator</span>
          {loading && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="bg-matcha-100 text-matcha-700 font-bold px-2 py-0.5 rounded-full">{tour.zone ?? 'Zone'}</span>
          {elapsedMin != null && (
            <span className="text-stone-400 flex items-center gap-0.5">
              <Timer className="w-3 h-3" />{elapsedMin} min
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Progress + tour overview */}
        <div className="flex items-center gap-4">
          <ProgressRing done={doneStops.length} total={tour.stops.length} />
          <div className="flex-1 space-y-1.5">
            <StopDotRow stops={tour.stops} />
            <div className="flex gap-3 text-[11px] text-stone-500">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-matcha-500" />
                {doneStops.length} geliefert
              </span>
              <span className="flex items-center gap-1">
                <Package className="w-3 h-3 text-amber-500" />
                {remaining.length} übrig
              </span>
              {estimatedEarnings > 0 && (
                <span className="flex items-center gap-1">
                  <Euro className="w-3 h-3 text-matcha-500" />
                  {estimatedEarnings.toFixed(2)}€
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Next stop card */}
        {nextStop ? (
          <div className={cn(
            'rounded-xl border p-3 space-y-3',
            activeStop ? 'bg-amber-50 border-amber-200' : 'bg-matcha-50 border-matcha-200'
          )}>
            {/* Stop header */}
            <div className="flex items-start gap-2">
              <div className={cn(
                'w-7 h-7 rounded-full text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5',
                activeStop ? 'bg-amber-400 text-white' : 'bg-matcha-400 text-white'
              )}>
                {nextStop.reihenfolge}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-stone-900 flex items-center gap-1.5">
                  {nextStop.kunde_name ?? 'Kunde'}
                  {activeStop && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">Jetzt da</span>}
                </div>
                <div className="flex items-start gap-1 mt-0.5 text-[11px] text-stone-600">
                  <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                  <span className="leading-tight">{nextStop.adresse ?? 'Adresse unbekannt'}</span>
                </div>
              </div>
              {nextStop.eta_min != null && (
                <div className="text-right shrink-0">
                  <div className="font-black text-base text-stone-900 tabular-nums">{nextStop.eta_min} min</div>
                  <div className="text-[9px] text-stone-400">ETA</div>
                </div>
              )}
            </div>

            {/* Amount + tip preview */}
            {nextStop.betrag != null && (
              <div className="flex items-center gap-2 text-[11px]">
                <span className="flex items-center gap-1 font-semibold text-stone-600">
                  <Euro className="w-3 h-3" /> {nextStop.betrag.toFixed(2)}€
                </span>
                <span className="text-stone-300">·</span>
                <span className="text-stone-400">Trinkgeld: {nextStop.trinkgeld ? `${nextStop.trinkgeld.toFixed(2)}€` : '—'}</span>
              </div>
            )}

            {/* Navigation */}
            {nextStop.adresse && (
              <NavButtons adresse={nextStop.adresse} lat={nextStop.lat} lng={nextStop.lng} />
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {/* Call button */}
              {nextStop.kunde_telefon && (
                <a
                  href={`tel:${nextStop.kunde_telefon}`}
                  className="flex items-center gap-1.5 text-[11px] font-bold bg-stone-100 text-stone-600 px-3 py-2 rounded-xl flex-1 justify-center border border-stone-200 active:scale-95 transition-all"
                >
                  <Phone className="w-3.5 h-3.5" />
                  Anrufen
                </a>
              )}

              {/* Confirm delivery */}
              {activeStop && activeStop.id === nextStop.id && (
                <button
                  onClick={() => confirmDelivery(nextStop.id)}
                  disabled={!!confirming}
                  className={cn(
                    'flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-xl flex-1 justify-center border transition-all active:scale-95',
                    confirming === nextStop.id
                      ? 'bg-stone-100 text-stone-400 border-stone-200'
                      : 'bg-matcha-500 text-white border-matcha-600 shadow-sm'
                  )}
                >
                  {confirming === nextStop.id ? (
                    <><Timer className="w-3.5 h-3.5 animate-spin" /> Speichern...</>
                  ) : (
                    <><CheckCircle2 className="w-3.5 h-3.5" /> Zugestellt</>
                  )}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-matcha-50 border border-matcha-200 p-4 text-center">
            <CheckCircle2 className="w-8 h-8 text-matcha-500 mx-auto mb-2" />
            <div className="font-bold text-sm text-matcha-700">Alle Stopps erledigt! 🎉</div>
            <div className="text-[11px] text-matcha-500 mt-1">Gute Arbeit — zurück zum Depot</div>
          </div>
        )}

        {/* Remaining stops list */}
        {remaining.length > 1 && (
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Weitere Stopps</div>
            {remaining.slice(nextStop ? 1 : 0).map(s => (
              <div key={s.id} className="flex items-center gap-2 text-[11px] text-stone-500">
                <div className="w-5 h-5 rounded-full bg-stone-100 text-[9px] font-bold flex items-center justify-center shrink-0">
                  {s.reihenfolge}
                </div>
                <span className="flex-1 truncate">{s.adresse ?? 'Adresse'}</span>
                {s.eta_min != null && (
                  <span className="shrink-0 flex items-center gap-0.5">
                    <Clock className="w-3 h-3" />{s.eta_min}m
                  </span>
                )}
                <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-40" />
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 border-t border-stone-100 text-[10px] text-stone-400">
          <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Echtzeit · 30s-Polling</span>
          {tour.total_eta_min != null && (
            <span>Tour-Gesamt: {tour.total_eta_min} min</span>
          )}
        </div>
      </div>
    </div>
  );
}
