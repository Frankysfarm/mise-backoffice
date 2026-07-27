'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, Clock, Navigation, Package, CheckCircle2, Truck, AlertTriangle } from 'lucide-react';

/**
 * Phase 4000 — ETA Live Tracker (Storefront)
 * Dynamische ETA-Anzeige mit Phasen-Timeline, Fahrer-Position,
 * Echtzeit-Aktualisierung; 20-Sek-Polling; Mock-Fallback.
 */

type Bestellphase = 'bestaetigt' | 'zubereitung' | 'bereit' | 'unterwegs' | 'geliefert';

interface EtaTrackerData {
  bestellung_nr: string;
  phase: Bestellphase;
  eta_min: number | null;
  fahrer_name: string | null;
  fahrer_tel: string | null;
  distanz_km: number | null;
  letzte_aktualisierung: string;
  adresse: string;
}

const PHASEN: { key: Bestellphase; label: string; icon: React.ReactNode }[] = [
  { key: 'bestaetigt',  label: 'Bestätigt',   icon: <Package className="h-4 w-4" /> },
  { key: 'zubereitung', label: 'Zubereitung', icon: <Clock className="h-4 w-4" /> },
  { key: 'bereit',      label: 'Bereit',       icon: <CheckCircle2 className="h-4 w-4" /> },
  { key: 'unterwegs',   label: 'Unterwegs',    icon: <Truck className="h-4 w-4" /> },
  { key: 'geliefert',   label: 'Geliefert',    icon: <MapPin className="h-4 w-4" /> },
];

const PHASE_IDX: Record<Bestellphase, number> = {
  bestaetigt: 0,
  zubereitung: 1,
  bereit: 2,
  unterwegs: 3,
  geliefert: 4,
};

const MOCK: EtaTrackerData = {
  bestellung_nr: 'B-2042',
  phase: 'unterwegs',
  eta_min: 12,
  fahrer_name: 'Max K.',
  fahrer_tel: '+49 241 123456',
  distanz_km: 2.3,
  letzte_aktualisierung: new Date().toLocaleTimeString('de-DE'),
  adresse: 'Hauptstraße 12, Aachen',
};

export function Phase4000EtaLiveTracker({ orderId }: { orderId?: string | null }) {
  const [data, setData] = useState<EtaTrackerData>(MOCK);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/tracking?order_id=${orderId}`);
      if (res.ok) {
        const d = await res.json();
        if (d?.phase) setData({ ...d, letzte_aktualisierung: new Date().toLocaleTimeString('de-DE') });
      }
    } catch { /* Mock-Fallback */ }
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 20000);
    const ticker = setInterval(() => setTick(t => t + 1), 1000);
    return () => { clearInterval(poll); clearInterval(ticker); };
  }, [load]);

  const currentIdx = PHASE_IDX[data.phase];
  const isGeliefert = data.phase === 'geliefert';

  return (
    <div className="rounded-2xl overflow-hidden border border-stone-200 bg-white shadow-sm">
      {/* Header */}
      <div className={`px-4 py-3 flex items-center gap-3 ${isGeliefert ? 'bg-emerald-600' : 'bg-stone-900'}`}>
        <Navigation className={`h-4 w-4 shrink-0 ${isGeliefert ? 'text-white' : 'text-stone-300'}`} />
        <span className="font-bold text-sm text-white">Live-Tracking · #{data.bestellung_nr}</span>
        {loading && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-white/60 animate-pulse" />}
        <span className="ml-auto text-[10px] text-white/60">{data.letzte_aktualisierung}</span>
      </div>

      {/* ETA Hero */}
      {!isGeliefert && data.eta_min !== null && (
        <div className="flex items-center justify-center gap-3 py-5 bg-stone-50 border-b border-stone-100">
          <div className="text-center">
            <div className="font-black text-5xl tabular-nums text-stone-900 leading-none">{data.eta_min}</div>
            <div className="text-xs font-bold text-stone-500 mt-1">Minuten</div>
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-stone-700">Erwartete Ankunft</div>
            {data.distanz_km !== null && (
              <div className="text-xs text-stone-500">{data.distanz_km.toFixed(1)} km entfernt</div>
            )}
          </div>
        </div>
      )}

      {/* Geliefert Banner */}
      {isGeliefert && (
        <div className="flex items-center justify-center gap-3 py-5 bg-emerald-50 border-b border-emerald-100">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          <div>
            <div className="font-black text-lg text-emerald-700">Geliefert!</div>
            <div className="text-xs text-emerald-600">Guten Appetit!</div>
          </div>
        </div>
      )}

      {/* Phasen-Timeline */}
      <div className="px-4 py-4">
        <div className="relative flex items-center justify-between">
          {/* Connecting line */}
          <div className="absolute left-0 right-0 top-4 h-0.5 bg-stone-100 z-0" />
          <div
            className="absolute left-0 top-4 h-0.5 bg-emerald-500 z-0 transition-all duration-700"
            style={{ width: `${(currentIdx / (PHASEN.length - 1)) * 100}%` }}
          />
          {PHASEN.map((phase, i) => {
            const done = i < currentIdx;
            const active = i === currentIdx;
            return (
              <div key={phase.key} className="flex flex-col items-center gap-1 z-10">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center transition-all duration-500 ${
                  done    ? 'bg-emerald-500 text-white' :
                  active  ? 'bg-stone-900 text-white ring-2 ring-stone-900 ring-offset-2' :
                  'bg-stone-100 text-stone-400'
                }`}>
                  {phase.icon}
                </div>
                <span className={`text-[9px] font-bold text-center max-w-[48px] leading-tight ${
                  active ? 'text-stone-900' : done ? 'text-emerald-600' : 'text-stone-400'
                }`}>
                  {phase.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fahrer Info */}
      {data.fahrer_name && !isGeliefert && (
        <div className="mx-4 mb-4 flex items-center gap-3 rounded-xl bg-stone-50 border border-stone-100 px-3 py-2.5">
          <div className="h-8 w-8 rounded-full bg-stone-200 flex items-center justify-center text-sm font-black text-stone-700 shrink-0">
            {data.fahrer_name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-stone-700">{data.fahrer_name}</div>
            <div className="text-[10px] text-stone-500">Dein Fahrer</div>
          </div>
          {data.fahrer_tel && (
            <a
              href={`tel:${data.fahrer_tel}`}
              className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-black text-white active:scale-95 transition"
            >
              Anrufen
            </a>
          )}
        </div>
      )}

      {/* Lieferadresse */}
      <div className="flex items-center gap-2 px-4 pb-3 text-[11px] text-stone-500">
        <MapPin className="h-3 w-3 shrink-0 text-stone-400" />
        <span className="truncate">{data.adresse}</span>
      </div>
    </div>
  );
}
