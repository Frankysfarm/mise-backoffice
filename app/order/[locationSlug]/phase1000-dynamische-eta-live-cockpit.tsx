'use client';

import { useEffect, useState } from 'react';
import { Clock, MapPin, Bike, CheckCircle2, ChevronRight, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type EtaStatus = 'preparing' | 'ready' | 'delivering' | 'arriving' | 'delivered';

type LiveEtaData = {
  status: EtaStatus;
  etaMin: number | null;
  etaUpdatedAt: string | null;
  driverName?: string | null;
  driverDistanceM?: number | null;
  prepStartedAt?: string | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
};

const STATUS_INFO: Record<EtaStatus, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  preparing: {
    label: 'Wird zubereitet',
    icon: <span className="text-base">🍳</span>,
    color: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-200',
  },
  ready: {
    label: 'Wartet auf Fahrer',
    icon: <CheckCircle2 className="h-5 w-5" />,
    color: 'text-matcha-700',
    bg: 'bg-matcha-50 border-matcha-200',
  },
  delivering: {
    label: 'Unterwegs',
    icon: <Bike className="h-5 w-5" />,
    color: 'text-matcha-700',
    bg: 'bg-matcha-50 border-matcha-200',
  },
  arriving: {
    label: 'Kommt gleich',
    icon: <MapPin className="h-5 w-5" />,
    color: 'text-matcha-700',
    bg: 'bg-matcha-50 border-matcha-200',
  },
  delivered: {
    label: 'Geliefert',
    icon: <CheckCircle2 className="h-5 w-5" />,
    color: 'text-matcha-700',
    bg: 'bg-matcha-50 border-matcha-200',
  },
};

const STEPS: { key: EtaStatus; label: string }[] = [
  { key: 'preparing', label: 'Zubereitung' },
  { key: 'ready', label: 'Fertig' },
  { key: 'delivering', label: 'Unterwegs' },
  { key: 'delivered', label: 'Angekommen' },
];

const STEP_ORDER: EtaStatus[] = ['preparing', 'ready', 'delivering', 'arriving', 'delivered'];

function getStepIndex(status: EtaStatus) {
  const idx = STEP_ORDER.indexOf(status);
  return idx === -1 ? 0 : idx;
}

function useCountdown(etaMin: number | null, updatedAt: string | null) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (etaMin == null || !updatedAt) { setRemaining(null); return; }
    function tick() {
      const elapsed = (Date.now() - new Date(updatedAt!).getTime()) / 60_000;
      setRemaining(Math.max(0, etaMin! - elapsed));
    }
    tick();
    const iv = setInterval(tick, 5_000);
    return () => clearInterval(iv);
  }, [etaMin, updatedAt]);

  return remaining;
}

export function Phase1000DynamischeEtaLiveCockpit({
  orderId,
  initialData,
}: {
  orderId: string;
  initialData?: Partial<LiveEtaData>;
}) {
  const [data, setData] = useState<LiveEtaData>({
    status: initialData?.status ?? 'preparing',
    etaMin: initialData?.etaMin ?? null,
    etaUpdatedAt: initialData?.etaUpdatedAt ?? null,
    driverName: initialData?.driverName ?? null,
    driverDistanceM: initialData?.driverDistanceM ?? null,
    prepStartedAt: initialData?.prepStartedAt ?? null,
    pickedUpAt: initialData?.pickedUpAt ?? null,
    deliveredAt: initialData?.deliveredAt ?? null,
  });

  const countdown = useCountdown(data.etaMin, data.etaUpdatedAt);
  const info = STATUS_INFO[data.status];
  const stepIdx = getStepIndex(data.status);

  useEffect(() => {
    if (!orderId) return;
    function load() {
      fetch(`/api/delivery/customer/order-eta?order_id=${encodeURIComponent(orderId)}`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          if (d) setData((prev) => ({ ...prev, ...d }));
        })
        .catch(() => {});
    }
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  }, [orderId]);

  const etaDisplay = countdown != null
    ? countdown < 1
      ? 'Gleich da!'
      : `${Math.round(countdown)} Min`
    : data.etaMin != null
    ? `${data.etaMin} Min`
    : '—';

  return (
    <div className={cn('rounded-2xl border-2 p-4 space-y-4', info.bg)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className={cn('flex items-center gap-2', info.color)}>
          {info.icon}
          <span className="font-bold text-base">{info.label}</span>
        </div>
        {data.status !== 'delivered' && (
          <div className="text-right">
            <div className={cn('text-2xl font-black tabular-nums', info.color)}>
              {etaDisplay}
            </div>
            <div className="text-[10px] text-muted-foreground">Ankunft</div>
          </div>
        )}
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-0">
        {STEPS.map((step, i) => {
          const done = i < stepIdx;
          const active = i === stepIdx || (step.key === 'delivering' && data.status === 'arriving');
          return (
            <div key={step.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className={cn(
                  'h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-colors',
                  done ? 'bg-matcha-500 border-matcha-500 text-white' :
                  active ? 'bg-matcha-600 border-matcha-600 text-white animate-pulse' :
                  'bg-white border-muted text-muted-foreground'
                )}>
                  {done ? '✓' : i + 1}
                </div>
                <span className={cn('text-[9px] mt-1 font-medium', active ? 'text-matcha-700 font-bold' : 'text-muted-foreground')}>
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn('h-0.5 flex-1 -mt-4 transition-colors', done ? 'bg-matcha-500' : 'bg-muted')} />
              )}
            </div>
          );
        })}
      </div>

      {/* Driver info */}
      {(data.status === 'delivering' || data.status === 'arriving') && (
        <div className="rounded-xl bg-white/70 border border-matcha-100 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bike className="h-4 w-4 text-matcha-600" />
            <div>
              <div className="text-xs font-bold">{data.driverName ?? 'Dein Fahrer'}</div>
              {data.driverDistanceM != null && (
                <div className="text-[10px] text-muted-foreground">
                  {data.driverDistanceM >= 1000
                    ? `${(data.driverDistanceM / 1000).toFixed(1)} km entfernt`
                    : `${Math.round(data.driverDistanceM)} m entfernt`}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 text-matcha-600">
            <Zap className="h-3.5 w-3.5" />
            <span className="text-xs font-bold">Live</span>
          </div>
        </div>
      )}

      {/* Delivered state */}
      {data.status === 'delivered' && (
        <div className="text-center space-y-1">
          <div className="text-4xl">🎉</div>
          <div className="text-base font-bold text-matcha-700">Deine Bestellung ist da!</div>
          <div className="text-xs text-muted-foreground">Guten Hunger!</div>
        </div>
      )}
    </div>
  );
}
