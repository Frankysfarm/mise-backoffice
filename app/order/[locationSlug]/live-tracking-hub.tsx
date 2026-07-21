'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { CheckCircle2, ChefHat, Clock, MapPin, Package, Star, Truck } from 'lucide-react';

type OrderStatus = 'neu' | 'bestätigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert';

interface TrackingData {
  id: string;
  status: OrderStatus;
  eta_earliest: string | null;
  eta_latest: string | null;
  driver_name: string | null;
  driver_lat: number | null;
  driver_lng: number | null;
  adresse: string | null;
  kunde_name: string | null;
}

const PHASES: Array<{ key: OrderStatus; label: string; icon: React.ReactNode }> = [
  { key: 'neu',            label: 'Bestellung eingegangen', icon: <Package className="h-4 w-4" /> },
  { key: 'in_zubereitung', label: 'Wird zubereitet',       icon: <ChefHat className="h-4 w-4" /> },
  { key: 'fertig',         label: 'Bereit zur Abholung',   icon: <CheckCircle2 className="h-4 w-4" /> },
  { key: 'unterwegs',      label: 'Fahrer ist unterwegs',  icon: <Truck className="h-4 w-4" /> },
  { key: 'geliefert',      label: 'Geliefert!',            icon: <Star className="h-4 w-4" /> },
];

const STATUS_PHASE_IDX: Record<string, number> = {
  neu: 0, bestätigt: 0, in_zubereitung: 1, fertig: 2, unterwegs: 3, geliefert: 4,
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function fmtCountdown(etaEarliest: string | null): string | null {
  if (!etaEarliest) return null;
  const diff = Math.round((new Date(etaEarliest).getTime() - Date.now()) / 1000);
  if (diff < 0) return 'Jeden Moment';
  if (diff < 60) return `${diff}s`;
  const m = Math.floor(diff / 60);
  const s = diff % 60;
  return `${m}:${s.toString().padStart(2, '0')} Min`;
}

export function LiveTrackingHub({ order: initialOrder, orderId }: { order: TrackingData; orderId: string }) {
  const [order, setOrder] = useState(initialOrder);
  const [tick, setTick] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const refresh = async () => {
      const { data } = await supabase
        .from('customer_orders')
        .select(`id, status, eta_earliest, eta_latest, adresse, kunde_name,
          batch:mise_delivery_batches(driver:mise_drivers(name, telefon, last_lat, last_lng))`)
        .eq('id', orderId)
        .maybeSingle();
      if (!data) return;
      const batch = Array.isArray(data.batch) ? data.batch[0] : data.batch;
      const driver = batch?.driver ? (Array.isArray(batch.driver) ? batch.driver[0] : batch.driver) : null;
      setOrder({
        id: data.id,
        status: data.status as OrderStatus,
        eta_earliest: data.eta_earliest ?? null,
        eta_latest: data.eta_latest ?? null,
        adresse: (data as any).adresse ?? null,
        kunde_name: (data as any).kunde_name ?? null,
        driver_name: driver?.name ?? null,
        driver_lat: driver?.last_lat ?? null,
        driver_lng: driver?.last_lng ?? null,
      });
    };
    const ch = supabase
      .channel(`tracking-${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'customer_orders', filter: `id=eq.${orderId}` }, refresh)
      .subscribe();
    const iv = setInterval(refresh, 20_000);
    refresh();
    return () => { clearInterval(iv); supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const phaseIdx = STATUS_PHASE_IDX[order.status] ?? 0;
  const countdown = fmtCountdown(order.eta_earliest);
  const isDelivered = order.status === 'geliefert';

  return (
    <div className="space-y-4">
      {/* ETA Banner */}
      {!isDelivered && (
        <div className={cn(
          'rounded-2xl p-4 text-center border',
          order.status === 'unterwegs'
            ? 'bg-matcha-600 border-matcha-700 text-white'
            : 'bg-stone-50 border-stone-200',
        )}>
          <div className={cn('text-xs font-semibold mb-1', order.status === 'unterwegs' ? 'text-matcha-100' : 'text-stone-500')}>
            {order.status === 'unterwegs' ? 'Fahrer ist unterwegs' : 'Voraussichtliche Lieferzeit'}
          </div>
          {countdown ? (
            <div className={cn('text-3xl font-black tabular-nums', order.status === 'unterwegs' ? 'text-white' : 'text-char')}>
              {countdown}
            </div>
          ) : (order.eta_earliest ? (
            <div className={cn('text-2xl font-black', order.status === 'unterwegs' ? 'text-white' : 'text-char')}>
              {fmtTime(order.eta_earliest)}
              {order.eta_latest && order.eta_latest !== order.eta_earliest && ` – ${fmtTime(order.eta_latest)}`}
            </div>
          ) : (
            <div className={cn('text-lg font-semibold', order.status === 'unterwegs' ? 'text-matcha-100' : 'text-stone-400')}>
              Wird berechnet…
            </div>
          ))}
          {order.driver_name && order.status === 'unterwegs' && (
            <div className="mt-1 text-xs text-matcha-100">Fahrer: {order.driver_name}</div>
          )}
        </div>
      )}

      {/* Delivered */}
      {isDelivered && (
        <div className="rounded-2xl bg-matcha-600 p-5 text-center">
          <CheckCircle2 className="h-10 w-10 text-white mx-auto mb-2" />
          <div className="text-xl font-black text-white">Geliefert!</div>
          <div className="text-xs text-matcha-100 mt-1">Guten Appetit{order.kunde_name ? `, ${order.kunde_name}` : ''}!</div>
        </div>
      )}

      {/* Fortschritts-Timeline */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <div className="text-xs font-bold text-stone-500 uppercase tracking-wide mb-4">Bestellstatus</div>
        <div className="relative">
          {/* Verbindungslinie */}
          <div className="absolute left-4 top-4 bottom-4 w-px bg-stone-200" />

          <div className="space-y-5">
            {PHASES.map((phase, i) => {
              const done = i <= phaseIdx;
              const active = i === phaseIdx;
              return (
                <div key={phase.key} className="flex items-start gap-3 relative">
                  <div className={cn(
                    'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all',
                    done
                      ? active
                        ? 'border-matcha-600 bg-matcha-600 text-white shadow-md shadow-matcha-200'
                        : 'border-matcha-500 bg-matcha-500 text-white'
                      : 'border-stone-200 bg-white text-stone-400',
                  )}>
                    {phase.icon}
                  </div>
                  <div className={cn('pt-1', done ? (active ? 'text-char' : 'text-stone-600') : 'text-stone-400')}>
                    <div className={cn('text-sm font-semibold', active && 'font-black')}>{phase.label}</div>
                    {active && order.eta_earliest && i < 4 && (
                      <div className="text-[11px] text-stone-500 mt-0.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Lieferung ca. {fmtTime(order.eta_earliest)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Adresse */}
      {order.adresse && (
        <div className="flex items-start gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5">
          <MapPin className="h-3.5 w-3.5 text-stone-400 mt-0.5 shrink-0" />
          <span className="text-xs text-stone-600">{order.adresse}</span>
        </div>
      )}
    </div>
  );
}
