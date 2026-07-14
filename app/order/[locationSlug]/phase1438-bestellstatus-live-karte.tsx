'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { CheckCircle2, Clock, ChefHat, Bike, Home, Loader2 } from 'lucide-react';

interface Props {
  orderId?: string | null;
  locationSlug?: string;
}

type Phase = 'bestellt' | 'kueche' | 'unterwegs' | 'ankunft' | 'geliefert';

interface OrderData {
  id: string;
  status: string;
  bestellt_am?: string | null;
  geschaetzte_lieferzeit_min?: number | null;
  eta?: string | null;
  fahrer_name?: string | null;
  track_url?: string | null;
}

const PHASES: { key: Phase; label: string; icon: React.ElementType }[] = [
  { key: 'bestellt',  label: 'Bestellt',     icon: CheckCircle2 },
  { key: 'kueche',    label: 'Küche',         icon: ChefHat },
  { key: 'unterwegs', label: 'Unterwegs',     icon: Bike },
  { key: 'ankunft',   label: 'Fast da!',      icon: Home },
  { key: 'geliefert', label: 'Geliefert',     icon: CheckCircle2 },
];

function statusToPhase(status: string): Phase {
  switch (status) {
    case 'pending':
    case 'bestätigt':       return 'bestellt';
    case 'in_zubereitung':  return 'kueche';
    case 'fertig':
    case 'picked_up':
    case 'unterwegs':       return 'unterwegs';
    case 'fast_da':         return 'ankunft';
    case 'geliefert':
    case 'abgeschlossen':   return 'geliefert';
    default:                return 'bestellt';
  }
}

function phaseIndex(p: Phase): number {
  return PHASES.findIndex(ph => ph.key === p);
}

function etaLabel(eta?: string | null, prepMin?: number | null, orderedAt?: string | null): string {
  if (eta) {
    const diffMin = Math.round((new Date(eta).getTime() - Date.now()) / 60_000);
    if (diffMin <= 0) return 'Jeden Moment';
    return `~${diffMin} Min`;
  }
  if (prepMin && orderedAt) {
    const arrival = new Date(orderedAt).getTime() + prepMin * 60_000;
    const diffMin = Math.round((arrival - Date.now()) / 60_000);
    if (diffMin <= 0) return 'Jeden Moment';
    return `~${diffMin} Min`;
  }
  return '—';
}

const MOCK: OrderData = {
  id: 'demo',
  status: 'in_zubereitung',
  bestellt_am: new Date(Date.now() - 8 * 60_000).toISOString(),
  geschaetzte_lieferzeit_min: 30,
  fahrer_name: 'Tobias K.',
};

export function BestellstatusLiveKarte({ orderId, locationSlug }: Props) {
  const [order, setOrder] = useState<OrderData | null>(MOCK);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!orderId) return;
    const sb = createClient();
    const fetch = () =>
      sb.from('orders')
        .select('id,status,bestellt_am,geschaetzte_lieferzeit_min,eta,fahrer_name,track_url')
        .eq('id', orderId)
        .single()
        .then(({ data }: { data: OrderData | null }) => { if (data) setOrder(data); });
    fetch();
    const ch = sb.channel(`order-${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, fetch)
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, [orderId]);

  if (!order) return null;

  const currentPhase = statusToPhase(order.status);
  const currentIdx = phaseIndex(currentPhase);
  const isDone = currentPhase === 'geliefert';
  const eta = etaLabel(order.eta, order.geschaetzte_lieferzeit_min, order.bestellt_am);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      <div className={cn(
        'px-4 py-3 flex items-center justify-between',
        isDone ? 'bg-matcha-500' : 'bg-stone-800',
      )}>
        <span className="text-sm font-bold text-white">
          {isDone ? '✓ Lieferung erfolgreich' : 'Bestellung verfolgen'}
        </span>
        {!isDone && (
          <span className="text-xs font-semibold text-stone-300 bg-stone-700 px-2 py-0.5 rounded-full">
            ETA {eta}
          </span>
        )}
      </div>

      <div className="px-4 py-5">
        <div className="flex items-center justify-between relative">
          <div className="absolute top-3.5 left-3.5 right-3.5 h-0.5 bg-stone-100 z-0" />
          <div
            className={cn('absolute top-3.5 left-3.5 h-0.5 bg-matcha-500 z-0 transition-all duration-700')}
            style={{ width: currentIdx > 0 ? `${(currentIdx / (PHASES.length - 1)) * 100}%` : '0%' }}
          />
          {PHASES.map((phase, idx) => {
            const done = idx < currentIdx;
            const active = idx === currentIdx;
            const future = idx > currentIdx;
            const Icon = phase.icon;
            return (
              <div key={phase.key} className="flex flex-col items-center gap-1.5 z-10">
                <div className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all',
                  done  ? 'bg-matcha-500 border-matcha-500'  : '',
                  active ? 'bg-white border-matcha-500 shadow-md shadow-matcha-100' : '',
                  future ? 'bg-white border-stone-200' : '',
                )}>
                  {active && !isDone
                    ? <Loader2 className="w-3.5 h-3.5 text-matcha-600 animate-spin" />
                    : <Icon className={cn('w-3.5 h-3.5', done || (active && isDone) ? 'text-white' : active ? 'text-matcha-600' : 'text-stone-300')} />}
                </div>
                <span className={cn(
                  'text-[10px] font-medium text-center leading-tight max-w-[44px]',
                  done || active ? 'text-stone-700' : 'text-stone-300',
                )}>
                  {phase.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {order.fahrer_name && !isDone && currentPhase === 'unterwegs' && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-100 px-3 py-2">
            <Bike className="w-4 h-4 text-blue-500 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-blue-700">{order.fahrer_name} ist unterwegs</p>
              <p className="text-[11px] text-blue-500">Ankunft in {eta}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
