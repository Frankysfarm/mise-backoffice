'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, ChefHat, Clock, Package, Truck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Props {
  orderId: string;
  initialEtaMin?: number | null;
  isDelivery?: boolean;
}

type OrderStatus =
  | 'neu'
  | 'bestätigt'
  | 'in_zubereitung'
  | 'fertig'
  | 'unterwegs'
  | 'geliefert'
  | string;

interface OrderData {
  status: OrderStatus;
  eta_earliest: string | null;
  eta_latest: string | null;
}

function getSecondsUntil(iso: string | null): number | null {
  if (!iso) return null;
  const diff = Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
  return diff;
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '0:00';
  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function BestellungEtaLiveBanner({ orderId, initialEtaMin, isDelivery = true }: Props) {
  const supabase = createClient();
  const [orderData, setOrderData] = useState<OrderData>({
    status: 'bestätigt',
    eta_earliest: null,
    eta_latest: null,
  });
  const [countdown, setCountdown] = useState<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Subscribe to realtime
  useEffect(() => {
    const channel = supabase
      .channel(`order-eta-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'customer_orders',
          filter: `id=eq.${orderId}`,
        },
        (payload: { new: Partial<OrderData> }) => {
          setOrderData((prev) => ({
            status: (payload.new.status as OrderStatus) ?? prev.status,
            eta_earliest: payload.new.eta_earliest ?? prev.eta_earliest,
            eta_latest: payload.new.eta_latest ?? prev.eta_latest,
          }));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, supabase]);

  // Tick countdown every second when unterwegs
  useEffect(() => {
    if (orderData.status === 'unterwegs' && orderData.eta_latest) {
      const tick = () => {
        const s = getSecondsUntil(orderData.eta_latest);
        setCountdown(s != null && s > 0 ? s : 0);
      };
      tick();
      tickRef.current = setInterval(tick, 1000);
    } else {
      setCountdown(null);
      if (tickRef.current) clearInterval(tickRef.current);
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [orderData.status, orderData.eta_latest]);

  const status = orderData.status;

  // Status: neu / bestätigt
  if (status === 'neu' || status === 'bestätigt') {
    return (
      <div className="w-full rounded-xl bg-stone-100 border border-stone-200 px-4 py-3 flex items-center gap-3">
        <Clock className="w-5 h-5 text-stone-400 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-stone-700">
            Bestätigt — Wird in Kürze zubereitet
          </p>
          {initialEtaMin && (
            <p className="text-xs text-stone-500 mt-0.5">
              Geschätzte Lieferzeit: {initialEtaMin} Min
            </p>
          )}
        </div>
      </div>
    );
  }

  // Status: in_zubereitung
  if (status === 'in_zubereitung') {
    return (
      <div className="w-full rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-3">
        <ChefHat
          className={cn('w-5 h-5 text-amber-500 flex-shrink-0', 'animate-bounce')}
        />
        <div>
          <p className="text-sm font-semibold text-amber-800">Wird zubereitet...</p>
          <p className="text-xs text-amber-600 mt-0.5">Deine Bestellung ist in der Küche</p>
        </div>
      </div>
    );
  }

  // Status: fertig
  if (status === 'fertig') {
    return (
      <div className="w-full rounded-xl bg-sky-50 border border-sky-200 px-4 py-3 flex items-center gap-3">
        <Package className="w-5 h-5 text-sky-500 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-sky-800">
            Fertig! Fahrer wird zugeteilt
          </p>
          <p className="text-xs text-sky-600 mt-0.5">Bestellung ist abholbereit</p>
        </div>
      </div>
    );
  }

  // Status: unterwegs
  if (status === 'unterwegs') {
    return (
      <div className="w-full rounded-xl bg-emerald-50 border border-emerald-300 px-4 py-3">
        <div className="flex items-center gap-3">
          <Truck className="w-5 h-5 text-emerald-600 flex-shrink-0 animate-pulse" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-800">Fahrer ist unterwegs</p>
            {countdown != null && (
              <p className="text-xs text-emerald-600 mt-0.5">
                Ankunft in ca.{' '}
                <span className="font-mono font-bold text-emerald-700">
                  {formatCountdown(countdown)}
                </span>{' '}
                Min
              </p>
            )}
          </div>
          {countdown != null && (
            <div className="text-right flex-shrink-0">
              <span className="text-2xl font-mono font-bold text-emerald-700 tabular-nums">
                {formatCountdown(countdown)}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Status: geliefert
  if (status === 'geliefert') {
    return (
      <div className="w-full rounded-xl bg-[#5c7a4e] px-4 py-3 flex items-center gap-3">
        <CheckCircle2 className="w-6 h-6 text-white flex-shrink-0" />
        <div>
          <p className="text-sm font-bold text-white">Geliefert!</p>
          <p className="text-xs text-white/70 mt-0.5">Guten Appetit!</p>
        </div>
      </div>
    );
  }

  // Fallback
  return null;
}
