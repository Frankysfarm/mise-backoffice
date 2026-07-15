'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, CheckCircle2, Package, Truck, ChefHat, MapPin } from 'lucide-react';

interface Props {
  orderId: string;
  locationSlug: string;
  isOnline?: boolean;
}

type OrderPhase = 'waiting' | 'preparing' | 'ready' | 'on_route' | 'delivered' | 'unknown';

interface EtaData {
  phase: OrderPhase;
  eta_min: number | null;
  elapsed_min: number | null;
  driver_name: string | null;
  driver_lat: number | null;
  driver_lng: number | null;
  prep_min: number | null;
  bestellnummer: string | null;
}

const PHASE_META: Record<OrderPhase, {
  icon: React.ReactNode; label: string; color: string; bg: string; border: string; step: number;
}> = {
  waiting:   { icon: <Package className="h-4 w-4" />,    label: 'Bestellung eingegangen', color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200',    step: 0 },
  preparing: { icon: <ChefHat className="h-4 w-4" />,    label: 'Wird zubereitet',        color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',   step: 1 },
  ready:     { icon: <CheckCircle2 className="h-4 w-4" />, label: 'Fertig · Abholung',    color: 'text-matcha-700',  bg: 'bg-matcha-50',  border: 'border-matcha-200',  step: 2 },
  on_route:  { icon: <Truck className="h-4 w-4" />,       label: 'Unterwegs zu dir',      color: 'text-matcha-700',  bg: 'bg-matcha-50',  border: 'border-matcha-200',  step: 3 },
  delivered: { icon: <CheckCircle2 className="h-4 w-4" />, label: 'Geliefert!',           color: 'text-matcha-700',  bg: 'bg-matcha-50',  border: 'border-matcha-200',  step: 4 },
  unknown:   { icon: <Clock className="h-4 w-4" />,        label: 'Bestellung verfolgen', color: 'text-stone-600',   bg: 'bg-stone-50',   border: 'border-stone-200',   step: 0 },
};

const STEPS: { phase: OrderPhase; label: string }[] = [
  { phase: 'waiting',   label: 'Eingegangen' },
  { phase: 'preparing', label: 'Zubereitung' },
  { phase: 'on_route',  label: 'Unterwegs'   },
  { phase: 'delivered', label: 'Geliefert'   },
];

const MOCK: EtaData = {
  phase: 'preparing',
  eta_min: 22,
  elapsed_min: 5,
  driver_name: null,
  driver_lat: null,
  driver_lng: null,
  prep_min: 15,
  bestellnummer: null,
};

export function StorefrontPhase998DynamischeEtaLiveTrackingUltra({ orderId, locationSlug }: Props) {
  const [data, setData] = useState<EtaData>(MOCK);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) { setLoading(false); return; }
    const load = () => {
      fetch(`/api/delivery/storefront/order-status?order_id=${encodeURIComponent(orderId)}&location_slug=${encodeURIComponent(locationSlug)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d) setData(d as EtaData);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [orderId, locationSlug]);

  useEffect(() => {
    if (data.eta_min === null) { setCountdown(null); return; }
    const targetSec = data.eta_min * 60;
    const elapsedSec = (data.elapsed_min ?? 0) * 60;
    let remain = targetSec - elapsedSec;
    setCountdown(remain);
    const iv = setInterval(() => {
      setCountdown((c) => (c !== null ? Math.max(0, c - 1) : null));
    }, 1_000);
    return () => clearInterval(iv);
  }, [data.eta_min, data.elapsed_min]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5 animate-pulse">
        <div className="h-5 w-40 bg-stone-100 rounded mb-3" />
        <div className="h-12 bg-stone-100 rounded-xl" />
      </div>
    );
  }

  const meta = PHASE_META[data.phase];
  const currentStep = meta.step;
  const fmtCountdown = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className={cn('rounded-2xl border overflow-hidden', meta.border, meta.bg)}>
      {/* Header */}
      <div className={cn('flex items-center gap-3 px-5 py-4 border-b', meta.border)}>
        <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center', meta.bg, meta.color)}>
          {meta.icon}
        </div>
        <div className="flex-1">
          <div className={cn('text-sm font-bold', meta.color)}>{meta.label}</div>
          {data.bestellnummer && (
            <div className="text-xs text-stone-400">Bestellung #{data.bestellnummer}</div>
          )}
        </div>
        {countdown !== null && countdown > 0 && (
          <div className={cn('text-right', meta.color)}>
            <div className="font-mono text-xl font-black tabular-nums">{fmtCountdown(countdown)}</div>
            <div className="text-[10px] font-semibold opacity-60">verbleibend</div>
          </div>
        )}
        {data.phase === 'delivered' && (
          <div className="text-2xl">🎉</div>
        )}
      </div>

      {/* Step tracker */}
      <div className="px-5 py-4">
        <div className="flex items-center">
          {STEPS.map((step, i) => {
            const done = currentStep > i;
            const active = currentStep === i + (data.phase === 'on_route' ? 2 : 1) ||
              (step.phase === data.phase) ||
              (step.phase === 'on_route' && data.phase === 'ready');
            const isActive = PHASE_META[step.phase].step === currentStep;
            return (
              <div key={step.phase} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <div className={cn(
                    'h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all',
                    done || currentStep >= PHASE_META[step.phase].step
                      ? 'bg-matcha-500 border-matcha-500'
                      : isActive
                        ? 'bg-white border-matcha-400'
                        : 'bg-white border-stone-200',
                  )}>
                    {(done || currentStep > PHASE_META[step.phase].step) && (
                      <div className="h-2 w-2 rounded-full bg-white" />
                    )}
                    {isActive && (
                      <div className="h-2 w-2 rounded-full bg-matcha-400 animate-pulse" />
                    )}
                  </div>
                  <span className={cn(
                    'text-[9px] font-semibold text-center w-14 leading-tight',
                    (done || isActive || currentStep >= PHASE_META[step.phase].step)
                      ? 'text-matcha-700'
                      : 'text-stone-400',
                  )}>
                    {step.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn(
                    'flex-1 h-0.5 mx-1 mb-4 rounded-full transition-all',
                    currentStep > PHASE_META[step.phase].step ? 'bg-matcha-400' : 'bg-stone-200',
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Driver info */}
      {data.driver_name && data.phase === 'on_route' && (
        <div className={cn('mx-5 mb-4 rounded-xl p-3 flex items-center gap-3 border', meta.border)}>
          <Truck className={cn('h-5 w-5 shrink-0', meta.color)} />
          <div>
            <div className="text-xs font-bold text-foreground">{data.driver_name} ist unterwegs</div>
            {data.eta_min && (
              <div className="text-[11px] text-stone-500">
                Voraussichtliche Ankunft in {data.eta_min} Min
              </div>
            )}
          </div>
          {data.driver_lat && data.driver_lng && (
            <a
              href={`https://maps.google.com/?q=${data.driver_lat},${data.driver_lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn('ml-auto flex items-center gap-1 text-[11px] font-bold rounded-lg px-2 py-1 border', meta.border, meta.color)}
            >
              <MapPin className="h-3 w-3" />
              Position
            </a>
          )}
        </div>
      )}

      {/* Live pulse indicator */}
      <div className="flex items-center gap-1.5 px-5 pb-3">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 bg-matcha-500" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-matcha-500" />
        </span>
        <span className="text-[10px] text-stone-400">Live-Tracking aktiv · aktualisiert alle 30s</span>
      </div>
    </div>
  );
}
