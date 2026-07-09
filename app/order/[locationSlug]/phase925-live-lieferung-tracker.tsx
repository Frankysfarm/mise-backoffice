'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, ChefHat, Clock, MapPin, Package, Truck } from 'lucide-react';

/**
 * Phase 925 — Live-Lieferung-Tracker (Storefront)
 *
 * Kunden-Tracking mit 4-Phasen-Fortschrittsanzeige:
 * 1. Bestätigt
 * 2. In Zubereitung
 * 3. Fahrer unterwegs
 * 4. Geliefert
 *
 * ETA-Countdown, Farbkodierung, mobile-first.
 */

type DeliveryPhase = 'confirmed' | 'cooking' | 'picked_up' | 'delivered';

interface Props {
  orderId: string | null;
  status?: string | null;
  initialEtaMin?: number;
}

const PHASES: {
  key: DeliveryPhase;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
}[] = [
  {
    key: 'confirmed',
    label: 'Bestätigt',
    sublabel: 'Bestellung eingegangen',
    icon: <Package className="h-4 w-4" />,
  },
  {
    key: 'cooking',
    label: 'In Zubereitung',
    sublabel: 'Küche bereitet vor',
    icon: <ChefHat className="h-4 w-4" />,
  },
  {
    key: 'picked_up',
    label: 'Fahrer unterwegs',
    sublabel: 'Auf dem Weg zu dir',
    icon: <Truck className="h-4 w-4" />,
  },
  {
    key: 'delivered',
    label: 'Geliefert',
    sublabel: 'Guten Appetit!',
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
];

function statusToPhase(status: string | null | undefined): DeliveryPhase {
  if (!status) return 'confirmed';
  if (['geliefert', 'delivered'].includes(status)) return 'delivered';
  if (['unterwegs', 'dispatched', 'in_delivery', 'picked_up'].includes(status)) return 'picked_up';
  if (['in_zubereitung', 'cooking', 'fertig', 'ready'].includes(status)) return 'cooking';
  return 'confirmed';
}

const PHASE_ORDER: DeliveryPhase[] = ['confirmed', 'cooking', 'picked_up', 'delivered'];

function phaseIndex(p: DeliveryPhase): number {
  return PHASE_ORDER.indexOf(p);
}

export function StorefrontPhase925LiveLieferungTracker({
  orderId,
  status,
  initialEtaMin = 30,
}: Props) {
  const [phase, setPhase] = useState<DeliveryPhase>(statusToPhase(status));
  const [etaMin, setEtaMin] = useState(initialEtaMin);
  const [secondsLeft, setSecondsLeft] = useState(initialEtaMin * 60);

  // Poll für Statusupdates
  useEffect(() => {
    if (!orderId) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/delivery/customer/order-status?order_id=${orderId}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const json = await res.json();
        if (json.status) setPhase(statusToPhase(json.status));
        if (json.eta_min) {
          setEtaMin(json.eta_min);
          setSecondsLeft(json.eta_min * 60);
        }
      } catch { /* ignore */ }
    };
    poll();
    const t = setInterval(poll, 30_000);
    return () => clearInterval(t);
  }, [orderId]);

  // Update phase from external status prop
  useEffect(() => {
    setPhase(statusToPhase(status));
  }, [status]);

  // ETA countdown
  useEffect(() => {
    if (phase === 'delivered') return;
    const t = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [phase]);

  const currentIndex = phaseIndex(phase);
  const isDelivered = phase === 'delivered';
  const etaMins = Math.floor(secondsLeft / 60);
  const etaSecs = secondsLeft % 60;

  return (
    <div className={cn(
      'rounded-2xl border-2 overflow-hidden',
      isDelivered ? 'border-matcha-300 bg-matcha-50' : 'border-stone-200 bg-white',
    )}>
      {/* Header */}
      <div className={cn(
        'px-4 py-3 flex items-center justify-between',
        isDelivered ? 'bg-matcha-100' : 'bg-stone-50 border-b border-stone-100',
      )}>
        <div className="flex items-center gap-2">
          {isDelivered
            ? <CheckCircle2 className="h-5 w-5 text-matcha-600" />
            : <Truck className="h-5 w-5 text-matcha-600" />
          }
          <span className="font-bold text-sm text-stone-800">
            {isDelivered ? 'Lieferung angekommen!' : 'Lieferung verfolgen'}
          </span>
        </div>

        {/* ETA countdown */}
        {!isDelivered && secondsLeft > 0 && (
          <div className="flex items-center gap-1 rounded-full bg-matcha-100 px-3 py-1">
            <Clock className="h-3.5 w-3.5 text-matcha-600" />
            <span className="text-sm font-black text-matcha-700 tabular-nums">
              {etaMins}:{etaSecs.toString().padStart(2, '0')}
            </span>
          </div>
        )}
      </div>

      {/* Progress timeline */}
      <div className="px-4 py-4">
        <div className="relative">
          {/* Connector line */}
          <div className="absolute left-[18px] top-[18px] bottom-[18px] w-0.5 bg-stone-200" />
          <div
            className="absolute left-[18px] top-[18px] w-0.5 bg-matcha-400 transition-all duration-700"
            style={{
              height: `${currentIndex > 0
                ? ((currentIndex) / (PHASES.length - 1)) * 100
                : 0}%`,
            }}
          />

          {/* Phase items */}
          <div className="space-y-4 relative">
            {PHASES.map((p, i) => {
              const isDone = i <= currentIndex;
              const isCurrent = i === currentIndex;
              const isFuture = i > currentIndex;
              return (
                <div key={p.key} className="flex items-center gap-3">
                  {/* Icon circle */}
                  <div className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300 z-10 bg-white',
                    isDone && !isCurrent
                      ? 'border-matcha-400 bg-matcha-400 text-white'
                      : isCurrent
                      ? 'border-matcha-500 bg-matcha-500 text-white shadow-lg shadow-matcha-200'
                      : 'border-stone-200 text-stone-300',
                  )}>
                    {isDone && !isCurrent
                      ? <CheckCircle2 className="h-4 w-4" />
                      : p.icon
                    }
                  </div>

                  {/* Text */}
                  <div className={cn('transition-opacity', isFuture ? 'opacity-40' : 'opacity-100')}>
                    <div className={cn(
                      'text-sm font-bold',
                      isCurrent ? 'text-matcha-700' : isDone ? 'text-stone-600' : 'text-stone-400',
                    )}>
                      {p.label}
                      {isCurrent && (
                        <span className="ml-2 inline-flex h-2 w-2 rounded-full bg-matcha-500 animate-pulse" />
                      )}
                    </div>
                    {(isCurrent || isDone) && (
                      <div className="text-[11px] text-stone-400">{p.sublabel}</div>
                    )}
                  </div>

                  {/* ETA badge on active step */}
                  {isCurrent && !isDelivered && etaMins > 0 && (
                    <div className="ml-auto shrink-0 rounded-full bg-matcha-100 px-2.5 py-1">
                      <span className="text-[11px] font-bold text-matcha-700">
                        ~{etaMins} Min
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Location note */}
        {!isDelivered && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-stone-50 border border-stone-100 px-3 py-2">
            <MapPin className="h-3.5 w-3.5 text-stone-400 shrink-0" />
            <span className="text-[11px] text-stone-500">
              Fahrer wird automatisch zu dir navigiert. Bitte halte dein Telefon bereit.
            </span>
          </div>
        )}

        {isDelivered && (
          <div className="mt-4 rounded-xl bg-matcha-100 border border-matcha-200 px-4 py-3 text-center">
            <CheckCircle2 className="h-6 w-6 text-matcha-600 mx-auto mb-1" />
            <p className="text-sm font-bold text-matcha-800">Bestellung wurde übergeben</p>
            <p className="text-[11px] text-matcha-600 mt-0.5">
              Guten Appetit! Wir freuen uns auf dein Feedback.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
