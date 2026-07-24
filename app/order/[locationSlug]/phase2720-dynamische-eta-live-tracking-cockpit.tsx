'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, Clock, Bike, CheckCircle2, Package, ChefHat } from 'lucide-react';

interface OrderStatus {
  order_id: string;
  bestellnummer: string;
  status: 'bestaetigt' | 'zubereitung' | 'bereit' | 'abgeholt' | 'unterwegs' | 'geliefert';
  eta_min: number | null;
  eta_updated_at: string | null;
  fahrer_name: string | null;
  prep_start: string | null;
  distance_km: number | null;
  fortschritt_pct: number;
}

const PHASES = [
  { key: 'bestaetigt', label: 'Bestätigt', icon: CheckCircle2 },
  { key: 'zubereitung', label: 'Zubereitung', icon: ChefHat },
  { key: 'bereit', label: 'Bereit', icon: Package },
  { key: 'unterwegs', label: 'Unterwegs', icon: Bike },
  { key: 'geliefert', label: 'Geliefert', icon: MapPin },
] as const;

const STATUS_ORDER: Record<string, number> = {
  bestaetigt: 0, zubereitung: 1, bereit: 2, abgeholt: 2, unterwegs: 3, geliefert: 4,
};

function getMockData(orderId: string | null): OrderStatus {
  return {
    order_id: orderId ?? 'demo',
    bestellnummer: 'FF-4201',
    status: 'unterwegs',
    eta_min: 8,
    eta_updated_at: new Date(Date.now() - 2 * 60000).toISOString(),
    fahrer_name: 'Lukas M.',
    prep_start: new Date(Date.now() - 18 * 60000).toISOString(),
    distance_km: 2.1,
    fortschritt_pct: 75,
  };
}

function EtaRing({ eta, fortschritt }: { eta: number | null; fortschritt: number }) {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const dash = (fortschritt / 100) * circ;
  const color = fortschritt >= 90 ? '#22c55e' : fortschritt >= 60 ? '#f59e0b' : '#3b82f6';

  return (
    <div className="relative flex items-center justify-center">
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#e5e7eb" strokeWidth="6" />
        <circle
          cx="48" cy="48" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 48 48)"
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute text-center">
        {eta !== null ? (
          <>
            <div className="text-2xl font-black text-gray-900 leading-none">~{eta}</div>
            <div className="text-xs text-gray-500 leading-none mt-0.5">Minuten</div>
          </>
        ) : (
          <div className="text-sm font-bold text-gray-600">—</div>
        )}
      </div>
    </div>
  );
}

export function Phase2720DynamischeEtaLiveTrackingCockpit({ orderId }: { orderId: string | null }) {
  const [order, setOrder] = useState<OrderStatus>(getMockData(orderId));
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  const load = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/delivery/order/live-status?order_id=${orderId}`);
      if (res.ok) {
        const d = await res.json();
        setOrder(d);
        setLastUpdate(Date.now());
      }
    } catch {
      // Mock-Fallback
    }
  }, [orderId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, [load]);

  const currentPhaseIdx = STATUS_ORDER[order.status] ?? 0;
  const statusColor = order.status === 'geliefert' ? 'text-emerald-600' :
    order.status === 'unterwegs' ? 'text-blue-600' :
    order.status === 'zubereitung' ? 'text-amber-600' : 'text-gray-600';

  const updateAgo = Math.round((Date.now() - lastUpdate) / 1000);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500 font-medium">Bestellung {order.bestellnummer}</div>
          <div className={`text-lg font-black ${statusColor}`}>
            {order.status === 'geliefert' ? '🎉 Geliefert!' :
             order.status === 'unterwegs' ? '🚴 Fahrer unterwegs' :
             order.status === 'bereit' ? '📦 Abholbereit' :
             order.status === 'zubereitung' ? '👨‍🍳 Wird zubereitet' : '✅ Bestätigt'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-gray-400">Zuletzt aktualisiert</div>
          <div className="text-xs text-gray-500 font-medium">vor {updateAgo}s</div>
        </div>
      </div>

      {/* ETA-Ring & Info */}
      <div className="flex items-center gap-5">
        <EtaRing eta={order.eta_min} fortschritt={order.fortschritt_pct} />
        <div className="flex-1 space-y-2">
          {order.fahrer_name && (
            <div className="flex items-center gap-2 text-sm">
              <Bike className="w-4 h-4 text-blue-500 shrink-0" />
              <span className="text-gray-700 font-medium">{order.fahrer_name}</span>
            </div>
          )}
          {order.distance_km !== null && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-gray-600">Noch {order.distance_km.toFixed(1)} km</span>
            </div>
          )}
          {order.eta_min !== null && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-gray-700 font-medium">ETA ~{order.eta_min} Minuten</span>
            </div>
          )}
        </div>
      </div>

      {/* Phasen-Timeline */}
      <div className="relative">
        <div className="absolute top-3.5 left-3.5 right-3.5 h-0.5 bg-gray-200" />
        <div
          className="absolute top-3.5 left-3.5 h-0.5 bg-blue-500 transition-all duration-700"
          style={{ width: `${currentPhaseIdx > 0 ? (currentPhaseIdx / (PHASES.length - 1)) * 100 : 0}%`, right: 'unset' }}
        />
        <div className="relative flex justify-between">
          {PHASES.map((phase, i) => {
            const Icon = phase.icon;
            const done = i < currentPhaseIdx;
            const current = i === currentPhaseIdx;
            return (
              <div key={phase.key} className="flex flex-col items-center gap-1.5">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all ${
                  done ? 'bg-blue-500 border-blue-500' :
                  current ? 'bg-white border-blue-500 shadow-sm shadow-blue-200' :
                  'bg-white border-gray-200'
                }`}>
                  <Icon className={`w-3.5 h-3.5 ${done ? 'text-white' : current ? 'text-blue-500' : 'text-gray-300'}`} />
                </div>
                <span className={`text-[10px] font-medium text-center leading-tight max-w-[52px] ${
                  current ? 'text-blue-600' : done ? 'text-gray-600' : 'text-gray-400'
                }`}>{phase.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fortschritts-Balken */}
      <div>
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>Lieferfortschritt</span>
          <span className="font-bold text-blue-600">{order.fortschritt_pct}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-700"
            style={{ width: `${order.fortschritt_pct}%` }}
          />
        </div>
      </div>

      {order.status === 'geliefert' && (
        <div className="flex items-center justify-center gap-2 py-3 bg-emerald-50 rounded-xl border border-emerald-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span className="text-sm font-bold text-emerald-700">Deine Bestellung wurde geliefert!</span>
        </div>
      )}

      <div className="text-[10px] text-gray-400 text-center">Live-ETA-Tracking · 20-Sek-Update · mise Smart Delivery</div>
    </div>
  );
}
