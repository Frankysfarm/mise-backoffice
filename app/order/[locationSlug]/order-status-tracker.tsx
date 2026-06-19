'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, ChefHat, Clock, Truck, PackageCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EtaDynamicWidget } from './eta-dynamic-widget';
import { FahrerAnkunftsCountdown } from './fahrer-ankunfts-countdown';
import { createClient } from '@/lib/supabase/client';

interface Props {
  orderId: string;
  initialStatus?: string | null;
  initialEtaMin?: number | null;
}

type Phase = 'neu' | 'bestätigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert';

interface Step {
  key: Phase;
  label: string;
  sublabel: string;
  icon: React.ElementType;
}

const STEPS: Step[] = [
  { key: 'bestätigt',      label: 'Angenommen',   sublabel: 'Bestellung bestätigt',      icon: CheckCircle2  },
  { key: 'in_zubereitung', label: 'Zubereitung',  sublabel: 'Wird frisch zubereitet',    icon: ChefHat       },
  { key: 'fertig',         label: 'Fertig',        sublabel: 'Bereit zur Abholung',       icon: PackageCheck  },
  { key: 'unterwegs',      label: 'Unterwegs',     sublabel: 'Auf dem Weg zu dir',        icon: Truck         },
  { key: 'geliefert',      label: 'Geliefert',     sublabel: 'Guten Appetit!',            icon: CheckCircle2  },
];

function phaseIndex(status: string | null | undefined): number {
  if (!status) return 0;
  const map: Record<string, number> = {
    neu: 0, bestätigt: 1, angenommen: 1,
    in_zubereitung: 2, preparing: 2,
    fertig: 3, ready: 3,
    unterwegs: 4, out_for_delivery: 4, picked_up: 4,
    geliefert: 5, delivered: 5, completed: 5,
  };
  return map[status] ?? 0;
}

function etaMinFromIso(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
}

export function OrderStatusTracker({ orderId, initialStatus, initialEtaMin }: Props) {
  const [status, setStatus] = useState<string | null>(initialStatus ?? null);
  const [etaMin, setEtaMin] = useState<number | null>(initialEtaMin ?? null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    let mounted = true;

    async function poll() {
      try {
        const [orderRes, etaRes] = await Promise.all([
          fetch(`/api/delivery/orders/${orderId}/status`).catch(() => null),
          fetch(`/api/delivery/eta/${orderId}`).catch(() => null),
        ]);
        if (!mounted) return;
        if (orderRes?.ok) {
          const d = await orderRes.json();
          if (d?.status) setStatus(d.status);
        }
        if (etaRes?.ok) {
          const d = await etaRes.json();
          setEtaMin(etaMinFromIso(d?.eta_latest));
        }
      } catch { /* silent */ }
    }

    poll();
    const iv = setInterval(poll, 60_000);

    // Supabase realtime: push-Update sobald sich Status ändert
    const supabase = createClient();
    const channel = supabase
      .channel(`order-status-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'customer_orders', filter: `id=eq.${orderId}` },
        (payload: { new: Record<string, unknown> }) => {
          if (!mounted) return;
          const row = payload.new as Record<string, unknown>;
          if (row?.status) setStatus(row.status as string);
          if (row?.eta_latest) setEtaMin(etaMinFromIso(row.eta_latest as string));
          if (row?.eta_earliest) setEtaMin((prev) => prev ?? etaMinFromIso(row.eta_earliest as string));
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      clearInterval(iv);
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  // Local ETA countdown
  useEffect(() => {
    if (etaMin == null || etaMin <= 0) return;
    const iv = setInterval(() => {
      setEtaMin((prev) => (prev != null && prev > 0 ? prev - 1 : prev));
    }, 60_000);
    return () => clearInterval(iv);
  }, [etaMin]);

  const currentIdx = phaseIndex(status);
  const isDelivered = currentIdx >= 5;

  return (
    <>
    <div className="rounded-2xl border bg-card overflow-hidden">
      {/* ETA Banner */}
      {!isDelivered && etaMin != null && (
        <div className="bg-matcha-600 text-white px-4 py-2.5 flex items-center gap-3">
          <Clock size={16} className="shrink-0" />
          <div className="flex-1">
            <div className="text-xs font-bold uppercase tracking-wide opacity-80">
              Voraussichtliche Lieferzeit
            </div>
            <div className="text-lg font-black tabular-nums leading-tight">
              {etaMin <= 0 ? 'Gleich da!' : etaMin === 1 ? '~1 Minute' : `~${etaMin} Minuten`}
            </div>
          </div>
        </div>
      )}
      {isDelivered && (
        <div className="bg-matcha-600 text-white px-4 py-2.5 flex items-center gap-3">
          <CheckCircle2 size={16} className="shrink-0" />
          <div>
            <div className="text-sm font-bold">Geliefert!</div>
            <div className="text-xs opacity-80">Guten Appetit 🍽️</div>
          </div>
        </div>
      )}

      {/* Stepper */}
      <div className="px-4 py-4">
        <div className="relative">
          {/* Connector line */}
          <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-border" />
          <div
            className="absolute left-4 top-4 w-0.5 bg-matcha-500 transition-all duration-700"
            style={{ height: `${Math.min(100, (currentIdx / (STEPS.length - 1)) * 100)}%` }}
          />

          <div className="space-y-4 relative">
            {STEPS.map((step, idx) => {
              const done = idx < currentIdx;
              const active = idx === currentIdx - 1 || (currentIdx === 0 && idx === 0);
              const isCurrent = idx + 1 === currentIdx || (currentIdx === 0 && idx === 0);
              const reached = idx + 1 <= currentIdx;
              const Icon = step.icon;

              return (
                <div key={step.key} className="flex items-center gap-3 pl-0">
                  {/* Icon bubble */}
                  <div className={cn(
                    'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-500',
                    reached
                      ? 'border-matcha-500 bg-matcha-500 text-white'
                      : isCurrent
                      ? 'border-matcha-400 bg-matcha-50 text-matcha-600 animate-pulse'
                      : 'border-border bg-background text-muted-foreground',
                  )}>
                    <Icon size={14} />
                  </div>

                  {/* Labels */}
                  <div className={cn('flex-1', !reached && !isCurrent ? 'opacity-40' : '')}>
                    <div className={cn('text-sm font-bold leading-tight', reached ? 'text-matcha-700' : isCurrent ? 'text-foreground' : 'text-muted-foreground')}>
                      {step.label}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {step.sublabel}
                    </div>
                  </div>

                  {/* Active indicator */}
                  {isCurrent && (
                    <span className="rounded-full bg-matcha-100 text-matcha-700 text-[9px] font-black px-2 py-0.5 shrink-0 animate-pulse">
                      Jetzt
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>

    {/* Phase 219: ETA-Widget — Live-Countdown mit Phasen-Fortschrittsbalken */}
    <EtaDynamicWidget orderId={orderId} initialEtaMin={etaMin} initialStatus={status} />
    {/* Fahrer-Ankunfts-Countdown: Sekunden-genau wenn Fahrer < 5 Min entfernt */}
    <FahrerAnkunftsCountdown etaMin={etaMin} status={status} />
    </>
  );
}
