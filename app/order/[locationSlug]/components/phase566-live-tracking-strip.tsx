'use client';

/**
 * Phase 566 — Storefront: Live-Lieferfortschritt-Strip
 *
 * Schmaler animierter Statusstreifen für die Kunden-Bestellseite.
 * Zeigt den aktuellen Bestellstatus mit Pulse-Animation und
 * geschätzter Restzeit als prominenter Zahl.
 *
 * Wird über Supabase Realtime aktualisiert.
 * Kompakt genug für mobile-first Header-Bereich.
 */

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Bike, Check, ChefHat, Clock, Package, Sparkles } from 'lucide-react';

type OrderStatus = 'neu' | 'bestätigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert';

interface Props {
  orderId: string;
  initialStatus?: string;
  initialEtaMin?: number | null;
}

const STATUS_META: Record<string, {
  icon: React.ElementType;
  label: string;
  hint: string;
  bg: string;
  text: string;
  pulse: string;
  ringColor: string;
}> = {
  neu: {
    icon: Clock, label: 'Empfangen', hint: 'Deine Bestellung wurde entgegen genommen',
    bg: 'bg-stone-50', text: 'text-stone-700', pulse: 'bg-stone-400', ringColor: 'bg-stone-200',
  },
  bestätigt: {
    icon: Check, label: 'Bestätigt', hint: 'Das Restaurant hat deine Bestellung angenommen',
    bg: 'bg-blue-50', text: 'text-blue-700', pulse: 'bg-blue-500', ringColor: 'bg-blue-100',
  },
  in_zubereitung: {
    icon: ChefHat, label: 'Wird zubereitet', hint: 'Die Küche arbeitet an deiner Bestellung',
    bg: 'bg-orange-50', text: 'text-orange-700', pulse: 'bg-orange-500', ringColor: 'bg-orange-100',
  },
  fertig: {
    icon: Package, label: 'Bereit', hint: 'Bestellung fertig — Fahrer wird gleich abholen',
    bg: 'bg-purple-50', text: 'text-purple-700', pulse: 'bg-purple-500', ringColor: 'bg-purple-100',
  },
  unterwegs: {
    icon: Bike, label: 'Unterwegs', hint: 'Dein Fahrer ist auf dem Weg zu dir',
    bg: 'bg-matcha-50', text: 'text-matcha-700', pulse: 'bg-matcha-500', ringColor: 'bg-matcha-100',
  },
  geliefert: {
    icon: Sparkles, label: 'Geliefert!', hint: 'Guten Appetit!',
    bg: 'bg-matcha-50', text: 'text-matcha-700', pulse: 'bg-matcha-600', ringColor: 'bg-matcha-100',
  },
};

function fmtEta(etaMin: number): string {
  if (etaMin <= 1) return '~1 Min';
  return `~${Math.round(etaMin)} Min`;
}

export function Phase566LiveTrackingStrip({ orderId, initialStatus = 'bestätigt', initialEtaMin }: Props) {
  const [status, setStatus]   = useState(initialStatus);
  const [etaMin, setEtaMin]   = useState<number | null>(initialEtaMin ?? null);
  const [, setTick]           = useState(0);
  const supabase              = createClient();
  const channelRef            = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 30_000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const ch = supabase
      .channel(`phase566-tracking-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'customer_orders', filter: `id=eq.${orderId}` },
        (payload: { new: Record<string, unknown> }) => {
          const r = payload.new;
          if (typeof r.status === 'string') setStatus(r.status);
          if (typeof r.geschaetzte_lieferung_min === 'number') setEtaMin(r.geschaetzte_lieferung_min);
        },
      )
      .subscribe();
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const meta = STATUS_META[status] ?? STATUS_META['bestätigt'];
  const Icon = meta.icon;
  const isDelivered = status === 'geliefert';

  return (
    <div className={cn(
      'rounded-2xl overflow-hidden border shadow-sm',
      meta.bg,
    )}>
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Animated pulse indicator */}
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
          {!isDelivered && (
            <span className={cn(
              'absolute inline-flex h-full w-full rounded-full opacity-40',
              meta.pulse,
              'animate-ping',
            )} />
          )}
          <span className={cn(
            'relative flex h-8 w-8 items-center justify-center rounded-full',
            meta.ringColor,
          )}>
            <Icon className={cn('h-4 w-4', meta.text)} />
          </span>
        </div>

        {/* Status info */}
        <div className="flex-1 min-w-0">
          <div className={cn('text-sm font-black', meta.text)}>
            {meta.label}
          </div>
          <div className="text-[11px] text-muted-foreground truncate">
            {meta.hint}
          </div>
        </div>

        {/* ETA */}
        {etaMin !== null && !isDelivered && (
          <div className="shrink-0 text-right">
            <div className={cn('text-lg font-black tabular-nums leading-none', meta.text)}>
              {fmtEta(etaMin)}
            </div>
            <div className="text-[10px] text-muted-foreground">ETA</div>
          </div>
        )}

        {isDelivered && (
          <div className={cn('shrink-0 rounded-full px-2 py-1 text-[11px] font-bold', 'bg-matcha-600 text-white')}>
            ✓ Geliefert
          </div>
        )}
      </div>

      {/* Progress dots */}
      {!isDelivered && (
        <div className="flex items-center gap-1 px-4 pb-3">
          {(['bestätigt', 'in_zubereitung', 'fertig', 'unterwegs'] as OrderStatus[]).map((s) => {
            const statusOrder = ['neu', 'bestätigt', 'in_zubereitung', 'fertig', 'unterwegs', 'geliefert'];
            const currentIdx = statusOrder.indexOf(status);
            const thisIdx = statusOrder.indexOf(s);
            const done    = thisIdx <= currentIdx;
            const active  = thisIdx === currentIdx;
            return (
              <div
                key={s}
                className={cn(
                  'h-1 flex-1 rounded-full transition-all duration-500',
                  done ? meta.pulse : 'bg-black/10',
                  active && 'animate-pulse',
                )}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
