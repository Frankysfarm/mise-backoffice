'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Clock, Truck, ChefHat, CheckCircle2, Zap } from 'lucide-react';

interface EtaPulseBannerProps {
  orderId: string;
  initialEtaMin?: number | null;
  initialStatus?: string | null;
}

type OrderPhase = 'neu' | 'zubereitung' | 'fertig' | 'unterwegs' | 'geliefert';

const STATUS_MAP: Record<string, OrderPhase> = {
  neu: 'neu', bestätigt: 'zubereitung', angenommen: 'zubereitung',
  in_zubereitung: 'zubereitung', preparing: 'zubereitung',
  fertig: 'fertig', ready: 'fertig',
  unterwegs: 'unterwegs', out_for_delivery: 'unterwegs', picked_up: 'unterwegs',
  geliefert: 'geliefert', delivered: 'geliefert', completed: 'geliefert',
};

const PHASE_CONFIG: Record<OrderPhase, {
  icon: React.ElementType; label: string; sub: string;
  bg: string; ring: string; iconColor: string; pulse: boolean;
}> = {
  neu: {
    icon: Zap, label: 'Bestellung eingegangen', sub: 'Wird gleich bestätigt…',
    bg: 'bg-stone-50', ring: 'ring-stone-200', iconColor: 'text-stone-400', pulse: false,
  },
  zubereitung: {
    icon: ChefHat, label: 'Wird zubereitet', sub: 'Dein Essen ist in der Küche.',
    bg: 'bg-amber-50', ring: 'ring-amber-200', iconColor: 'text-amber-500', pulse: true,
  },
  fertig: {
    icon: CheckCircle2, label: 'Fertig!', sub: 'Wird gleich abgeholt.',
    bg: 'bg-matcha-50', ring: 'ring-matcha-200', iconColor: 'text-matcha-600', pulse: false,
  },
  unterwegs: {
    icon: Truck, label: 'Unterwegs zu dir', sub: 'Fahrer ist auf dem Weg.',
    bg: 'bg-blue-50', ring: 'ring-blue-200', iconColor: 'text-blue-500', pulse: true,
  },
  geliefert: {
    icon: CheckCircle2, label: 'Geliefert!', sub: 'Guten Appetit!',
    bg: 'bg-matcha-50', ring: 'ring-matcha-300', iconColor: 'text-matcha-600', pulse: false,
  },
};

export function EtaPulseBanner({ orderId, initialEtaMin, initialStatus }: EtaPulseBannerProps) {
  const [status, setStatus] = useState<string | null>(initialStatus ?? null);
  const [etaMin, setEtaMin] = useState<number | null>(initialEtaMin ?? null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const startRef = useRef<number>(Date.now());
  const [startEta] = useState(initialEtaMin ?? null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/delivery/orders/${orderId}/events`, { cache: 'no-store' });
        if (res.ok && !cancelled) {
          const data = await res.json();
          if (data?.status) setStatus(data.status);
          if (data?.eta_min !== undefined) setEtaMin(data.eta_min);
        }
      } catch {}
    }

    poll();
    const iv = setInterval(poll, 30_000);

    const supabase = createClient();
    const ch = supabase
      .channel(`eta-pulse-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'customer_orders', filter: `id=eq.${orderId}` },
        (payload: { new: Record<string, unknown> }) => {
          if (!cancelled) {
            const row = payload.new;
            if (typeof row?.status === 'string') setStatus(row.status);
            if ('eta_min' in row) setEtaMin(typeof row.eta_min === 'number' ? row.eta_min : null);
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(iv);
      supabase.removeChannel(ch);
    };
  }, [orderId]);

  // Live countdown ticker
  useEffect(() => {
    if (etaMin === null) { setCountdown(null); return; }
    startRef.current = Date.now();
    const etaMs = etaMin * 60_000;

    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const remain = Math.max(0, Math.ceil((etaMs - elapsed) / 60_000));
      setCountdown(remain);
    };

    tick();
    const iv = setInterval(tick, 10_000);
    return () => clearInterval(iv);
  }, [etaMin]);

  const phase: OrderPhase = STATUS_MAP[status ?? ''] ?? 'neu';
  const cfg = PHASE_CONFIG[phase];
  const Icon = cfg.icon;

  return (
    <div className={cn(
      'rounded-2xl ring-1 p-4 flex items-center gap-4 transition-all duration-500',
      cfg.bg, cfg.ring,
    )}>
      {/* Icon with optional pulse ring */}
      <div className="relative shrink-0">
        <div className={cn(
          'flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm',
          cfg.pulse && 'animate-pulse',
        )}>
          <Icon className={cn('h-6 w-6', cfg.iconColor)} />
        </div>
        {cfg.pulse && (
          <span className="absolute inset-0 rounded-full animate-ping opacity-20 bg-current" style={{ color: 'inherit' }} />
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-stone-800 leading-tight">{cfg.label}</div>
        <div className="text-xs text-stone-500 mt-0.5">{cfg.sub}</div>
      </div>

      {/* ETA countdown */}
      {countdown !== null && phase !== 'geliefert' && (
        <div className="shrink-0 text-right">
          <div className="text-2xl font-black tabular-nums text-stone-800 leading-none">
            {countdown}
          </div>
          <div className="text-[10px] text-stone-400 leading-tight">Min</div>
        </div>
      )}

      {phase === 'geliefert' && (
        <div className="shrink-0">
          <CheckCircle2 className="h-7 w-7 text-matcha-500" />
        </div>
      )}
    </div>
  );
}
