'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';

/**
 * Phase 1696 — Bestellstatus-Mini-Tracker (Storefront)
 *
 * 5-Stufen-Leiste: Eingegangen/Angenommen/In Zubereitung/Bereit/Unterwegs
 * mit Live-Update per Polling; Props orderId + initialStatus; Hydration-safe.
 */

type OrderStatus =
  | 'eingegangen'
  | 'angenommen'
  | 'in_zubereitung'
  | 'bereit'
  | 'unterwegs'
  | 'geliefert'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'dispatched'
  | 'delivering'
  | 'delivered';

interface Props {
  orderId: string | null;
  initialStatus?: OrderStatus | string | null;
  locationId: string;
}

const STEPS = [
  { key: 'eingegangen',    label: 'Eingegangen' },
  { key: 'angenommen',     label: 'Angenommen' },
  { key: 'in_zubereitung', label: 'In Zubereitung' },
  { key: 'bereit',         label: 'Bereit' },
  { key: 'unterwegs',      label: 'Unterwegs' },
] as const;

type StepKey = typeof STEPS[number]['key'];

const STATUS_INDEX: Record<string, number> = {
  eingegangen:    0,
  confirmed:      1,
  angenommen:     1,
  preparing:      2,
  in_zubereitung: 2,
  ready:          3,
  bereit:         3,
  dispatched:     4,
  delivering:     4,
  unterwegs:      4,
  delivered:      4,
  geliefert:      4,
};

function resolveIndex(status: string | null | undefined): number {
  if (!status) return 0;
  return STATUS_INDEX[status.toLowerCase()] ?? 0;
}

const POLL_MS = 30 * 1000;

async function fetchStatus(orderId: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/delivery/public/bestellstatus?order_id=${encodeURIComponent(orderId)}`);
    if (!res.ok) return null;
    const d = await res.json();
    return d.status ?? null;
  } catch {
    return null;
  }
}

export function StorefrontPhase1696BestellstatusMiniTracker({ orderId, initialStatus, locationId }: Props) {
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<string | null>(initialStatus ?? null);

  useEffect(() => {
    setMounted(true);
    if (!orderId) return;
    const poll = async () => {
      const s = await fetchStatus(orderId);
      if (s) setStatus(s);
    };
    poll();
    const iv = setInterval(poll, POLL_MS);
    return () => clearInterval(iv);
  }, [orderId]);

  if (!mounted || !orderId) return null;

  const currentIdx = resolveIndex(status);
  const isDelivered = status === 'delivered' || status === 'geliefert';

  return (
    <div className="rounded-xl border border-border bg-card px-3 py-3 mb-3">
      <div className="text-xs font-semibold text-foreground mb-3">Bestellstatus</div>

      {/* Step bar */}
      <div className="relative">
        {/* Connector line */}
        <div className="absolute top-3 left-3 right-3 h-0.5 bg-muted" aria-hidden="true">
          <div
            className="h-full bg-matcha-500 transition-all duration-700"
            style={{ width: `${Math.min(100, (currentIdx / (STEPS.length - 1)) * 100)}%` }}
          />
        </div>

        <div className="relative flex justify-between">
          {STEPS.map((step, idx) => {
            const done    = idx < currentIdx || isDelivered;
            const current = idx === currentIdx && !isDelivered;
            return (
              <div key={step.key} className="flex flex-col items-center gap-1" style={{ width: `${100 / STEPS.length}%` }}>
                <div className={cn(
                  'h-6 w-6 rounded-full flex items-center justify-center z-10 transition-all duration-500',
                  done    ? 'bg-matcha-500 text-white'   :
                  current ? 'bg-matcha-100 border-2 border-matcha-500 text-matcha-600 dark:bg-matcha-950'
                          : 'bg-muted border border-border text-muted-foreground',
                )}>
                  {done ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : current ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Circle className="h-3 w-3" />
                  )}
                </div>
                <span className={cn(
                  'text-center leading-tight',
                  'text-[8px]',
                  done    ? 'text-matcha-600 dark:text-matcha-400 font-medium' :
                  current ? 'text-matcha-700 dark:text-matcha-300 font-bold'   :
                            'text-muted-foreground',
                )}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {isDelivered && (
        <div className="mt-3 rounded-lg bg-matcha-50 dark:bg-matcha-950 border border-matcha-200 dark:border-matcha-800 px-2.5 py-2 text-xs font-bold text-matcha-700 dark:text-matcha-300 text-center">
          Bestellung wurde geliefert!
        </div>
      )}
    </div>
  );
}
