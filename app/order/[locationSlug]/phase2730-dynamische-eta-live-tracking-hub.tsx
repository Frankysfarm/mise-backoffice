'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, MapPin, Bike, CheckCircle2, Package, ChefHat, Navigation } from 'lucide-react';

interface TrackingData {
  bestell_id: string;
  status: 'bestätigt' | 'in_zubereitung' | 'bereit' | 'unterwegs' | 'geliefert';
  eta_min: number | null;
  eta_konfidenz: 'hoch' | 'mittel' | 'niedrig';
  fahrer_name: string | null;
  fahrer_entfernung_km: number | null;
  fortschritt_pct: number;
  geschaetzt_ankunft: string | null;   // HH:MM
  zone_name: string | null;
  verspaetung_min: number;             // 0 = pünktlich, >0 = verspätet
}

const MOCK: TrackingData = {
  bestell_id: 'order_mock',
  status: 'unterwegs',
  eta_min: 8,
  eta_konfidenz: 'hoch',
  fahrer_name: 'Julia F.',
  fahrer_entfernung_km: 2.1,
  fortschritt_pct: 68,
  geschaetzt_ankunft: '19:42',
  zone_name: 'Innenstadt',
  verspaetung_min: 0,
};

const STEPS: Array<{ key: TrackingData['status']; label: string; icon: React.ReactNode }> = [
  { key: 'bestätigt',     label: 'Bestätigt',    icon: <CheckCircle2 className="w-4 h-4" /> },
  { key: 'in_zubereitung',label: 'Zubereitung',  icon: <ChefHat className="w-4 h-4" /> },
  { key: 'bereit',        label: 'Bereit',        icon: <Package className="w-4 h-4" /> },
  { key: 'unterwegs',     label: 'Unterwegs',     icon: <Bike className="w-4 h-4" /> },
  { key: 'geliefert',     label: 'Geliefert',     icon: <CheckCircle2 className="w-4 h-4" /> },
];

const STATUS_ORDER: TrackingData['status'][] = ['bestätigt', 'in_zubereitung', 'bereit', 'unterwegs', 'geliefert'];

function konfidenzColor(k: TrackingData['eta_konfidenz']): string {
  if (k === 'hoch')   return 'text-emerald-600';
  if (k === 'mittel') return 'text-yellow-600';
  return 'text-gray-400';
}

export function StorefrontPhase2730DynamischeEtaLiveTrackingHub({ orderId, locationId }: { orderId?: string; locationId?: string }) {
  const [data, setData] = useState<TrackingData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!orderId || !locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/tracking?order_id=${orderId}&location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch {
      // Mock-Fallback
    } finally {
      setLoading(false);
    }
  }, [orderId, locationId]);

  useEffect(() => { load(); const id = setInterval(load, 15_000); return () => clearInterval(id); }, [load]);

  const currentStep = STATUS_ORDER.indexOf(data.status);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* ETA-Header */}
      <div className={`p-4 ${data.status === 'geliefert' ? 'bg-emerald-600' : 'bg-indigo-600'} text-white`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-indigo-200 text-xs mb-1">
              {data.status === 'geliefert' ? 'Zugestellt' : 'Voraussichtliche Lieferzeit'}
            </p>
            {data.status !== 'geliefert' && data.eta_min !== null ? (
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-extrabold">{data.eta_min}</span>
                <span className="text-lg font-medium text-indigo-200">min</span>
              </div>
            ) : data.status === 'geliefert' ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-7 h-7" />
                <span className="text-2xl font-bold">Guten Appetit!</span>
              </div>
            ) : (
              <span className="text-2xl font-bold">Wird berechnet…</span>
            )}
            {data.geschaetzt_ankunft && data.status !== 'geliefert' && (
              <p className="text-indigo-200 text-sm mt-0.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Ankunft ca. {data.geschaetzt_ankunft} Uhr
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`text-xs font-medium bg-white/20 px-2 py-0.5 rounded-full ${konfidenzColor(data.eta_konfidenz)}`}>
              {data.eta_konfidenz === 'hoch' ? '● Präzise' : data.eta_konfidenz === 'mittel' ? '● Schätzung' : '● Unbekannt'}
            </span>
            {loading && <span className="w-2.5 h-2.5 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />}
          </div>
        </div>

        {/* Verspatung */}
        {data.verspaetung_min > 0 && (
          <div className="mt-2 bg-white/15 rounded-lg px-3 py-1.5 text-xs">
            ⚠️ Ca. {data.verspaetung_min} min später als erwartet
          </div>
        )}
      </div>

      {/* Fortschrittsbalken */}
      <div className="px-4 pt-3 pb-1">
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${data.status === 'geliefert' ? 'bg-emerald-500' : 'bg-indigo-500'}`}
            style={{ width: `${data.fortschritt_pct}%` }}
          />
        </div>
      </div>

      {/* Status-Timeline */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between relative">
          {/* Verbindungslinie */}
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-100" />
          <div
            className="absolute top-4 left-4 h-0.5 bg-indigo-500 transition-all duration-700"
            style={{ width: `calc(${(currentStep / (STEPS.length - 1)) * 100}% - 8px)` }}
          />
          {STEPS.map((step, i) => {
            const done    = i < currentStep;
            const current = i === currentStep;
            return (
              <div key={step.key} className="flex flex-col items-center gap-1 z-10">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors
                  ${done    ? 'bg-indigo-500 text-white' :
                    current ? 'bg-indigo-600 text-white ring-2 ring-indigo-300' :
                              'bg-gray-100   text-gray-400'}`}>
                  {step.icon}
                </div>
                <span className={`text-[9px] text-center font-medium leading-tight
                  ${current ? 'text-indigo-700' : done ? 'text-gray-600' : 'text-gray-400'}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fahrer-Info */}
      {data.fahrer_name && data.status === 'unterwegs' && (
        <div className="mx-4 mb-3 flex items-center gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
          <div className="w-9 h-9 bg-indigo-200 rounded-full flex items-center justify-center">
            <Bike className="w-4 h-4 text-indigo-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-800">{data.fahrer_name}</p>
            {data.fahrer_entfernung_km !== null && (
              <p className="text-[11px] text-gray-500 flex items-center gap-0.5">
                <Navigation className="w-3 h-3" /> {data.fahrer_entfernung_km.toFixed(1)} km entfernt
              </p>
            )}
          </div>
          {data.zone_name && (
            <span className="text-[10px] text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full flex items-center gap-0.5">
              <MapPin className="w-2.5 h-2.5" /> {data.zone_name}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
