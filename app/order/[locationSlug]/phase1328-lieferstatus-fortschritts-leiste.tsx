'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChefHat, Package, ShoppingCart, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1328 — Lieferstatus-Fortschritts-Leiste (Storefront)
 *
 * 4-Stufen-Leiste: Bestellt → Zubereitung → Bereit → Unterwegs
 * Animierter Fortschritt, 30-Sek-Polling, Storefront nach Phase1323.
 */

type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'picked_up'
  | 'delivering'
  | 'delivered'
  | 'cancelled';

interface Step {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  statuses: OrderStatus[];
}

const STEPS: Step[] = [
  { key: 'bestellt', label: 'Bestellt', icon: ShoppingCart, statuses: ['pending', 'confirmed'] },
  { key: 'zubereitung', label: 'Zubereitung', icon: ChefHat, statuses: ['preparing'] },
  { key: 'bereit', label: 'Bereit', icon: Package, statuses: ['ready', 'picked_up'] },
  { key: 'unterwegs', label: 'Unterwegs', icon: Truck, statuses: ['delivering', 'delivered'] },
];

function statusToStep(status: OrderStatus | null): number {
  if (!status) return 0;
  for (let i = STEPS.length - 1; i >= 0; i--) {
    if ((STEPS[i].statuses as string[]).includes(status)) return i;
  }
  return 0;
}

interface ApiResult {
  status: OrderStatus;
  eta_min?: number | null;
  fahrer_name?: string | null;
}

interface Props {
  locationId: string;
  orderId: string | null;
}

const POLL_MS = 30_000;

export function Phase1328LieferstatusFortschrittsLeiste({ locationId, orderId }: Props) {
  const [orderStatus, setOrderStatus] = useState<OrderStatus | null>(null);
  const [etaMin, setEtaMin] = useState<number | null>(null);
  const [fahrerName, setFahrerName] = useState<string | null>(null);
  const [animating, setAnimating] = useState(false);
  const prevStepRef = useRef(-1);

  useEffect(() => {
    if (!orderId || !locationId) return;

    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(
          `/api/delivery/public/bestellstatus?location_id=${locationId}&order_id=${orderId}`
        );
        if (!res.ok) throw new Error('API error');
        const json: ApiResult = await res.json();
        if (!cancelled) {
          setOrderStatus(json.status ?? null);
          setEtaMin(json.eta_min ?? null);
          setFahrerName(json.fahrer_name ?? null);
        }
      } catch {
        // Mock-Fallback: Setze pending wenn API nicht antwortet
        if (!cancelled && !orderStatus) setOrderStatus('pending');
      }
    }

    void poll();
    const id = setInterval(poll, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [locationId, orderId, orderStatus]);

  const currentStep = statusToStep(orderStatus);

  useEffect(() => {
    if (prevStepRef.current !== currentStep && prevStepRef.current !== -1) {
      setAnimating(true);
      const t = setTimeout(() => setAnimating(false), 800);
      return () => clearTimeout(t);
    }
    prevStepRef.current = currentStep;
  }, [currentStep]);

  if (!orderId || orderStatus === null) return null;
  if (orderStatus === 'cancelled') return null;

  const isDone = orderStatus === 'delivered';

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-4 space-y-3">
      {/* Titel */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-foreground">
          {isDone ? '✅ Lieferung abgeschlossen!' : 'Deine Bestellung'}
        </p>
        {etaMin != null && !isDone && (
          <span className="text-xs font-bold text-matcha-600 dark:text-matcha-400 tabular-nums">
            ~{etaMin} Min
          </span>
        )}
      </div>

      {/* Stepper */}
      <div className="relative">
        {/* Verbindungslinie */}
        <div className="absolute top-5 left-[calc(12.5%)] right-[calc(12.5%)] h-0.5 bg-muted" />
        <div
          className="absolute top-5 left-[calc(12.5%)] h-0.5 bg-matcha-500 transition-all duration-700 ease-out"
          style={{
            width: `${(currentStep / (STEPS.length - 1)) * 75}%`,
          }}
        />

        {/* Steps */}
        <div className="relative flex items-start justify-between">
          {STEPS.map((step, i) => {
            const isDoneStep = i < currentStep || isDone;
            const isActive = i === currentStep && !isDone;
            const Icon = step.icon;

            return (
              <div key={step.key} className="flex flex-col items-center gap-1.5 flex-1">
                <div className={cn(
                  'w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-500',
                  isDoneStep || isDone
                    ? 'border-matcha-500 bg-matcha-500 text-white'
                    : isActive
                    ? cn(
                        'border-matcha-500 bg-white dark:bg-zinc-900 text-matcha-600 dark:text-matcha-400',
                        animating && 'scale-110'
                      )
                    : 'border-muted bg-muted text-muted-foreground'
                )}>
                  {isDoneStep || isDone ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Icon className={cn('h-4 w-4', isActive && 'animate-pulse')} />
                  )}
                </div>
                <span className={cn(
                  'text-[10px] font-medium text-center leading-tight',
                  isDoneStep || isDone ? 'text-matcha-600 dark:text-matcha-400' :
                  isActive ? 'text-foreground font-bold' : 'text-muted-foreground'
                )}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Status-Text */}
      {!isDone && (
        <div className="text-center">
          {orderStatus === 'pending' || orderStatus === 'confirmed' ? (
            <p className="text-xs text-muted-foreground">Deine Bestellung wurde erhalten und wird bestätigt.</p>
          ) : orderStatus === 'preparing' ? (
            <p className="text-xs text-muted-foreground">Die Küche bereitet deine Bestellung gerade zu.</p>
          ) : orderStatus === 'ready' || orderStatus === 'picked_up' ? (
            <p className="text-xs text-muted-foreground">
              Deine Bestellung ist fertig{fahrerName ? ` und wird von ${fahrerName} abgeholt.` : '.'}
            </p>
          ) : orderStatus === 'delivering' ? (
            <p className="text-xs text-matcha-600 dark:text-matcha-400 font-medium">
              🚴 {fahrerName ? `${fahrerName} ist` : 'Fahrer ist'} unterwegs zu dir
              {etaMin != null ? ` — ca. ${etaMin} Min` : ''}!
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
