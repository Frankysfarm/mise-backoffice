'use client';

/**
 * Phase 1015 — Live-Tracking Status Pro
 * Echtzeit-Status-Timeline + ETA-Countdown
 * + Fahrer-Annäherungs-Indikator (animierter Punkt)
 * + Fahrername + Live-Map-Link
 * Polling: 20 Sek. + 1-Sek-Tick
 */

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, Bike, MapPin, Package, ChefHat, Loader2 } from 'lucide-react';

type OrderStatus =
  | 'neu'
  | 'angenommen'
  | 'in_zubereitung'
  | 'fertig'
  | 'unterwegs'
  | 'abgeholt'
  | 'geliefert';

interface TrackingData {
  order_id: string;
  status: OrderStatus;
  eta_min: number | null;
  driver_name: string | null;
  driver_lat: number | null;
  driver_lng: number | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  estimated_arrival: string | null;
  created_at: string;
}

const STEPS: { status: OrderStatus; label: string; icon: React.ElementType }[] = [
  { status: 'angenommen', label: 'Bestätigt', icon: CheckCircle2 },
  { status: 'in_zubereitung', label: 'In Zubereitung', icon: ChefHat },
  { status: 'unterwegs', label: 'Unterwegs', icon: Bike },
  { status: 'geliefert', label: 'Geliefert', icon: MapPin },
];

const STATUS_ORDER: OrderStatus[] = ['neu', 'angenommen', 'in_zubereitung', 'fertig', 'unterwegs', 'abgeholt', 'geliefert'];

function statusIdx(s: OrderStatus): number {
  return STATUS_ORDER.indexOf(s);
}

function secsLeft(iso: string | null): number | null {
  if (!iso) return null;
  const s = Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
  return s;
}

function fmtMm(secs: number): string {
  if (secs <= 0) return 'gleich';
  const m = Math.ceil(secs / 60);
  return `${m} Min.`;
}

interface Props {
  orderId?: string | null;
}

export function StorefrontPhase1015LiveTrackingStatusPro({ orderId }: Props) {
  const [data, setData] = useState<TrackingData | null>(null);
  const [tick, setTick] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      if (!orderId) return;
      const { data: order } = await supabase
        .from('orders')
        .select('id,status,eta_earliest,driver_name,driver_lat,driver_lng,delivery_lat,delivery_lng,bestellt_am')
        .eq('id', orderId)
        .single();
      if (order) {
        setData({
          order_id: order.id,
          status: order.status as OrderStatus,
          eta_min: order.eta_earliest ? Math.ceil((new Date(order.eta_earliest).getTime() - Date.now()) / 60_000) : null,
          driver_name: order.driver_name ?? null,
          driver_lat: order.driver_lat ?? null,
          driver_lng: order.driver_lng ?? null,
          delivery_lat: order.delivery_lat ?? null,
          delivery_lng: order.delivery_lng ?? null,
          estimated_arrival: order.eta_earliest ?? null,
          created_at: order.bestellt_am ?? new Date().toISOString(),
        });
      }
    }
    load();
    const poll = setInterval(load, 20_000);
    const tickTimer = setInterval(() => setTick(t => t + 1), 1_000);
    return () => { clearInterval(poll); clearInterval(tickTimer); };
  }, [orderId]);

  if (!data && !orderId) return null;

  const currentStepIdx = data ? statusIdx(data.status) : 0;
  const secs = data ? secsLeft(data.estimated_arrival) : null;
  const isDelivering = data && ['unterwegs', 'abgeholt'].includes(data.status);
  const isDelivered = data?.status === 'geliefert';

  return (
    <div className="rounded-2xl border border-white/10 bg-black/60 backdrop-blur-sm p-5 space-y-4 w-full max-w-md mx-auto">
      {/* ETA Header */}
      <div className="text-center space-y-1">
        {isDelivered ? (
          <>
            <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto" />
            <div className="text-lg font-bold text-green-400">Zugestellt!</div>
            <div className="text-xs text-white/50">Ihre Bestellung wurde geliefert.</div>
          </>
        ) : (
          <>
            <div className="text-xs text-white/50 uppercase tracking-wide">Lieferung in</div>
            {secs !== null && secs > 0 ? (
              <div className="text-3xl font-bold text-white">{fmtMm(Math.max(0, secs - tick))}</div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-white">
                <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                <span className="text-lg font-semibold">Wird vorbereitet</span>
              </div>
            )}
            {data?.driver_name && isDelivering && (
              <div className="text-xs text-white/60 flex items-center justify-center gap-1">
                <Bike className="h-3.5 w-3.5 text-blue-400" />
                <span className="font-medium text-blue-300">{data.driver_name}</span> ist unterwegs
              </div>
            )}
          </>
        )}
      </div>

      {/* Animierter Fahrer-Punkt (bei unterwegs) */}
      {isDelivering && (
        <div className="flex items-center justify-center">
          <div className="relative flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <div className="flex gap-1">
              {[0, 0.2, 0.4].map((delay, i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-blue-400/60 animate-bounce"
                  style={{ animationDelay: `${delay}s` }}
                />
              ))}
            </div>
            <MapPin className="h-4 w-4 text-red-400" />
          </div>
        </div>
      )}

      {/* Status-Timeline */}
      <div className="space-y-0">
        {STEPS.map((step, i) => {
          const stepIdx = statusIdx(step.status);
          const done = currentStepIdx >= stepIdx;
          const active = done && (i === STEPS.length - 1 || currentStepIdx < statusIdx(STEPS[i + 1].status));
          const Icon = step.icon;

          return (
            <div key={step.status} className="flex items-start gap-3">
              {/* Icon + Linie */}
              <div className="flex flex-col items-center">
                <div className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all shrink-0',
                  done
                    ? active
                      ? 'bg-blue-500 border-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.5)]'
                      : 'bg-green-500/20 border-green-500'
                    : 'bg-white/5 border-white/15'
                )}>
                  <Icon className={cn('h-3.5 w-3.5', done ? (active ? 'text-white' : 'text-green-400') : 'text-white/30')} />
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn('w-0.5 h-6 mt-0.5', done ? 'bg-green-500/40' : 'bg-white/10')} />
                )}
              </div>

              {/* Label */}
              <div className="pt-1 pb-4">
                <div className={cn('text-sm font-medium', done ? (active ? 'text-white' : 'text-green-400') : 'text-white/30')}>
                  {step.label}
                </div>
                {active && !isDelivered && step.status === 'unterwegs' && data?.eta_min !== null && (
                  <div className="text-xs text-blue-400 mt-0.5 flex items-center gap-1">
                    <Clock className="h-3 w-3" />noch ~{data.eta_min} Min.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Polling-Indikator */}
      <div className="text-center text-xs text-white/20">Live-Update alle 20 Sek.</div>
    </div>
  );
}
