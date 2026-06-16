'use client';

import { Check, ChefHat, Package, Star, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

type PrepStep = {
  id: string;
  label: string;
  description: string;
  completedAt?: string | null;
};

const STEPS: {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  isComplete: (status: string) => boolean;
  isActive: (status: string) => boolean;
}[] = [
  {
    id: 'bestätigt',
    label: 'Bestätigt',
    description: 'Deine Bestellung wurde angenommen.',
    icon: Check,
    isComplete: (status) => status !== 'neu',
    isActive: (status) => status === 'neu',
  },
  {
    id: 'in_zubereitung',
    label: 'In Zubereitung',
    description: 'Unser Küchenteam bereitet deine Bestellung vor.',
    icon: ChefHat,
    isComplete: (status) =>
      status === 'fertig' || status === 'unterwegs' || status === 'geliefert',
    isActive: (status) =>
      status === 'in_zubereitung' || status === 'bestätigt',
  },
  {
    id: 'fertig',
    label: 'Fertig',
    description: 'Deine Bestellung ist fertig zubereitet.',
    icon: Package,
    isComplete: (status) => status === 'unterwegs' || status === 'geliefert',
    isActive: (status) => status === 'fertig',
  },
  {
    id: 'unterwegs',
    label: 'Unterwegs',
    description: 'Deine Bestellung ist auf dem Weg zu dir.',
    icon: Truck,
    isComplete: (status) => status === 'geliefert',
    isActive: (status) => status === 'unterwegs',
  },
  {
    id: 'geliefert',
    label: 'Geliefert!',
    description: 'Deine Bestellung wurde erfolgreich zugestellt.',
    icon: Star,
    isComplete: (status) => status === 'geliefert',
    isActive: (status) => status === 'geliefert',
  },
];

export function LivePrepSteps({
  currentStatus,
  orderedAt,
  estimatedReadyMin,
  estimatedDeliveryMin,
}: {
  currentStatus: string;
  orderedAt: string | null;
  estimatedReadyMin: number | null;
  estimatedDeliveryMin: number | null;
}) {
  const isDelivered = currentStatus === 'geliefert';

  return (
    <div className="w-full rounded-2xl border border-green-100 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className={cn(
        'px-4 py-3 border-b',
        isDelivered ? 'bg-green-50 border-green-100' : 'bg-white border-gray-100',
      )}>
        <h2 className="text-sm font-bold text-gray-800 tracking-tight">
          Live-Bestellstatus
        </h2>
        {orderedAt && (
          <p className="text-xs text-gray-500 mt-0.5">
            Bestellt um{' '}
            {new Date(orderedAt).toLocaleTimeString('de-DE', {
              hour: '2-digit',
              minute: '2-digit',
            })}{' '}
            Uhr
          </p>
        )}
      </div>

      {/* Steps */}
      <div className="px-4 py-4 space-y-0">
        {STEPS.map((step, idx) => {
          const complete = step.isComplete(currentStatus);
          const active = step.isActive(currentStatus) && !complete;
          const future = !complete && !active;
          const isLast = idx === STEPS.length - 1;
          const Icon = step.icon;

          // Determine estimated time hint for this step
          let etaHint: string | null = null;
          if (active && step.id === 'in_zubereitung' && estimatedReadyMin != null) {
            etaHint = `Noch ca. ${estimatedReadyMin} Min.`;
          } else if (active && step.id === 'unterwegs' && estimatedDeliveryMin != null) {
            etaHint = `Noch ca. ${estimatedDeliveryMin} Min.`;
          }

          return (
            <div key={step.id} className="flex gap-3">
              {/* Left column: indicator + connector line */}
              <div className="flex flex-col items-center">
                {/* Circle indicator */}
                <div
                  className={cn(
                    'h-9 w-9 rounded-full flex items-center justify-center shrink-0 border-2 transition-all duration-500',
                    complete
                      ? 'bg-green-500 border-green-600 text-white'
                      : active
                      ? 'bg-white border-green-500 text-green-600 animate-pulse'
                      : 'bg-gray-100 border-gray-200 text-gray-400',
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4',
                      complete ? 'text-white' : active ? 'text-green-600' : 'text-gray-400',
                    )}
                  />
                </div>

                {/* Connecting line */}
                {!isLast && (
                  <div
                    className={cn(
                      'w-0.5 flex-1 mt-1 mb-1 min-h-[1.5rem] rounded-full transition-colors duration-500',
                      complete ? 'bg-green-400' : 'bg-gray-200',
                    )}
                  />
                )}
              </div>

              {/* Right column: text content */}
              <div
                className={cn(
                  'flex-1 min-w-0',
                  isLast ? 'pb-0' : 'pb-4',
                )}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={cn(
                      'text-sm font-bold leading-tight',
                      complete
                        ? 'text-green-700'
                        : active
                        ? 'text-gray-900'
                        : 'text-gray-400',
                    )}
                  >
                    {step.label}
                  </span>
                  {etaHint && (
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                      {etaHint}
                    </span>
                  )}
                </div>
                <p
                  className={cn(
                    'text-xs mt-0.5 leading-snug',
                    complete || active ? 'text-gray-500' : 'text-gray-300',
                  )}
                >
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Celebration message */}
      {isDelivered && (
        <div className="mx-4 mb-4 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-center">
          <p className="text-base font-black text-green-700">Guten Appetit! 🎉</p>
          <p className="text-xs text-green-600 mt-0.5">
            Wir hoffen, es schmeckt dir!
          </p>
        </div>
      )}
    </div>
  );
}
