'use client';

import { useEffect, useState, useCallback } from 'react';
import { Bike, ChefHat, CheckCircle2, Clock, MapPin, Package, Zap, Navigation } from 'lucide-react';

type OrderStatus = 'neu' | 'bestätigt' | 'in_zubereitung' | 'fertig' | 'abgeholt' | 'unterwegs' | 'geliefert' | 'cancelled';

interface Props {
  orderId?: string | null;
  locationId?: string | null;
  initialStatus?: OrderStatus;
  initialEtaMin?: number | null;
  bestellnummer?: string | null;
}

interface TrackData {
  status: OrderStatus;
  etaMin: number | null;
  driverName: string | null;
  driverDistanceKm: number | null;
  prepMin: number | null;
}

const PHASEN: { status: OrderStatus[]; label: string; icon: React.ElementType }[] = [
  { status: ['neu', 'bestätigt'],                    label: 'Bestätigt',    icon: Package },
  { status: ['in_zubereitung'],                       label: 'Zubereitung',  icon: ChefHat },
  { status: ['fertig', 'abgeholt'],                   label: 'Abgeholt',     icon: Bike },
  { status: ['unterwegs'],                            label: 'Unterwegs',    icon: Navigation },
  { status: ['geliefert'],                            label: 'Geliefert',    icon: CheckCircle2 },
];

const ORDER_INDEX: Record<OrderStatus, number> = {
  neu: 0, bestätigt: 0, in_zubereitung: 1, fertig: 2, abgeholt: 2, unterwegs: 3, geliefert: 4, cancelled: -1,
};

const MOCK: TrackData = {
  status: 'unterwegs',
  etaMin: 7,
  driverName: 'Alex M.',
  driverDistanceKm: 1.2,
  prepMin: 14,
};

export function Phase1000DynamischeEtaLiveTracker({
  orderId, locationId, initialStatus, initialEtaMin, bestellnummer,
}: Props) {
  const [data, setData] = useState<TrackData>({
    status: initialStatus ?? 'bestätigt',
    etaMin: initialEtaMin ?? null,
    driverName: null,
    driverDistanceKm: null,
    prepMin: null,
  });
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!orderId && !locationId) { setData(MOCK); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (orderId)    params.set('order_id', orderId);
      if (locationId) params.set('location_id', locationId);
      const r = await fetch(`/api/delivery/tracking/order-status?${params}`);
      if (r.ok) setData(await r.json());
    } catch { setData(MOCK); }
    finally { setLoading(false); }
  }, [orderId, locationId]);

  useEffect(() => { load(); const t = setInterval(load, 15_000); return () => clearInterval(t); }, [load]);
  useEffect(() => { const t = setInterval(() => setTick(n => n + 1), 60_000); return () => clearInterval(t); }, []);

  const phase = ORDER_INDEX[data.status] ?? 0;
  const etaAnzeige = data.etaMin !== null ? Math.max(0, data.etaMin - Math.floor(tick)) : null;
  const isGeliefert = data.status === 'geliefert';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden max-w-sm mx-auto">
      {/* ETA Hero */}
      <div className={`px-4 py-4 text-center ${isGeliefert ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
        {isGeliefert ? (
          <div className="space-y-1">
            <CheckCircle2 className="w-10 h-10 text-white mx-auto" />
            <p className="text-lg font-black text-white">Bestellung geliefert!</p>
            {bestellnummer && <p className="text-sm text-indigo-200">{bestellnummer}</p>}
          </div>
        ) : (
          <div className="space-y-1">
            {etaAnzeige !== null ? (
              <>
                <p className="text-sm font-medium text-indigo-200">Ankunft in ca.</p>
                <p className="text-5xl font-black text-white leading-none">{etaAnzeige}<span className="text-2xl font-semibold text-indigo-200"> Min</span></p>
              </>
            ) : (
              <p className="text-lg font-bold text-white">Bestellung wird vorbereitet…</p>
            )}
            {bestellnummer && <p className="text-xs text-indigo-300 mt-1">{bestellnummer}</p>}
          </div>
        )}
      </div>

      {/* Phasen-Timeline */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between relative">
          {/* Verbindungslinie */}
          <div className="absolute inset-x-0 top-4 h-0.5 bg-gray-100 mx-6" />
          <div
            className="absolute top-4 h-0.5 bg-indigo-500 mx-6 transition-all duration-700"
            style={{ width: `calc(${(phase / (PHASEN.length - 1)) * 100}% - 1.5rem)` }}
          />
          {PHASEN.map((p, i) => {
            const done = i < phase;
            const active = i === phase;
            const Icon = p.icon;
            return (
              <div key={p.label} className="flex flex-col items-center gap-1 relative z-10">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                  done   ? 'bg-indigo-600 border-indigo-600' :
                  active ? 'bg-white border-indigo-600 shadow-lg shadow-indigo-100' :
                           'bg-white border-gray-200'
                }`}>
                  <Icon className={`w-3.5 h-3.5 ${done ? 'text-white' : active ? 'text-indigo-600' : 'text-gray-300'}`} />
                </div>
                <span className={`text-[9px] font-medium leading-none text-center ${
                  active ? 'text-indigo-700' : done ? 'text-gray-500' : 'text-gray-300'
                }`}>{p.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fahrer-Info (wenn unterwegs) */}
      {(data.status === 'unterwegs' || data.status === 'abgeholt') && data.driverName && (
        <div className="mx-3 mb-3 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center shrink-0">
            <Bike className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-800">{data.driverName}</p>
            {data.driverDistanceKm !== null && (
              <p className="text-[10px] text-gray-500 flex items-center gap-1">
                <MapPin className="w-2.5 h-2.5" />{data.driverDistanceKm.toFixed(1)} km entfernt
              </p>
            )}
          </div>
          {loading && <span className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0" />}
        </div>
      )}

      {/* Vorbereitungszeit-Info */}
      {data.status === 'in_zubereitung' && data.prepMin && (
        <div className="mx-3 mb-3 px-3 py-2 bg-amber-50 border border-amber-100 rounded-xl flex items-center gap-2">
          <ChefHat className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-800">Küche benötigt noch ca. <strong>{data.prepMin} Min.</strong></p>
        </div>
      )}

      <div className="px-4 pb-3 flex items-center justify-between text-[10px] text-gray-400">
        <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Live-Updates alle 15 Sek.</span>
        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Dynamische ETA</span>
      </div>
    </div>
  );
}
