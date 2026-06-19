'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Clock, ChefHat, Package, Truck, CheckCircle2, MapPin, Zap, Navigation2 } from 'lucide-react';

const STEPS = [
  { key: 'bestätigt',     label: 'Angenommen',   icon: CheckCircle2 },
  { key: 'in_zubereitung', label: 'Zubereitung',  icon: ChefHat },
  { key: 'fertig',        label: 'Fertig',        icon: Package },
  { key: 'unterwegs',    label: 'Unterwegs',     icon: Truck },
  { key: 'geliefert',    label: 'Geliefert! 🎉', icon: CheckCircle2 },
] as const;

type StepKey = typeof STEPS[number]['key'];

const STATUS_MAP: Record<string, StepKey> = {
  neu: 'bestätigt',
  bestätigt: 'bestätigt',
  angenommen: 'bestätigt',
  in_zubereitung: 'in_zubereitung',
  preparing: 'in_zubereitung',
  fertig: 'fertig',
  ready: 'fertig',
  unterwegs: 'unterwegs',
  out_for_delivery: 'unterwegs',
  picked_up: 'unterwegs',
  geliefert: 'geliefert',
  delivered: 'geliefert',
  completed: 'geliefert',
};

function stepIndex(status: string | null): number {
  const key = status ? STATUS_MAP[status] : null;
  if (!key) return 0;
  return STEPS.findIndex(s => s.key === key);
}

function formatEta(isoEarliest: string | null, isoLatest: string | null): string {
  if (!isoEarliest) return '–';
  const earliest = new Date(isoEarliest);
  const latest = isoLatest ? new Date(isoLatest) : null;
  const now = new Date();
  const minEarly = Math.max(0, Math.round((earliest.getTime() - now.getTime()) / 60_000));
  const minLate = latest ? Math.max(0, Math.round((latest.getTime() - now.getTime()) / 60_000)) : null;

  if (minEarly <= 0 && (!minLate || minLate <= 0)) return 'Jeden Moment!';
  if (minLate != null && minLate !== minEarly) return `${minEarly}–${minLate} Min`;
  return `${minEarly} Min`;
}

function ConfidenceBand({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const cls = pct >= 85 ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
    : pct >= 70 ? 'text-amber-600 bg-amber-50 border-amber-200'
    : 'text-gray-500 bg-gray-50 border-gray-200';
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold border rounded-full px-2 py-0.5', cls)}>
      <Zap className="h-2.5 w-2.5" />
      {pct}% sicher
    </span>
  );
}

interface Props {
  orderId: string;
  orderNumber: string;
  initialStatus?: string | null;
  initialEtaEarliest?: string | null;
  initialEtaLatest?: string | null;
  customerName?: string;
}

export function EtaConfidenceCard({
  orderId,
  orderNumber,
  initialStatus,
  initialEtaEarliest,
  initialEtaLatest,
  customerName,
}: Props) {
  const [status, setStatus] = useState<string | null>(initialStatus ?? null);
  const [etaEarliest, setEtaEarliest] = useState<string | null>(initialEtaEarliest ?? null);
  const [etaLatest, setEtaLatest] = useState<string | null>(initialEtaLatest ?? null);
  const [driverLat, setDriverLat] = useState<number | null>(null);
  const [driverLng, setDriverLng] = useState<number | null>(null);
  const [confidence, setConfidence] = useState(0.85);
  const [tick, setTick] = useState(0);
  const [pulse, setPulse] = useState(false);
  const prevStatus = useRef<string | null>(initialStatus ?? null);

  // Tick every 30s to refresh countdown
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(iv);
  }, []);

  // Supabase realtime subscription
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`eta-card-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'customer_orders', filter: `id=eq.${orderId}` },
        (payload: { new: Record<string, unknown> }) => {
          const row = payload.new as Record<string, unknown>;
          if (row.status && row.status !== prevStatus.current) {
            prevStatus.current = row.status as string;
            setStatus(row.status as string);
            setPulse(true);
            setTimeout(() => setPulse(false), 2000);
          }
          if (row.eta_earliest) setEtaEarliest(row.eta_earliest as string);
          if (row.eta_latest) setEtaLatest(row.eta_latest as string);
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'driver_status' },
        (payload: { new: Record<string, unknown> }) => {
          const row = payload.new as Record<string, unknown>;
          if (row.last_lat) setDriverLat(row.last_lat as number);
          if (row.last_lng) setDriverLng(row.last_lng as number);
        },
      )
      .subscribe();

    // Poll fallback every 60s
    const pollIv = setInterval(async () => {
      try {
        const res = await fetch(`/api/delivery/orders/${orderId}/tracking`);
        if (res.ok) {
          const d = await res.json();
          if (d.status) setStatus(d.status);
          if (d.eta_earliest) setEtaEarliest(d.eta_earliest);
          if (d.eta_latest) setEtaLatest(d.eta_latest);
          if (d.confidence) setConfidence(d.confidence);
          if (d.driver_lat) setDriverLat(d.driver_lat);
          if (d.driver_lng) setDriverLng(d.driver_lng);
        }
      } catch {}
    }, 60_000);

    return () => {
      supabase.removeChannel(ch);
      clearInterval(pollIv);
    };
  }, [orderId]);

  const currStep = stepIndex(status);
  const isDelivered = status === 'geliefert' || status === 'delivered' || status === 'completed';
  const isEnRoute = status === 'unterwegs' || status === 'out_for_delivery' || status === 'picked_up';
  const etaText = formatEta(etaEarliest, etaLatest);

  return (
    <div className={cn(
      'rounded-2xl border overflow-hidden transition-all duration-500',
      isDelivered ? 'border-emerald-200 bg-emerald-50'
        : pulse ? 'border-matcha-400 bg-matcha-50 shadow-[0_0_20px_rgba(74,200,138,0.15)]'
        : 'border-gray-200 bg-white shadow-sm',
    )}>
      {/* ETA Hero */}
      {!isDelivered && (
        <div className="px-4 pt-4 pb-3 text-center">
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">
            Voraussichtliche Lieferzeit
          </div>
          <div className={cn(
            'text-4xl font-black tabular-nums transition-all',
            isEnRoute ? 'text-matcha-600' : 'text-gray-800',
          )}>
            {etaText}
          </div>
          <div className="mt-2 flex items-center justify-center gap-2">
            <ConfidenceBand confidence={confidence} />
            {isEnRoute && driverLat && driverLng && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
                <Navigation2 className="h-2.5 w-2.5" />
                Fahrer in der Nähe
              </span>
            )}
          </div>
        </div>
      )}

      {/* Delivered State */}
      {isDelivered && (
        <div className="px-4 pt-4 pb-3 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
          <div className="text-lg font-black text-emerald-700">Geliefert!</div>
          {customerName && (
            <div className="text-sm text-emerald-600 mt-0.5">Guten Appetit, {customerName.split(' ')[0]}!</div>
          )}
        </div>
      )}

      {/* Progress Steps */}
      <div className="px-4 pb-4">
        <div className="relative">
          {/* Connector line */}
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-100" />
          <div
            className="absolute top-4 left-4 h-0.5 bg-matcha-400 transition-all duration-700"
            style={{ width: currStep > 0 ? `calc(${(currStep / (STEPS.length - 1)) * 100}% - 0px)` : '0%' }}
          />

          {/* Steps */}
          <div className="relative flex justify-between">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              const isDone = i <= currStep;
              const isCurrent = i === currStep;
              return (
                <div key={step.key} className="flex flex-col items-center gap-1">
                  <div className={cn(
                    'h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 z-10',
                    isDone
                      ? isCurrent
                        ? 'border-matcha-500 bg-matcha-500 shadow-[0_0_12px_rgba(74,200,138,0.4)]'
                        : 'border-matcha-400 bg-matcha-400'
                      : 'border-gray-200 bg-white',
                  )}>
                    <Icon className={cn('h-4 w-4', isDone ? 'text-white' : 'text-gray-300')} />
                  </div>
                  <span className={cn(
                    'text-[9px] font-bold text-center leading-tight max-w-[50px]',
                    isCurrent ? 'text-matcha-600' : isDone ? 'text-matcha-400' : 'text-gray-400',
                  )}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Order info footer */}
      <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
        <span className="text-[10px] text-gray-400 font-mono">#{orderNumber}</span>
        {isEnRoute && (
          <span className="flex items-center gap-1 text-[10px] text-matcha-600 font-bold animate-pulse">
            <span className="h-1.5 w-1.5 rounded-full bg-matcha-500 inline-block" />
            Live
          </span>
        )}
      </div>
    </div>
  );
}
