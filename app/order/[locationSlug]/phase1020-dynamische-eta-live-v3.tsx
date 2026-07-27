'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, MapPin, Navigation, CheckCircle2, AlertCircle, Package, ChefHat, Truck } from 'lucide-react';

type LieferStatus = 'bestätigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert';

interface TrackingData {
  status: LieferStatus;
  eta_min: number | null;
  fahrer_name: string | null;
  fahrer_entfernung_km: number | null;
  prep_pct: number | null;
}

const PHASE_ICONS: Record<LieferStatus, React.ReactNode> = {
  bestätigt:      <Package className="w-4 h-4" />,
  in_zubereitung: <ChefHat className="w-4 h-4" />,
  fertig:         <CheckCircle2 className="w-4 h-4" />,
  unterwegs:      <Truck className="w-4 h-4" />,
  geliefert:      <CheckCircle2 className="w-4 h-4" />,
};

const PHASE_LABEL: Record<LieferStatus, string> = {
  bestätigt:      'Bestätigt',
  in_zubereitung: 'In Zubereitung',
  fertig:         'Fertig – Warte auf Fahrer',
  unterwegs:      'Unterwegs',
  geliefert:      'Geliefert',
};

const PHASE_ORDER: LieferStatus[] = ['bestätigt', 'in_zubereitung', 'fertig', 'unterwegs', 'geliefert'];

function phaseIdx(s: LieferStatus) { return PHASE_ORDER.indexOf(s); }

function etaColor(min: number | null) {
  if (min == null) return 'text-gray-500';
  if (min <= 5)  return 'text-red-500';
  if (min <= 15) return 'text-orange-500';
  if (min <= 30) return 'text-yellow-600';
  return 'text-green-600';
}

const MOCK: TrackingData = {
  status: 'unterwegs',
  eta_min: 12,
  fahrer_name: 'Max M.',
  fahrer_entfernung_km: 1.4,
  prep_pct: null,
};

interface Props {
  orderId: string | null;
  locationId: string | null;
  className?: string;
}

export function StorefrontPhase1020DynamischeEtaLiveV3({ orderId, locationId, className = '' }: Props) {
  const [data, setData] = useState<TrackingData>(MOCK);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/tracking/live?order_id=${orderId}&location_id=${locationId}`);
      if (r.ok) { const j = await r.json(); if (!j.error) setData(j); }
    } catch { /* Mock */ }
    finally { setLoading(false); }
  }, [orderId, locationId]);

  useEffect(() => { load(); const iv = setInterval(load, 20_000); return () => clearInterval(iv); }, [load]);
  useEffect(() => { const iv = setInterval(() => setTick((t) => t + 1), 1_000); return () => clearInterval(iv); }, []);

  const currentIdx = phaseIdx(data.status);
  const isDelivered = data.status === 'geliefert';
  const etaDisplay = data.eta_min != null ? Math.max(0, data.eta_min - Math.floor(tick / 60)) : null;

  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3 mx-4 mb-4 ${className}`}>
      {/* ETA Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Lieferung in</p>
          {isDelivered ? (
            <p className="text-xl font-bold text-green-600 flex items-center gap-1">
              <CheckCircle2 className="w-5 h-5" />Geliefert!
            </p>
          ) : (
            <p className={`text-2xl font-bold tabular-nums ${etaColor(etaDisplay)}`}>
              {etaDisplay != null ? `~${etaDisplay} min` : '…'}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          {loading && <span className="w-2 h-2 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          <span className="text-[9px] text-gray-400">{PHASE_LABEL[data.status]}</span>
        </div>
      </div>

      {/* Phase Timeline */}
      <div className="relative">
        <div className="absolute top-3 left-3.5 right-3.5 h-0.5 bg-gray-100" />
        <div
          className="absolute top-3 left-3.5 h-0.5 bg-matcha-500 transition-all duration-700"
          style={{ width: `${currentIdx === 0 ? 0 : (currentIdx / (PHASE_ORDER.length - 1)) * 100}%` }}
        />
        <div className="relative flex justify-between">
          {PHASE_ORDER.map((phase, idx) => {
            const done = idx < currentIdx;
            const active = idx === currentIdx;
            return (
              <div key={phase} className="flex flex-col items-center gap-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center z-10 transition-all ${
                  done ? 'bg-matcha-500 text-white' : active ? 'bg-matcha-100 text-matcha-700 ring-2 ring-matcha-400' : 'bg-gray-100 text-gray-400'
                }`}>
                  {PHASE_ICONS[phase]}
                </div>
                <span className={`text-[8px] text-center leading-tight max-w-12 ${
                  active ? 'text-matcha-700 font-semibold' : done ? 'text-gray-400' : 'text-gray-300'
                }`}>
                  {PHASE_LABEL[phase].split(' ')[0]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fahrer Info (wenn unterwegs) */}
      {data.status === 'unterwegs' && (data.fahrer_name || data.fahrer_entfernung_km != null) && (
        <div className="flex items-center gap-2 bg-blue-50 rounded-xl px-3 py-2">
          <Navigation className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-[11px] font-semibold text-blue-800">
              {data.fahrer_name ?? 'Dein Fahrer'} ist unterwegs
            </p>
            {data.fahrer_entfernung_km != null && (
              <p className="text-[10px] text-blue-600">
                noch ca. {data.fahrer_entfernung_km.toFixed(1)} km entfernt
              </p>
            )}
          </div>
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
        </div>
      )}

      {/* Küchen-Fortschritt (in_zubereitung) */}
      {data.status === 'in_zubereitung' && data.prep_pct != null && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><ChefHat className="w-3 h-3" />Wird zubereitet</span>
            <span>{data.prep_pct}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${data.prep_pct}%` }} />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-[9px] text-gray-400 pt-1 border-t border-gray-100">
        <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />Live-Tracking</span>
        <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />Alle 20s aktualisiert</span>
      </div>
    </div>
  );
}
