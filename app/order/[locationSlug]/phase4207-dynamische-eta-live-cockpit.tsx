'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, Clock, CheckCircle2, Truck, Package, ChefHat, AlertTriangle } from 'lucide-react';

type LieferStatus = 'bestellt' | 'in_zubereitung' | 'bereit' | 'unterwegs' | 'fast_da' | 'geliefert';

interface EtaData {
  order_id: string;
  status: LieferStatus;
  eta_min: number;
  fahrer_name: string | null;
  fahrer_distanz_km: number | null;
  stopps_davor: number;
  prep_fertig: boolean;
  live: boolean;
  verzoegerung_min: number;
  fortschritt_pct: number;
}

const MOCK: EtaData = {
  order_id: 'ord_demo',
  status: 'unterwegs',
  eta_min: 8,
  fahrer_name: 'Marco T.',
  fahrer_distanz_km: 1.4,
  stopps_davor: 1,
  prep_fertig: true,
  live: true,
  verzoegerung_min: 0,
  fortschritt_pct: 68,
};

const STATUS_CONFIG: Record<LieferStatus, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  bestellt:       { label: 'Bestellung eingegangen',   icon: <Package className="w-4 h-4" />,   color: 'text-gray-600',   bg: 'bg-gray-100'   },
  in_zubereitung: { label: 'Wird zubereitet',           icon: <ChefHat className="w-4 h-4" />,   color: 'text-orange-600', bg: 'bg-orange-100' },
  bereit:         { label: 'Fertig — Fahrer kommt',     icon: <CheckCircle2 className="w-4 h-4"/>,color: 'text-blue-600',   bg: 'bg-blue-100'   },
  unterwegs:      { label: 'Fahrer ist unterwegs',      icon: <Truck className="w-4 h-4" />,     color: 'text-indigo-600', bg: 'bg-indigo-100' },
  fast_da:        { label: 'Fast da!',                   icon: <MapPin className="w-4 h-4" />,    color: 'text-green-600',  bg: 'bg-green-100'  },
  geliefert:      { label: 'Geliefert! Guten Appetit',  icon: <CheckCircle2 className="w-4 h-4"/>,color: 'text-green-700', bg: 'bg-green-100'  },
};

const STEPS: { key: LieferStatus; label: string }[] = [
  { key: 'bestellt',       label: 'Bestellt'   },
  { key: 'in_zubereitung', label: 'Zubereitung'},
  { key: 'unterwegs',      label: 'Unterwegs'  },
  { key: 'fast_da',        label: 'Fast da'    },
  { key: 'geliefert',      label: 'Geliefert'  },
];

const STATUS_ORDER: LieferStatus[] = ['bestellt','in_zubereitung','bereit','unterwegs','fast_da','geliefert'];

interface Props { orderId?: string; locationSlug?: string; }

export function Phase4207DynamischeEtaLiveCockpit({ orderId, locationSlug }: Props) {
  const [data, setData] = useState<EtaData>(MOCK);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/order-eta?order_id=${orderId}`);
      if (r.ok) { const j = await r.json(); if (!j.error) setData(j); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [orderId]);

  useEffect(() => { load(); const id = setInterval(load, 15_000); return () => clearInterval(id); }, [load]);
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 60_000); return () => clearInterval(id); }, []);

  const cfg = STATUS_CONFIG[data.status];
  const stepIdx = STEPS.findIndex((s) => {
    if (data.status === 'bereit') return s.key === 'unterwegs';
    return s.key === data.status;
  });
  const liveEta = Math.max(0, data.eta_min - tick);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Status Banner */}
      <div className={`flex items-center gap-2 px-4 py-3 ${cfg.bg}`}>
        <span className={cfg.color}>{cfg.icon}</span>
        <span className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</span>
        {data.live && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-green-600">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />LIVE
          </span>
        )}
        {loading && (
          <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin ml-2" />
        )}
      </div>

      {/* Progress Steps */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between relative">
          <div className="absolute inset-x-0 top-3 h-0.5 bg-gray-200" style={{ zIndex: 0 }} />
          {STEPS.map((s, i) => {
            const done = i <= stepIdx;
            const active = i === stepIdx;
            return (
              <div key={s.key} className="flex flex-col items-center gap-1 relative z-10">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold border-2 transition-all
                  ${done ? 'bg-indigo-500 border-indigo-500 text-white' : 'bg-white border-gray-300 text-gray-400'}
                  ${active ? 'ring-2 ring-indigo-300 ring-offset-1' : ''}`}>
                  {done && !active ? '✓' : i + 1}
                </div>
                <span className={`text-[8px] font-medium ${done ? 'text-indigo-600' : 'text-gray-400'}`}>{s.label}</span>
              </div>
            );
          })}
        </div>

        {/* Overall progress bar */}
        <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-1000"
            style={{ width: `${data.fortschritt_pct}%` }}
          />
        </div>
      </div>

      {/* ETA + Details */}
      <div className="px-4 pb-4 space-y-3">
        {data.status !== 'geliefert' && (
          <div className="flex items-center justify-between bg-indigo-50 rounded-xl px-3 py-3">
            <div>
              <p className="text-[10px] text-indigo-500 font-semibold uppercase tracking-wide">Geschätzte Lieferzeit</p>
              <p className="text-3xl font-black text-indigo-700 tabular-nums">{liveEta} <span className="text-base font-semibold">min</span></p>
              {data.verzoegerung_min > 0 && (
                <p className="text-[10px] text-amber-600 font-medium flex items-center gap-0.5 mt-0.5">
                  <AlertTriangle className="w-3 h-3" />+{data.verzoegerung_min} min Verzögerung
                </p>
              )}
            </div>
            <Clock className="w-10 h-10 text-indigo-200" />
          </div>
        )}

        {data.status === 'geliefert' && (
          <div className="flex items-center justify-center bg-green-50 rounded-xl px-3 py-4 gap-2">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
            <p className="text-base font-bold text-green-700">Erfolgreich geliefert!</p>
          </div>
        )}

        {/* Fahrer Info */}
        {data.fahrer_name && data.status !== 'geliefert' && (
          <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2">
            <Truck className="w-5 h-5 text-gray-400" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-800">{data.fahrer_name}</p>
              <p className="text-[10px] text-gray-500">
                {data.fahrer_distanz_km !== null && `${data.fahrer_distanz_km} km entfernt`}
                {data.stopps_davor > 0 && ` · ${data.stopps_davor} Stopp${data.stopps_davor > 1 ? 's' : ''} davor`}
                {data.stopps_davor === 0 && data.fahrer_distanz_km !== null && ' · Nächster Stopp!'}
              </p>
            </div>
            {data.status === 'fast_da' && (
              <span className="text-[10px] font-bold text-green-600 bg-green-100 rounded-full px-2 py-0.5">Fast da!</span>
            )}
          </div>
        )}

        {/* Prep Status */}
        <div className="flex items-center gap-2">
          <ChefHat className={`w-4 h-4 ${data.prep_fertig ? 'text-green-500' : 'text-orange-400'}`} />
          <span className="text-[10px] text-gray-600">
            Zubereitung: {data.prep_fertig ? 'Fertig ✓' : 'läuft...'}
          </span>
          {data.live && (
            <span className="ml-auto text-[9px] text-gray-400 flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />15s Live-Update
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
