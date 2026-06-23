'use client';

import { useEffect, useState } from 'react';
import { Bike, Check, ChefHat, Package, Clock, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

type TrackingData = {
  status: string;
  eta_min: number | null;
  driver_name: string | null;
};

type Stage = {
  key: string;
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  statuses: string[];
};

const STAGES: Stage[] = [
  {
    key: 'received',
    label: 'Eingegangen',
    icon: Package,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
    statuses: ['neu', 'bestätigt'],
  },
  {
    key: 'cooking',
    label: 'Wird zubereitet',
    icon: ChefHat,
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-300',
    statuses: ['in_zubereitung'],
  },
  {
    key: 'ready',
    label: 'Fertig',
    icon: Package,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
    statuses: ['fertig'],
  },
  {
    key: 'delivering',
    label: 'Auf dem Weg',
    icon: Bike,
    color: 'text-matcha-700',
    bgColor: 'bg-matcha-50',
    borderColor: 'border-matcha-300',
    statuses: ['unterwegs'],
  },
  {
    key: 'delivered',
    label: 'Geliefert!',
    icon: Check,
    color: 'text-matcha-700',
    bgColor: 'bg-matcha-100',
    borderColor: 'border-matcha-400',
    statuses: ['geliefert', 'done', 'abgeschlossen'],
  },
];

function stageIndexOf(status: string): number {
  for (let i = 0; i < STAGES.length; i++) {
    if (STAGES[i].statuses.includes(status)) return i;
  }
  return 0;
}

export function LiveOrderKompass({
  orderId,
  locationId,
  estimatedMinutes,
}: {
  orderId: string;
  locationId: string;
  estimatedMinutes: number;
}) {
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) return;
    let mounted = true;

    const poll = () => {
      fetch(`/api/delivery/customer/tracking?order_id=${encodeURIComponent(orderId)}`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          if (!mounted) return;
          if (d?.status) {
            setData({ status: d.status, eta_min: d.eta_min ?? null, driver_name: d.driver_name ?? null });
          }
        })
        .catch(() => {})
        .finally(() => { if (mounted) setLoading(false); });
    };

    poll();
    const iv = setInterval(poll, 30_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [orderId]);

  if (!orderId) return null;

  const currentStatus = data?.status ?? 'neu';
  const activeIdx = stageIndexOf(currentStatus);
  const activeStage = STAGES[activeIdx];
  const Icon = activeStage.icon;
  const etaMin = data?.eta_min ?? estimatedMinutes;
  const isDelivered = activeIdx >= STAGES.length - 1;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      {/* Active stage hero */}
      <div className={cn('flex flex-col items-center gap-3 px-6 py-6', activeStage.bgColor)}>
        <div className={cn(
          'w-16 h-16 rounded-full flex items-center justify-center border-2',
          activeStage.borderColor,
          activeStage.bgColor,
        )}>
          {loading ? (
            <div className="w-6 h-6 rounded-full border-2 border-stone-300 border-t-matcha-500 animate-spin" />
          ) : (
            <Icon className={cn('h-8 w-8', activeStage.color)} />
          )}
        </div>
        <div className="text-center">
          <div className={cn('text-lg font-black', activeStage.color)}>
            {isDelivered ? 'Guten Appetit! 🎉' : activeStage.label}
          </div>
          {!isDelivered && data?.driver_name && activeIdx >= 3 && (
            <div className="text-xs text-stone-500 mt-1">
              Dein Fahrer: <span className="font-bold text-stone-700">{data.driver_name}</span>
            </div>
          )}
          {!isDelivered && etaMin > 0 && (
            <div className="flex items-center justify-center gap-1.5 mt-2">
              <Clock className="h-3.5 w-3.5 text-stone-400" />
              <span className="text-sm font-bold text-stone-600">Noch ca. {etaMin} Min</span>
            </div>
          )}
        </div>
      </div>

      {/* Stage progress dots */}
      <div className="px-6 py-4">
        <div className="flex items-center gap-1">
          {STAGES.map((stage, i) => {
            const done = i < activeIdx;
            const active = i === activeIdx;
            const pending = i > activeIdx;
            return (
              <div key={stage.key} className="flex items-center flex-1">
                <div className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center border-2 shrink-0 transition-all duration-500',
                  done ? 'bg-matcha-500 border-matcha-500' : '',
                  active ? 'bg-white border-matcha-500 ring-2 ring-matcha-200' : '',
                  pending ? 'bg-white border-stone-200' : '',
                )}>
                  {done ? (
                    <Check className="h-3.5 w-3.5 text-white" />
                  ) : (
                    <stage.icon className={cn('h-3.5 w-3.5', active ? 'text-matcha-600' : 'text-stone-300')} />
                  )}
                </div>
                {i < STAGES.length - 1 && (
                  <div className={cn('flex-1 h-0.5 mx-0.5 rounded-full transition-all duration-500', done ? 'bg-matcha-500' : 'bg-stone-200')} />
                )}
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-1.5">
          {STAGES.map((stage, i) => (
            <div
              key={stage.key}
              className={cn(
                'text-[8px] font-bold text-center transition-colors duration-500',
                i === activeIdx ? 'text-matcha-700' : i < activeIdx ? 'text-matcha-500' : 'text-stone-300',
              )}
              style={{ width: `${100 / STAGES.length}%` }}
            >
              {stage.label.split(' ')[0]}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
