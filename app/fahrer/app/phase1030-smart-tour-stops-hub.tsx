'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import {
  Bike, CheckCircle2, ChevronRight, Clock, ExternalLink, MapPin, Navigation,
  Phone, Package, Route, Star, Zap,
} from 'lucide-react';

/* ── Types ──────────────────────────────────────────────────────────────────── */

type Stop = {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    id: string;
    bestellnummer: string;
    kunde_name: string | null;
    kunde_adresse: string | null;
    kunde_telefon: string | null;
    eta_earliest: string | null;
    gesamtbetrag: number | null;
  } | null;
};

type ActiveBatch = {
  id: string;
  status: string;
  started_at: string | null;
  total_eta_min: number | null;
  total_distance_km: number | null;
  stops: Stop[];
};

/* ── Helpers ─────────────────────────────────────────────────────────────────── */

function mapsUrl(address: string): string {
  return `https://maps.google.com/?q=${encodeURIComponent(address)}`;
}

function fmtEur(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function minutesUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
}

/* ── Mock ────────────────────────────────────────────────────────────────────── */

const MOCK_BATCH: ActiveBatch = {
  id: 'mock-batch-1',
  status: 'unterwegs',
  started_at: new Date(Date.now() - 12 * 60_000).toISOString(),
  total_eta_min: 30,
  total_distance_km: 5.4,
  stops: [
    {
      id: 's1', reihenfolge: 1, geliefert_am: new Date(Date.now() - 5 * 60_000).toISOString(),
      order: { id: 'o1', bestellnummer: 'B-0101', kunde_name: 'Stefanie Walter', kunde_adresse: 'Musterstraße 12, Köln', kunde_telefon: '+4915112345678', eta_earliest: new Date(Date.now() - 3 * 60_000).toISOString(), gesamtbetrag: 2350 },
    },
    {
      id: 's2', reihenfolge: 2, geliefert_am: null,
      order: { id: 'o2', bestellnummer: 'B-0102', kunde_name: 'Jonas Keller', kunde_adresse: 'Hauptstraße 55, Köln', kunde_telefon: '+4915287654321', eta_earliest: new Date(Date.now() + 7 * 60_000).toISOString(), gesamtbetrag: 1890 },
    },
    {
      id: 's3', reihenfolge: 3, geliefert_am: null,
      order: { id: 'o3', bestellnummer: 'B-0103', kunde_name: 'Lena Brandt', kunde_adresse: 'Ringstraße 8, Köln', kunde_telefon: null, eta_earliest: new Date(Date.now() + 18 * 60_000).toISOString(), gesamtbetrag: 3120 },
    },
  ],
};

/* ── Component ─────────────────────────────────────────────────────────────── */

interface Props {
  driverId?: string | null;
}

export function FahrerPhase1030SmartTourStopsHub({ driverId }: Props) {
  const supabase = createClient();
  const [batch, setBatch] = useState<ActiveBatch | null>(null);
  const [useMock, setUseMock] = useState(false);
  const [confirmingStop, setConfirmingStop] = useState<string | null>(null);

  const fetchBatch = async () => {
    if (!driverId) { setUseMock(true); return; }
    try {
      const { data, error } = await supabase
        .from('mise_delivery_batches')
        .select(`
          id, status, started_at, total_eta_min, total_distance_km,
          stops:mise_delivery_batch_stops(
            id, reihenfolge, geliefert_am,
            order:customer_orders(id, bestellnummer, kunde_name, kunde_adresse, kunde_telefon, eta_earliest, gesamtbetrag)
          )
        `)
        .eq('fahrer_id', driverId)
        .in('status', ['unterwegs', 'assigned', 'pickup'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) { setUseMock(true); return; }

      setBatch({
        ...data,
        stops: (data.stops ?? []).map((s: any) => ({
          ...s,
          order: Array.isArray(s.order) ? s.order[0] : s.order,
        })),
      });
      setUseMock(false);
    } catch {
      setUseMock(true);
    }
  };

  useEffect(() => {
    fetchBatch();
    const iv = setInterval(fetchBatch, 20_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  const activeBatch = useMock ? MOCK_BATCH : batch;
  if (!activeBatch) return null;

  const stops = [...(activeBatch.stops ?? [])].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const doneStops = stops.filter(s => !!s.geliefert_am);
  const pendingStops = stops.filter(s => !s.geliefert_am);
  const currentStop = pendingStops[0] ?? null;
  const nextStop = pendingStops[1] ?? null;
  const elapsedMin = activeBatch.started_at
    ? Math.round((Date.now() - new Date(activeBatch.started_at).getTime()) / 60_000)
    : 0;

  const markDelivered = async (stopId: string) => {
    if (useMock) {
      setBatch(prev => prev ? {
        ...prev,
        stops: prev.stops.map(s => s.id === stopId ? { ...s, geliefert_am: new Date().toISOString() } : s),
      } : null);
      setConfirmingStop(null);
      return;
    }
    await supabase
      .from('mise_delivery_batch_stops')
      .update({ geliefert_am: new Date().toISOString() })
      .eq('id', stopId);
    setConfirmingStop(null);
    fetchBatch();
  };

  return (
    <div className="rounded-2xl border border-matcha-100 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between bg-matcha-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-matcha-300" />
          <span className="text-sm font-bold text-white">Tour-Stopps</span>
          {useMock && <span className="rounded bg-white/20 px-1.5 py-0.5 text-[9px] text-white/80">Demo</span>}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-matcha-300">
          <span className="flex items-center gap-0.5">
            <CheckCircle2 className="h-3 w-3" />
            {doneStops.length}/{stops.length}
          </span>
          <span className="flex items-center gap-0.5">
            <Clock className="h-3 w-3" />
            {elapsedMin}min
          </span>
          {activeBatch.total_distance_km && (
            <span className="flex items-center gap-0.5">
              <Bike className="h-3 w-3" />
              {activeBatch.total_distance_km.toFixed(1)}km
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-matcha-100">
        <div
          className="h-full bg-matcha-500 transition-all duration-500"
          style={{ width: `${stops.length > 0 ? Math.round((doneStops.length / stops.length) * 100) : 0}%` }}
        />
      </div>

      {/* Current stop — hero */}
      {currentStop && (
        <div className="px-4 py-4 bg-matcha-50/50">
          <div className="flex items-center gap-1.5 mb-2">
            <Zap className="h-3 w-3 text-matcha-600" />
            <span className="text-[9px] font-black uppercase tracking-widest text-matcha-600">Aktueller Stopp</span>
            <span className="ml-auto rounded-full bg-matcha-600 px-2 py-0.5 text-[9px] font-bold text-white">
              {currentStop.reihenfolge} / {stops.length}
            </span>
          </div>

          {currentStop.order && (
            <>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <p className="font-bold text-matcha-900 text-sm">{currentStop.order.kunde_name ?? 'Kunde'}</p>
                  <p className="text-[10px] text-matcha-500 font-mono">{currentStop.order.bestellnummer}</p>
                  {currentStop.order.gesamtbetrag && (
                    <p className="text-[11px] font-semibold text-matcha-700 mt-0.5">{fmtEur(currentStop.order.gesamtbetrag)}</p>
                  )}
                </div>
                {currentStop.order.eta_earliest && (
                  <div className="text-right">
                    <p className="text-[9px] text-matcha-400">ETA</p>
                    <p className={cn(
                      'text-sm font-black tabular-nums',
                      (minutesUntil(currentStop.order.eta_earliest) ?? 99) <= 2 ? 'text-red-600 animate-pulse' : 'text-matcha-700',
                    )}>
                      {fmtTime(currentStop.order.eta_earliest)}
                    </p>
                    {(() => {
                      const mins = minutesUntil(currentStop.order.eta_earliest);
                      if (mins === null) return null;
                      return (
                        <p className="text-[9px] text-matcha-500">{mins > 0 ? `in ${mins}min` : 'überfällig'}</p>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Address + actions */}
              {currentStop.order.kunde_adresse && (
                <div className="flex items-start gap-2 mb-3 rounded-xl bg-white border border-matcha-100 p-2.5">
                  <MapPin className="h-3.5 w-3.5 text-matcha-500 mt-0.5 flex-shrink-0" />
                  <span className="text-[11px] text-matcha-700 flex-1">{currentStop.order.kunde_adresse}</span>
                  <a
                    href={mapsUrl(currentStop.order.kunde_adresse)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-0.5 rounded-lg bg-matcha-600 px-2 py-1 text-[10px] font-bold text-white"
                  >
                    <Navigation className="h-2.5 w-2.5" />
                    Navi
                  </a>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                {currentStop.order.kunde_telefon && (
                  <a
                    href={`tel:${currentStop.order.kunde_telefon}`}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-matcha-200 bg-white py-2.5 text-xs font-semibold text-matcha-700"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    Anrufen
                  </a>
                )}
                {confirmingStop === currentStop.id ? (
                  <div className="flex-1 flex gap-1.5">
                    <button
                      onClick={() => setConfirmingStop(null)}
                      className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-600"
                    >
                      Abbrechen
                    </button>
                    <button
                      onClick={() => markDelivered(currentStop.id)}
                      className="flex-1 rounded-xl bg-matcha-600 py-2.5 text-xs font-bold text-white"
                    >
                      Bestätigen
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmingStop(currentStop.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-matcha-600 py-2.5 text-xs font-bold text-white"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Geliefert
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Next stop preview */}
      {nextStop?.order && (
        <div className="border-t border-matcha-50 px-4 py-2.5 flex items-center gap-2">
          <ChevronRight className="h-3.5 w-3.5 text-matcha-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-matcha-600 truncate">
              Nächster: {nextStop.order.kunde_name ?? nextStop.order.bestellnummer}
            </p>
            {nextStop.order.kunde_adresse && (
              <p className="text-[9px] text-matcha-400 truncate">{nextStop.order.kunde_adresse}</p>
            )}
          </div>
          {nextStop.order.eta_earliest && (
            <span className="text-[10px] font-mono font-semibold text-matcha-600 flex-shrink-0">
              {fmtTime(nextStop.order.eta_earliest)}
            </span>
          )}
        </div>
      )}

      {/* All stops list */}
      {stops.length > 0 && (
        <div className="border-t border-matcha-50 px-4 py-2">
          <div className="flex gap-1 overflow-x-auto scrollbar-none">
            {stops.map((stop, idx) => {
              const done = !!stop.geliefert_am;
              const current = !done && (idx === 0 || !!stops[idx - 1]?.geliefert_am);
              return (
                <div
                  key={stop.id}
                  className={cn(
                    'flex-shrink-0 flex flex-col items-center gap-0.5 rounded-xl border px-2.5 py-1.5 min-w-[44px]',
                    done    && 'bg-matcha-50 border-matcha-200',
                    current && 'bg-matcha-600 border-matcha-600',
                    !done && !current && 'bg-white border-slate-100',
                  )}
                >
                  <span className={cn('text-[9px] font-black', done ? 'text-matcha-600' : current ? 'text-white' : 'text-slate-400')}>
                    {stop.reihenfolge}
                  </span>
                  {done && <CheckCircle2 className="h-3 w-3 text-matcha-500" />}
                  {current && <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
                  {!done && !current && <Package className="h-3 w-3 text-slate-300" />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      {pendingStops.length === 0 && (
        <div className="border-t border-matcha-50 px-4 py-3 text-center">
          <div className="flex items-center justify-center gap-2 text-matcha-600">
            <Star className="h-4 w-4 text-yellow-500 fill-yellow-400" />
            <span className="text-sm font-bold">Tour abgeschlossen!</span>
          </div>
          <p className="text-[10px] text-matcha-400 mt-0.5">Alle {stops.length} Stopps geliefert</p>
        </div>
      )}
    </div>
  );
}
