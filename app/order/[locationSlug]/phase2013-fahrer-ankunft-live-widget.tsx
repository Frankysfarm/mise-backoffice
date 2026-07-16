'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, Clock, MapPin } from 'lucide-react';

interface Props {
  orderId: string;
  locationSlug: string;
  className?: string;
}

type OrderPhase = 'waiting' | 'preparing' | 'ready' | 'on_route' | 'delivered';

interface StatusData {
  phase: OrderPhase;
  eta_min: number;
  driver_name: string | null;
}

const MOCK: StatusData = {
  phase: 'on_route',
  eta_min: 5,
  driver_name: 'Lisa K.',
};

export function StorefrontPhase2013FahrerAnkunftLiveWidget({
  orderId,
  locationSlug,
  className,
}: Props) {
  const [data, setData] = useState<StatusData>(MOCK);
  const [loading, setLoading] = useState(true);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (!orderId) { setLoading(false); return; }
    const load = () => {
      fetch(`/api/storefront/${encodeURIComponent(locationSlug)}/order-status?order_id=${encodeURIComponent(orderId)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d) {
            setData(d as StatusData);
            setElapsedSec(0);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    };
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [orderId, locationSlug]);

  // Tick elapsed seconds for the draining bar
  useEffect(() => {
    if (data.phase !== 'on_route') return;
    const iv = setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1_000);
    return () => clearInterval(iv);
  }, [data.phase]);

  if (!orderId) return null;
  if (loading) return null;
  if (data.phase !== 'on_route') return null;

  const totalSec = data.eta_min * 60;
  const remaining = Math.max(0, totalSec - elapsedSec);
  const progressPct = totalSec > 0 ? Math.round((remaining / totalSec) * 100) : 0;
  const remainingMin = Math.ceil(remaining / 60);

  return (
    <div className={cn(
      'rounded-2xl overflow-hidden border border-matcha-300',
      'bg-gradient-to-br from-matcha-50 to-emerald-50',
      className,
    )}>
      {/* Pulsing green top highlight */}
      <div className="h-1 w-full bg-matcha-400 animate-pulse" />

      <div className="px-5 py-4">
        {/* Animated Bike icon + driver name */}
        <div className="flex items-center gap-3 mb-3">
          <div className="h-12 w-12 rounded-2xl bg-matcha-500 flex items-center justify-center shadow-md shadow-matcha-200 animate-bounce">
            <Bike className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-lg font-black text-matcha-900 leading-tight">
              {data.driver_name
                ? `${data.driver_name} ist in ~${remainingMin} Min bei dir!`
                : `Dein Fahrer ist in ~${remainingMin} Min bei dir!`}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3 text-matcha-400 shrink-0" />
              <span className="text-xs text-matcha-600 font-medium">Unterwegs zu deiner Adresse</span>
            </div>
          </div>
        </div>

        {/* ETA drain bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-matcha-500" />
              <span className="text-[11px] font-semibold text-matcha-600">Ankunft in</span>
            </div>
            <span className="text-[11px] font-bold text-matcha-700 tabular-nums">
              {remainingMin} Min
            </span>
          </div>
          <div className="h-3 bg-matcha-100 rounded-full overflow-hidden border border-matcha-200">
            <div
              className="h-full bg-matcha-400 rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Tip text */}
        <div className="flex items-start gap-2 bg-white/60 border border-matcha-100 rounded-xl px-3 py-2">
          <span className="text-base leading-none mt-0.5">📦</span>
          <p className="text-xs text-matcha-700 font-medium leading-snug">
            Bitte halte dich bereit — deine Bestellung kommt gleich!
          </p>
        </div>
      </div>

      {/* Live pulse footer */}
      <div className="flex items-center gap-1.5 px-5 pb-3">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 bg-matcha-500" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-matcha-500" />
        </span>
        <span className="text-[10px] text-matcha-500 font-medium">Live · aktualisiert alle 15s</span>
      </div>
    </div>
  );
}
