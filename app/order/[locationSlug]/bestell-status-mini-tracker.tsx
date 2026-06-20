'use client';

import { useEffect, useState } from 'react';
import { ChefHat, Bike, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Stage = 'preparing' | 'on_the_way' | 'delivered';

interface Props {
  orderId: string;
  initialStage?: Stage;
}

const STAGES: { key: Stage; label: string; icon: React.ElementType }[] = [
  { key: 'preparing',  label: 'Wird zubereitet', icon: ChefHat },
  { key: 'on_the_way', label: 'Unterwegs',        icon: Bike },
  { key: 'delivered',  label: 'Geliefert',         icon: CheckCircle2 },
];

function stageFromStatus(status: string | undefined): Stage {
  if (!status) return 'preparing';
  if (status === 'delivered' || status === 'geliefert') return 'delivered';
  if (
    status === 'on_the_way' ||
    status === 'picked_up' ||
    status === 'driver_departing' ||
    status === 'unterwegs'
  ) return 'on_the_way';
  return 'preparing';
}

export function BestellStatusMiniTracker({ orderId, initialStage = 'preparing' }: Props) {
  const [stage, setStage] = useState<Stage>(initialStage);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/delivery/customer/tracking?order_id=${orderId}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setStage(stageFromStatus(json.status));
      } catch { /* noop */ }
    }

    poll();
    const iv = setInterval(poll, 20_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [orderId]);

  const currentIdx = STAGES.findIndex((s) => s.key === stage);

  return (
    <div className="flex items-center gap-0 w-full">
      {STAGES.map((s, idx) => {
        const isDone    = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const Icon = s.icon;

        return (
          <div key={s.key} className="flex items-center flex-1 last:flex-none">
            {/* Step */}
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all duration-500',
                  isDone
                    ? 'bg-green-500 border-green-500 text-white'
                    : isCurrent
                    ? 'bg-white border-matcha-600 text-matcha-600 animate-pulse shadow-md shadow-matcha-100'
                    : 'bg-white border-stone-200 text-stone-300',
                )}
              >
                <Icon size={14} strokeWidth={isCurrent ? 2.5 : 2} />
              </div>
              <span
                className={cn(
                  'text-[9px] font-medium text-center leading-tight max-w-[56px]',
                  isCurrent ? 'text-matcha-700 font-black' : isDone ? 'text-green-600' : 'text-stone-400',
                )}
              >
                {s.label}
              </span>
            </div>

            {/* Connector (not after last) */}
            {idx < STAGES.length - 1 && (
              <div className="flex-1 h-0.5 mx-1 mb-4 rounded-full overflow-hidden bg-stone-200">
                <div
                  className="h-full bg-green-500 transition-all duration-700"
                  style={{ width: isDone ? '100%' : isCurrent ? '40%' : '0%' }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
