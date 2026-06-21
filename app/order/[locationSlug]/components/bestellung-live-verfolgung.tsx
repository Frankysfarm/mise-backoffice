'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ChefHat, Bike, CheckCircle2, Clock, MapPin, Package, Truck, Loader2,
} from 'lucide-react';

type OrderStatus =
  | 'neu'
  | 'bestätigt'
  | 'in_zubereitung'
  | 'fertig'
  | 'unterwegs'
  | 'geliefert'
  | 'storniert';

interface Props {
  orderId: string;
  bestellnummer: string;
  status: OrderStatus;
  etaMin?: number | null;
  driverName?: string | null;
  bestelltAm: string | null;
  className?: string;
}

type Phase = {
  key: OrderStatus[];
  icon: React.ReactNode;
  label: string;
  sublabel: string;
};

const phases: Phase[] = [
  {
    key: ['neu', 'bestätigt'],
    icon: <Package className="h-4 w-4" />,
    label: 'Angenommen',
    sublabel: 'Bestellung eingegangen',
  },
  {
    key: ['in_zubereitung'],
    icon: <ChefHat className="h-4 w-4" />,
    label: 'In Zubereitung',
    sublabel: 'Küche bereitet deine Bestellung vor',
  },
  {
    key: ['fertig'],
    icon: <CheckCircle2 className="h-4 w-4" />,
    label: 'Bereit',
    sublabel: 'Warte auf Fahrer',
  },
  {
    key: ['unterwegs'],
    icon: <Bike className="h-4 w-4" />,
    label: 'Unterwegs',
    sublabel: 'Fahrer ist auf dem Weg',
  },
  {
    key: ['geliefert'],
    icon: <CheckCircle2 className="h-4 w-4" />,
    label: 'Geliefert',
    sublabel: 'Guten Appetit!',
  },
];

function getPhaseIndex(status: OrderStatus): number {
  for (let i = 0; i < phases.length; i++) {
    if ((phases[i].key as string[]).includes(status)) return i;
  }
  return 0;
}

function ElapsedLabel({ bestelltAm, etaMin }: { bestelltAm: string | null; etaMin?: number | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!bestelltAm) return null;
  const elapsedMin = Math.floor((now - new Date(bestelltAm).getTime()) / 60_000);
  const remaining = etaMin != null ? etaMin - elapsedMin : null;

  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <Clock className="h-3.5 w-3.5" />
        {elapsedMin} Min vergangen
      </span>
      {remaining != null && remaining > 0 && (
        <span className="inline-flex items-center gap-1 font-bold text-foreground">
          <Truck className="h-3.5 w-3.5" />
          ~{remaining} Min bis Lieferung
        </span>
      )}
      {remaining != null && remaining <= 0 && (
        <span className="inline-flex items-center gap-1 font-bold text-orange-600">
          <Truck className="h-3.5 w-3.5" />
          Jeden Moment
        </span>
      )}
    </div>
  );
}

export function BestellungLiveVerfolgung({
  orderId,
  bestellnummer,
  status,
  etaMin,
  driverName,
  bestelltAm,
  className,
}: Props) {
  const activePhaseIdx = getPhaseIndex(status);
  const isCancelled = status === 'storniert';

  if (isCancelled) {
    return (
      <div className={cn('rounded-2xl border border-red-200 bg-red-50 p-4 text-center', className)}>
        <p className="font-bold text-red-700">Bestellung storniert</p>
        <p className="text-sm text-red-600 mt-0.5">#{bestellnummer}</p>
      </div>
    );
  }

  if (status === 'geliefert') {
    return (
      <div className={cn('rounded-2xl border border-matcha-200 bg-matcha-50 p-4 text-center', className)}>
        <CheckCircle2 className="h-10 w-10 text-matcha-500 mx-auto mb-2" />
        <p className="font-black text-matcha-700 text-lg">Geliefert!</p>
        <p className="text-sm text-matcha-600 mt-0.5">Guten Appetit – Bestellung #{bestellnummer}</p>
      </div>
    );
  }

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b bg-gradient-to-r from-matcha-50 to-transparent">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Bestellung #{bestellnummer}</p>
            <p className="font-bold text-sm mt-0.5">{phases[activePhaseIdx]?.label}</p>
          </div>
          <div className="h-8 w-8 rounded-full bg-matcha-100 flex items-center justify-center">
            {React.cloneElement(phases[activePhaseIdx]?.icon as React.ReactElement, {
              className: 'h-4 w-4 text-matcha-600',
            })}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">{phases[activePhaseIdx]?.sublabel}</p>
      </div>

      {/* Phase timeline */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-0">
          {phases.slice(0, 4).map((phase, idx) => {
            const isDone = idx < activePhaseIdx;
            const isCurrent = idx === activePhaseIdx;
            const isUpcoming = idx > activePhaseIdx;
            const isLastVisible = idx === 3;

            return (
              <div key={idx} className="flex items-center" style={{ flex: isLastVisible ? '0 0 auto' : 1 }}>
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'h-7 w-7 rounded-full flex items-center justify-center border-2 transition-all',
                      isDone ? 'bg-matcha-500 border-matcha-500 text-white' :
                      isCurrent ? 'bg-blue-500 border-blue-500 text-white ring-4 ring-blue-100' :
                      'bg-gray-100 border-gray-200 text-gray-400',
                    )}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : isCurrent ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      React.cloneElement(phase.icon as React.ReactElement, { className: 'h-3 w-3' })
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-[9px] font-bold mt-0.5 text-center whitespace-nowrap',
                      isDone ? 'text-matcha-600' :
                      isCurrent ? 'text-blue-600' : 'text-gray-400',
                    )}
                  >
                    {phase.label}
                  </span>
                </div>
                {!isLastVisible && (
                  <div
                    className={cn(
                      'h-0.5 flex-1 mx-1 rounded-full',
                      isDone ? 'bg-matcha-400' : 'bg-gray-100',
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer info */}
      <div className="px-4 pb-3 space-y-1.5">
        <ElapsedLabel bestelltAm={bestelltAm} etaMin={etaMin} />
        {driverName && status === 'unterwegs' && (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1">
            <Bike className="h-3 w-3 text-blue-500" />
            <span className="text-[11px] font-bold text-blue-700">{driverName} ist unterwegs</span>
          </div>
        )}
      </div>
    </div>
  );
}

// React needs to be in scope for JSX
import React from 'react';
