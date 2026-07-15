'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock, MapPin, Navigation, Package, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';

type TourStop = {
  id: string;
  sequence: number;
  order_id: string;
  bestellnummer?: string;
  kunde_name?: string;
  adresse?: string;
  eta_min?: number | null;
  geliefert_am: string | null;
  angekommen_am: string | null;
  betrag?: number | null;
  zahlungsart?: string;
  telefon?: string | null;
};

function etaColor(min: number | null | undefined): string {
  if (min === null || min === undefined) return 'text-stone-500';
  if (min <= 3) return 'text-red-600';
  if (min <= 8) return 'text-amber-600';
  return 'text-matcha-600';
}

function openMapsNav(address: string) {
  const encoded = encodeURIComponent(address);
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const url = isIOS
    ? `maps://maps.apple.com/?daddr=${encoded}&dirflg=d`
    : `https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=driving`;
  window.open(url, '_blank');
}

export function FahrerPhase1665TourStopsNavKommando({
  batchId,
  driverId,
}: {
  batchId: string | null;
  driverId: string;
}) {
  const [stops, setStops] = useState<TourStop[]>([]);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState<string | null>(null);

  useEffect(() => {
    if (!batchId) return;
    setLoading(true);
    fetch(`/api/fahrer/tour-stops?batch_id=${batchId}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (Array.isArray(d?.stops)) setStops(d.stops); })
      .catch(() => {})
      .finally(() => setLoading(false));

    const iv = setInterval(() => {
      fetch(`/api/fahrer/tour-stops?batch_id=${batchId}`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (Array.isArray(d?.stops)) setStops(d.stops); })
        .catch(() => {});
    }, 20_000);
    return () => clearInterval(iv);
  }, [batchId]);

  const pending = stops.filter(s => !s.geliefert_am).sort((a, b) => a.sequence - b.sequence);
  const done = stops.filter(s => s.geliefert_am).sort((a, b) => a.sequence - b.sequence);

  async function markDelivered(stopId: string) {
    setMarking(stopId);
    try {
      await fetch('/api/fahrer/stopp-abschliessen', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stop_id: stopId, driver_id: driverId }),
      });
      setStops(prev => prev.map(s =>
        s.id === stopId ? { ...s, geliefert_am: new Date().toISOString() } : s,
      ));
    } catch {}
    finally { setMarking(null); }
  }

  if (!batchId) return null;
  if (loading && stops.length === 0) return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 text-center text-sm text-stone-400">
      Tour-Stops laden…
    </div>
  );
  if (stops.length === 0) return null;

  const nextStop = pending[0] ?? null;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-stone-50">
        <Navigation className="h-4 w-4 text-saffron shrink-0" />
        <span className="text-xs font-black uppercase tracking-wider text-stone-700">Tour-Stops</span>
        <span className="ml-auto text-[10px] font-bold">
          <span className="text-matcha-600">{done.length}</span>
          <span className="text-stone-300 mx-1">/</span>
          <span className="text-stone-600">{stops.length}</span>
          <span className="text-stone-400 ml-1">geliefert</span>
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-stone-100">
        <div
          className="h-full bg-matcha-500 transition-all duration-700"
          style={{ width: `${stops.length > 0 ? (done.length / stops.length) * 100 : 0}%` }}
        />
      </div>

      {/* Next stop hero */}
      {nextStop && (
        <div className="p-4 border-b border-stone-100 bg-saffron/5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[9px] font-black text-saffron uppercase tracking-wider">Nächster Stopp</span>
                {nextStop.eta_min !== null && nextStop.eta_min !== undefined && (
                  <span className={cn('text-[10px] font-black tabular-nums', etaColor(nextStop.eta_min))}>
                    ~{nextStop.eta_min} Min
                  </span>
                )}
              </div>
              <div className="text-base font-bold text-stone-800 truncate">
                {nextStop.kunde_name ?? `Stopp ${nextStop.sequence}`}
              </div>
              {nextStop.adresse && (
                <div className="flex items-center gap-1 text-sm text-stone-500 mt-0.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-saffron" />
                  <span className="truncate">{nextStop.adresse}</span>
                </div>
              )}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {nextStop.betrag !== null && nextStop.betrag !== undefined && (
                  <span className={cn(
                    'text-[11px] font-bold px-2 py-0.5 rounded-full',
                    nextStop.zahlungsart === 'bar' ? 'bg-amber-100 text-amber-800' : 'bg-matcha-100 text-matcha-800',
                  )}>
                    {nextStop.betrag.toFixed(2)} € {nextStop.zahlungsart === 'bar' ? '(Bar)' : '(Karte)'}
                  </span>
                )}
                {nextStop.bestellnummer && (
                  <span className="text-[10px] text-stone-400 font-mono">#{nextStop.bestellnummer}</span>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-3">
            {nextStop.adresse && (
              <button
                onClick={() => openMapsNav(nextStop.adresse!)}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-saffron text-white font-bold text-sm py-2.5 active:scale-95 transition-transform"
              >
                <Navigation className="h-4 w-4" />
                Navigation starten
              </button>
            )}
            {nextStop.telefon && (
              <a
                href={`tel:${nextStop.telefon}`}
                className="flex items-center justify-center w-11 h-11 rounded-xl bg-stone-100 text-stone-600 active:scale-95 transition-transform"
              >
                <Phone className="h-4 w-4" />
              </a>
            )}
            <button
              onClick={() => markDelivered(nextStop.id)}
              disabled={marking === nextStop.id}
              className="flex items-center justify-center w-11 h-11 rounded-xl bg-matcha-600 text-white active:scale-95 transition-transform disabled:opacity-50"
              title="Als geliefert markieren"
            >
              <CheckCircle2 className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Upcoming stops */}
      {pending.slice(1).length > 0 && (
        <div className="px-4 py-2 border-b border-stone-100">
          <div className="text-[9px] font-black text-stone-400 uppercase tracking-wider mb-1.5">Weitere Stops</div>
          <div className="space-y-1.5">
            {pending.slice(1, 4).map((s, idx) => (
              <div key={s.id} className="flex items-center gap-2 text-sm">
                <div className="w-5 h-5 rounded-full bg-stone-100 text-stone-400 text-[10px] font-black flex items-center justify-center shrink-0">
                  {idx + 2}
                </div>
                <MapPin className="h-3.5 w-3.5 text-stone-300 shrink-0" />
                <span className="text-stone-600 truncate flex-1">{s.adresse ?? s.kunde_name ?? `Stopp ${s.sequence}`}</span>
                {s.eta_min !== null && s.eta_min !== undefined && (
                  <span className={cn('text-[10px] font-bold shrink-0 tabular-nums', etaColor(s.eta_min))}>
                    ~{s.eta_min}m
                  </span>
                )}
              </div>
            ))}
            {pending.slice(4).length > 0 && (
              <div className="text-[10px] text-stone-400 pl-7">
                + {pending.slice(4).length} weitere Stops
              </div>
            )}
          </div>
        </div>
      )}

      {/* Done stops (collapsed) */}
      {done.length > 0 && (
        <div className="px-4 py-2 bg-matcha-50">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-matcha-600 shrink-0" />
            <span className="text-[10px] font-bold text-matcha-700">
              {done.length} Stop{done.length !== 1 ? 's' : ''} abgeschlossen
            </span>
          </div>
        </div>
      )}

      {/* All done */}
      {pending.length === 0 && done.length > 0 && (
        <div className="p-4 text-center">
          <Package className="h-8 w-8 text-matcha-500 mx-auto mb-2" />
          <div className="text-sm font-bold text-matcha-700">Tour abgeschlossen!</div>
          <div className="text-xs text-stone-400">{done.length} Lieferungen zugestellt</div>
        </div>
      )}
    </div>
  );
}
