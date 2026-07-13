'use client';

// Phase 1207 — Dynamische ETA & Live-Tracking Banner (Storefront)
// Zeigt dem Kunden: Live-ETA-Countdown + Fahrer-Näherungs-Indikator + Phasen-Timeline
// Dynamisch: reagiert auf Surge, Wetter, Fahrer-GPS-Position

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Clock, Bike, ChefHat, Package, CheckCircle2, Zap, AlertTriangle } from 'lucide-react';

interface Props {
  orderId: string;
  locationId: string;
  initialEtaMin?: number | null;
}

type Phase = 'bestellt' | 'zubereitung' | 'abholbereit' | 'unterwegs' | 'geliefert';

const PHASE_CFG: Record<Phase, { label: string; icon: React.ReactNode; color: string }> = {
  bestellt:    { label: 'Bestellt',      icon: <Package className="h-4 w-4" />,     color: 'text-stone-400' },
  zubereitung: { label: 'In Zubereitung',icon: <ChefHat className="h-4 w-4" />,     color: 'text-amber-500' },
  abholbereit: { label: 'Bereit',         icon: <Package className="h-4 w-4" />,     color: 'text-blue-500' },
  unterwegs:   { label: 'Unterwegs',      icon: <Bike className="h-4 w-4" />,        color: 'text-matcha-600' },
  geliefert:   { label: 'Geliefert',      icon: <CheckCircle2 className="h-4 w-4" />,color: 'text-matcha-600' },
};

const PHASE_ORDER: Phase[] = ['bestellt', 'zubereitung', 'abholbereit', 'unterwegs', 'geliefert'];

interface TrackingData {
  status: Phase;
  etaMin: number | null;
  surgeActive: boolean;
  etaExtension: number;
  driverDistanceKm: number | null;
  driverName: string | null;
}

function fmtEta(min: number): string {
  if (min <= 0) return 'Sofort';
  if (min < 60) return `~${min} Min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `~${h}h ${m > 0 ? `${m}min` : ''}`;
}

export function StorefrontPhase1207DynamischeEtaLiveTracking({ orderId, locationId, initialEtaMin }: Props) {
  const [data, setData] = useState<TrackingData>({
    status: 'zubereitung',
    etaMin: initialEtaMin ?? 30,
    surgeActive: false,
    etaExtension: 0,
    driverDistanceKm: null,
    driverName: null,
  });
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const tickId = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(tickId);
  }, []);

  useEffect(() => {
    if (!orderId || !locationId) return;
    setLoading(true);
    fetch(`/api/delivery/eta/live?location_id=${locationId}&order_id=${orderId}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setData(prev => ({
          status: (d.status as Phase) ?? prev.status,
          etaMin: d.eta_min ?? prev.etaMin,
          surgeActive: d.queue_signal === 'surge',
          etaExtension: d.eta_extension_min ?? 0,
          driverDistanceKm: d.driver_distance_km ?? null,
          driverName: d.driver_name ?? null,
        }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orderId, locationId, tick]);

  const currentPhaseIdx = PHASE_ORDER.indexOf(data.status);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      {/* ETA-Hero */}
      <div className={cn(
        'px-5 py-4 flex items-center justify-between',
        data.status === 'geliefert' ? 'bg-matcha-50' : 'bg-stone-50'
      )}>
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">
            {data.status === 'unterwegs'
              ? data.driverName ? `${data.driverName} ist unterwegs` : 'Fahrer unterwegs'
              : data.status === 'geliefert'
              ? '🎉 Geliefert!'
              : 'Voraussichtliche Lieferzeit'}
          </div>
          <div className={cn(
            'text-3xl font-black tabular-nums',
            data.status === 'geliefert' ? 'text-matcha-700' : 'text-stone-800'
          )}>
            {data.status === 'geliefert'
              ? 'Geliefert ✓'
              : data.etaMin !== null
              ? fmtEta(data.etaMin)
              : '—'}
          </div>
          {data.driverDistanceKm !== null && data.status === 'unterwegs' && (
            <div className="text-xs text-stone-500 mt-0.5 flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              ~{data.driverDistanceKm.toFixed(1)} km entfernt
            </div>
          )}
        </div>
        <div className={cn(
          'h-14 w-14 rounded-full flex items-center justify-center text-2xl',
          data.status === 'geliefert'
            ? 'bg-matcha-100 text-matcha-700'
            : data.status === 'unterwegs'
            ? 'bg-blue-100 text-blue-600'
            : 'bg-amber-100 text-amber-600'
        )}>
          {data.status === 'geliefert' ? '🎉' :
           data.status === 'unterwegs' ? '🛵' :
           data.status === 'zubereitung' ? '👨‍🍳' : '📦'}
        </div>
      </div>

      {/* Surge-Warnung */}
      {data.surgeActive && data.etaExtension > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border-y border-amber-200 px-4 py-2">
          <Zap className="h-4 w-4 text-amber-500 shrink-0 animate-pulse" />
          <span className="text-xs font-semibold text-amber-700">
            Hohe Nachfrage — ETA um +{data.etaExtension} Min verlängert
          </span>
        </div>
      )}

      {/* Phasen-Timeline */}
      <div className="px-5 py-4">
        <div className="relative flex items-center justify-between">
          {/* Connector line */}
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-stone-200" />
          <div
            className="absolute top-4 left-4 h-0.5 bg-matcha-500 transition-all duration-700"
            style={{
              width: currentPhaseIdx >= 0
                ? `${(currentPhaseIdx / (PHASE_ORDER.length - 1)) * 100}%`
                : '0%'
            }}
          />

          {PHASE_ORDER.map((phase, i) => {
            const cfg = PHASE_CFG[phase];
            const isDone = i < currentPhaseIdx;
            const isActive = i === currentPhaseIdx;
            return (
              <div key={phase} className="relative flex flex-col items-center gap-1 z-10">
                <div className={cn(
                  'h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all',
                  isDone
                    ? 'bg-matcha-500 border-matcha-500 text-white'
                    : isActive
                    ? 'bg-white border-matcha-500 text-matcha-600 shadow-md ring-2 ring-matcha-200'
                    : 'bg-white border-stone-200 text-stone-300'
                )}>
                  {isDone ? <CheckCircle2 className="h-4 w-4" /> : cfg.icon}
                </div>
                <span className={cn(
                  'text-[9px] font-bold text-center max-w-[48px]',
                  isActive ? 'text-matcha-700' : isDone ? 'text-matcha-500' : 'text-stone-300'
                )}>
                  {cfg.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live-Update-Indikator */}
      <div className="border-t px-5 py-2 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-matcha-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-matcha-500" />
        </span>
        <span className="text-[10px] text-stone-400">Live-Tracking aktiv</span>
        {loading && <span className="text-[10px] text-stone-300 ml-auto">Aktualisiert…</span>}
      </div>
    </div>
  );
}
