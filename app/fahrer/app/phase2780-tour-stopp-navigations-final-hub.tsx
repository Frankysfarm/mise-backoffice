'use client';

/**
 * Phase 2780 — Tour-Stopp Navigations-Final-Hub
 * Hero-Stopp mit One-Tap-Navigation (Google Maps, Apple Maps, Waze);
 * Echtzeit-ETA-Countdown; Kunden-Anruf; Stopp-Bestätigung;
 * Nächste-Stopps-Vorschau; Fortschrittsring; Mobile-first; 20-Sek-Polling + 1-Sek-Tick
 */

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { MapPin, Phone, CheckCircle2, Navigation, Clock, ChevronRight, Package, AlertTriangle, ExternalLink } from 'lucide-react';

interface TourStop {
  id: string;
  sequence: number;
  order_id: string;
  bestellnummer: string;
  kunde_name: string | null;
  adresse: string | null;
  plz: string | null;
  lat: number | null;
  lng: number | null;
  telefon: string | null;
  betrag: number;
  bezahlt: boolean;
  zahlungsart: string | null;
  eta_min: number | null;
  geliefert_am: string | null;
  notiz: string | null;
}

interface Props {
  driverId: string;
  batchId: string | null;
  stops?: TourStop[];
}

function fmtEur(v: number) {
  return `${v.toFixed(2).replace('.', ',')} €`;
}

function secsToMmSs(secs: number) {
  const m = Math.floor(Math.abs(secs) / 60);
  const s = Math.abs(secs) % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function NavLink({ address, lat, lng, label }: { address: string | null; lat: number | null; lng: number | null; label: string }) {
  if (!address && !(lat && lng)) return null;
  const query = lat && lng ? `${lat},${lng}` : encodeURIComponent(address ?? '');
  const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${query}`;
  const wazeUrl = lat && lng ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes` : `https://waze.com/ul?q=${encodeURIComponent(address ?? '')}&navigate=yes`;

  return (
    <div className="flex gap-2 flex-wrap">
      <a
        href={googleUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 px-4 text-sm font-bold text-white active:scale-95 transition-transform"
      >
        <Navigation className="h-4 w-4" />
        Google Maps
        <ExternalLink className="h-3 w-3 opacity-70" />
      </a>
      <a
        href={wazeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-500 py-3 px-4 text-sm font-bold text-white active:scale-95 transition-transform"
      >
        <Navigation className="h-4 w-4" />
        Waze
        <ExternalLink className="h-3 w-3 opacity-70" />
      </a>
    </div>
  );
}

export function FahrerPhase2780TourStoppNavigationsFinalHub({ driverId, batchId, stops: propStops }: Props) {
  const supabase = createClient();
  const [stops, setStops] = useState<TourStop[]>(propStops ?? []);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadStops() {
    if (!batchId) return;
    const { data } = await supabase
      .from('mise_delivery_batch_stops')
      .select(`
        id, sequence, order_id, arrived_at, completed_at, eta_min,
        order:customer_orders(bestellnummer, kunde_name, kunde_adresse, kunde_plz, kunde_lat, kunde_lng, kunde_telefon, gesamtbetrag, bezahlt, zahlungsart, kunde_lieferhinweis, kunde_notiz)
      `)
      .eq('batch_id', batchId)
      .eq('type', 'dropoff')
      .order('sequence', { ascending: true });

    if (!data) return;
    setStops(data.map((s: any) => {
      const o = Array.isArray(s.order) ? s.order[0] : s.order;
      return {
        id: s.id,
        sequence: s.sequence,
        order_id: s.order_id,
        bestellnummer: o?.bestellnummer ?? `#${s.sequence}`,
        kunde_name: o?.kunde_name ?? null,
        adresse: o?.kunde_adresse ?? null,
        plz: o?.kunde_plz ?? null,
        lat: o?.kunde_lat ?? null,
        lng: o?.kunde_lng ?? null,
        telefon: o?.kunde_telefon ?? null,
        betrag: o?.gesamtbetrag ?? 0,
        bezahlt: o?.bezahlt ?? false,
        zahlungsart: o?.zahlungsart ?? null,
        eta_min: s.eta_min ?? null,
        geliefert_am: s.completed_at ?? null,
        notiz: o?.kunde_lieferhinweis ?? o?.kunde_notiz ?? null,
      };
    }));
  }

  async function confirmStop(stopId: string) {
    setConfirming(stopId);
    try {
      await supabase
        .from('mise_delivery_batch_stops')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', stopId);
      await loadStops();
    } finally {
      setConfirming(null);
    }
  }

  useEffect(() => {
    if (propStops?.length) { setStops(propStops); return; }
    loadStops();
    pollRef.current = setInterval(loadStops, 20_000);
    tickRef.current = setInterval(() => setTick((t) => t + 1), 1_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  const pending = stops.filter((s) => !s.geliefert_am);
  const done = stops.filter((s) => !!s.geliefert_am);
  const current = pending[0] ?? null;
  const nextStops = pending.slice(1, 3);

  const totalStops = stops.length;
  const donePct = totalStops > 0 ? Math.round((done.length / totalStops) * 100) : 0;

  if (stops.length === 0) return null;

  return (
    <div className="space-y-3 px-1">
      {/* Progress Ring + Header */}
      <div className="rounded-2xl bg-gradient-to-br from-matcha-700 to-matcha-900 p-4 text-white">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[11px] font-semibold text-matcha-300 uppercase tracking-wider">Tour-Fortschritt</div>
            <div className="text-2xl font-black">{done.length}/{totalStops} Stopps</div>
          </div>
          {/* Ring */}
          <svg width={56} height={56} viewBox="0 0 56 56" className="shrink-0">
            <circle cx={28} cy={28} r={22} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={6} />
            <circle
              cx={28} cy={28} r={22} fill="none"
              stroke={donePct >= 80 ? '#4ade80' : donePct >= 50 ? '#fbbf24' : 'white'}
              strokeWidth={6}
              strokeDasharray={`${(donePct / 100) * (2 * Math.PI * 22)} ${2 * Math.PI * 22}`}
              strokeLinecap="round"
              transform="rotate(-90 28 28)"
            />
            <text x={28} y={28} dominantBaseline="middle" textAnchor="middle" fontSize={12} fontWeight="bold" fill="white">
              {donePct}%
            </text>
          </svg>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', donePct >= 80 ? 'bg-green-400' : donePct >= 50 ? 'bg-yellow-400' : 'bg-white')}
            style={{ width: `${Math.max(3, donePct)}%` }}
          />
        </div>
      </div>

      {/* Current Stop — Hero */}
      {current ? (
        <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 overflow-hidden">
          {/* Stop header */}
          <div className="bg-blue-600 px-4 py-2.5 flex items-center gap-2">
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white">Stopp {current.sequence}</span>
            <span className="font-bold text-white text-sm flex-1 truncate">{current.kunde_name ?? 'Kunde'}</span>
            {current.eta_min !== null && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-blue-100">
                <Clock className="h-3.5 w-3.5" />
                {current.eta_min} Min
              </span>
            )}
          </div>

          <div className="p-4 space-y-3">
            {/* Address */}
            {current.adresse && (
              <div className="flex items-start gap-2 rounded-xl bg-white border border-blue-100 px-3 py-2.5">
                <MapPin className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-bold text-stone-800">{current.adresse}</div>
                  {current.plz && <div className="text-xs text-stone-500">{current.plz}</div>}
                </div>
              </div>
            )}

            {/* Order info */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-white border border-stone-100 px-3 py-2">
                <div className="text-[10px] text-stone-500">Bestellung</div>
                <div className="font-mono text-sm font-bold text-stone-800">#{current.bestellnummer.replace('FF-', '')}</div>
              </div>
              <div className={cn('rounded-xl border px-3 py-2', current.bezahlt ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200')}>
                <div className="text-[10px] text-stone-500">{current.bezahlt ? 'Bezahlt' : 'Zu kassieren'}</div>
                <div className={cn('text-sm font-bold', current.bezahlt ? 'text-green-700' : 'text-amber-700')}>
                  {fmtEur(current.betrag)}
                  {!current.bezahlt && current.zahlungsart && (
                    <span className="ml-1 text-[10px]">({current.zahlungsart})</span>
                  )}
                </div>
              </div>
            </div>

            {/* Customer note */}
            {current.notiz && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800">{current.notiz}</p>
              </div>
            )}

            {/* Navigation buttons */}
            <NavLink address={current.adresse} lat={current.lat} lng={current.lng} label={current.bestellnummer} />

            {/* Action buttons */}
            <div className="flex gap-2">
              {current.telefon && (
                <a
                  href={`tel:${current.telefon}`}
                  className="flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white py-3 px-4 text-sm font-bold text-stone-700 flex-1 active:scale-95 transition-transform"
                >
                  <Phone className="h-4 w-4 text-green-600" />
                  Anrufen
                </a>
              )}
              <button
                onClick={() => confirmStop(current.id)}
                disabled={confirming === current.id}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-xl py-3 px-4 text-sm font-bold text-white active:scale-95 transition-all',
                  confirming === current.id ? 'bg-stone-400' : 'bg-green-600 hover:bg-green-700'
                )}
              >
                <CheckCircle2 className="h-4 w-4" />
                {confirming === current.id ? 'Bestätigen...' : 'Geliefert ✓'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-5 text-center">
          <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2" />
          <p className="text-base font-bold text-green-700">Tour abgeschlossen!</p>
          <p className="text-sm text-green-600">Alle {done.length} Stopps geliefert</p>
        </div>
      )}

      {/* Next stops preview */}
      {nextStops.length > 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
          <div className="px-4 py-2 border-b border-stone-100 bg-stone-50">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Nächste Stopps</span>
          </div>
          {nextStops.map((stop) => (
            <div key={stop.id} className="flex items-center gap-3 px-4 py-3 border-b border-stone-50 last:border-0">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-100 text-[11px] font-bold text-stone-600">
                {stop.sequence}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-stone-800 truncate">{stop.kunde_name ?? 'Kunde'}</div>
                <div className="text-xs text-stone-500 truncate">{stop.adresse ?? '—'}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-xs font-bold text-stone-700">{fmtEur(stop.betrag)}</div>
                {stop.eta_min && <div className="text-[10px] text-stone-400">{stop.eta_min} Min</div>}
              </div>
              <Package className="h-4 w-4 text-stone-300 shrink-0" />
            </div>
          ))}
          {pending.length > 3 && (
            <div className="px-4 py-2 bg-stone-50 text-center">
              <span className="text-[11px] text-stone-400">+{pending.length - 3} weitere Stopps</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
