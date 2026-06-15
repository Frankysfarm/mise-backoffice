'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  Check, ChefHat, Clock, Bike, Package, Star, Bell, MapPin, Zap,
} from 'lucide-react';

type OrderStatus = 'neu' | 'bestätigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert';

const STATUS_STEPS: {
  status: OrderStatus;
  label: string;
  icon: React.ElementType;
  emoji: string;
  color: string;
  bgColor: string;
}[] = [
  { status: 'bestätigt',      label: 'Bestätigt',   icon: Check,    emoji: '✅', color: 'text-green-600',  bgColor: 'bg-green-100' },
  { status: 'in_zubereitung', label: 'Wird zubereitet', icon: ChefHat,  emoji: '🍳', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  { status: 'fertig',         label: 'Bereit',      icon: Package,  emoji: '📦', color: 'text-blue-600',   bgColor: 'bg-blue-100' },
  { status: 'unterwegs',      label: 'Unterwegs',   icon: Bike,     emoji: '🚴', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  { status: 'geliefert',      label: 'Geliefert!',  icon: Star,     emoji: '⭐', color: 'text-matcha-700', bgColor: 'bg-matcha-100' },
];

const STATUS_ORDER: OrderStatus[] = ['bestätigt', 'in_zubereitung', 'fertig', 'unterwegs', 'geliefert'];

function formatCountdown(isoStr: string): string {
  const secs = Math.max(0, Math.floor((new Date(isoStr).getTime() - Date.now()) / 1000));
  if (secs === 0) return 'Gleich!';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')} Min` : `${s} Sek`;
}

interface Props {
  orderId: string;
  bestellnummer: string;
  initialStatus?: string;
  initialEtaEarliest?: string | null;
  initialEtaLatest?: string | null;
  isDelivery?: boolean;
}

export function BestellungStatusBand({
  orderId,
  bestellnummer,
  initialStatus = 'bestätigt',
  initialEtaEarliest,
  initialEtaLatest,
  isDelivery = true,
}: Props) {
  const [status, setStatus] = useState<string>(initialStatus);
  const [etaEarliest, setEtaEarliest] = useState<string | null>(initialEtaEarliest ?? null);
  const [, setTick] = useState(0);
  const [driverName, setDriverName] = useState<string | null>(null);
  const [stopsBefore, setStopsBefore] = useState<number | null>(null);
  const supabase = createClient();

  // 1-second ticker for countdown
  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  // Realtime subscription
  useEffect(() => {
    const ch = supabase
      .channel(`status-band-${orderId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'customer_orders',
        filter: `id=eq.${orderId}`,
      }, (payload: { new: Record<string, unknown> }) => {
        const r = payload.new;
        if (r.status) setStatus(r.status as string);
        if (r.eta_earliest) setEtaEarliest(r.eta_earliest as string);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // Fetch driver info when unterwegs
  useEffect(() => {
    if (status !== 'unterwegs') return;
    supabase
      .from('delivery_batch_stops')
      .select('reihenfolge, batch:delivery_batches(fahrer:employees(vorname, nachname))')
      .eq('order_id', orderId)
      .maybeSingle()
      .then(({ data }: { data: any }) => {
        if (data?.batch?.fahrer) {
          setDriverName(`${data.batch.fahrer.vorname} ${data.batch.fahrer.nachname.charAt(0)}.`);
        }
        if (data?.reihenfolge != null) setStopsBefore(Math.max(0, data.reihenfolge - 1));
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, orderId]);

  const currentIdx = STATUS_ORDER.indexOf(status as OrderStatus);
  const isDelivered = status === 'geliefert';
  const activeSteps = isDelivery ? STATUS_STEPS : STATUS_STEPS.filter(s => s.status !== 'unterwegs' && s.status !== 'geliefert');

  const currentStep = STATUS_STEPS.find(s => s.status === status);
  const progressPct = isDelivered ? 100 : Math.round((Math.max(0, currentIdx) / (STATUS_ORDER.length - 1)) * 100);

  // ETA countdown
  const etaLabel = (() => {
    if (isDelivered) return null;
    if (etaEarliest) {
      const t = new Date(etaEarliest).getTime();
      if (t > Date.now()) return formatCountdown(etaEarliest);
      return 'Gleich da!';
    }
    return null;
  })();

  return (
    <div className={cn(
      'rounded-2xl border overflow-hidden shadow-sm',
      isDelivered ? 'border-matcha-300 bg-matcha-50' : 'border-gray-200 bg-white',
    )}>
      {/* Top Banner */}
      <div className={cn(
        'px-4 py-3 flex items-center gap-3',
        isDelivered ? 'bg-matcha-600' :
        status === 'unterwegs' ? 'bg-purple-600' :
        status === 'in_zubereitung' ? 'bg-orange-500' :
        status === 'fertig' ? 'bg-blue-600' :
        'bg-gray-700',
      )}>
        <span className="text-2xl">{currentStep?.emoji ?? '📋'}</span>
        <div className="flex-1 min-w-0">
          <div className="text-white font-black text-base leading-tight">
            {isDelivered ? 'Deine Bestellung ist angekommen!' :
             currentStep?.label ?? status}
          </div>
          <div className="text-white/70 text-xs mt-0.5 truncate">
            Bestellung #{bestellnummer.slice(-6)}
          </div>
        </div>
        {etaLabel && (
          <div className="shrink-0 text-right">
            <div className="text-white/70 text-[9px] uppercase tracking-wide">noch ca.</div>
            <div className="text-white font-black text-lg tabular-nums leading-tight">{etaLabel}</div>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="h-1.5 bg-gray-200">
        <div
          className={cn(
            'h-full transition-all duration-1000',
            isDelivered ? 'bg-matcha-500' :
            status === 'unterwegs' ? 'bg-purple-500' :
            status === 'in_zubereitung' ? 'bg-orange-500' :
            'bg-blue-500',
          )}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Steps */}
      <div className="px-4 py-4">
        <div className="flex items-start">
          {activeSteps.map((step, idx) => {
            const stepIdx = STATUS_ORDER.indexOf(step.status);
            const done   = stepIdx < currentIdx || isDelivered;
            const active = stepIdx === currentIdx && !isDelivered;
            const isLast = idx === activeSteps.length - 1;
            const Icon   = step.icon;

            return (
              <div key={step.status} className="flex flex-col items-center flex-1">
                <div className="flex items-center w-full">
                  {idx > 0 && (
                    <div className={cn('h-0.5 flex-1 transition-colors duration-700',
                      done || active ? step.color.replace('text-', 'bg-') : 'bg-gray-200')} />
                  )}
                  <div className={cn(
                    'h-8 w-8 rounded-full flex items-center justify-center border-2 shrink-0 transition-all duration-300',
                    done   ? `${step.bgColor} border-current ${step.color}` :
                    active ? `bg-white border-current ${step.color} ring-4 ring-current ring-opacity-20` :
                             'bg-gray-100 border-gray-200 text-gray-400',
                    active && 'animate-pulse',
                  )}>
                    {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  </div>
                  {!isLast && (
                    <div className={cn('h-0.5 flex-1 transition-colors duration-700',
                      done ? step.color.replace('text-', 'bg-') : 'bg-gray-200')} />
                  )}
                </div>
                <div className={cn(
                  'mt-1.5 text-center text-[9px] font-bold px-0.5 leading-tight',
                  done   ? step.color :
                  active ? `${step.color} font-black` :
                           'text-gray-400',
                )}>
                  {step.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Driver Info (unterwegs) */}
      {status === 'unterwegs' && (
        <div className="border-t border-purple-100 bg-purple-50 px-4 py-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-purple-200 flex items-center justify-center shrink-0">
            <Bike className="h-4 w-4 text-purple-700" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-purple-900">
              {driverName ?? 'Fahrer'} bringt deine Bestellung
            </div>
            {stopsBefore !== null && stopsBefore > 0 && (
              <div className="flex items-center gap-1 text-xs text-purple-600 mt-0.5">
                <MapPin className="h-3 w-3" />
                {stopsBefore} {stopsBefore === 1 ? 'Lieferung' : 'Lieferungen'} vor dir
              </div>
            )}
            {stopsBefore === 0 && (
              <div className="flex items-center gap-1 text-xs text-purple-700 font-bold mt-0.5">
                <Zap className="h-3 w-3" />
                Du bist als nächstes dran!
              </div>
            )}
          </div>
          <div className="h-2.5 w-2.5 rounded-full bg-purple-500 animate-pulse shrink-0" />
        </div>
      )}

      {/* Delivered Success */}
      {isDelivered && (
        <div className="border-t border-matcha-200 bg-matcha-50 px-4 py-3 flex items-center gap-3">
          <Star className="h-5 w-5 text-matcha-600 shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-bold text-matcha-800">Guten Appetit! 🎉</div>
            <div className="text-xs text-matcha-600">Wie war deine Erfahrung? Bitte bewerte deine Bestellung.</div>
          </div>
        </div>
      )}

      {/* ETA Window */}
      {etaEarliest && !isDelivered && initialEtaLatest && (
        <div className="border-t bg-gray-50 px-4 py-2.5 flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          <span className="text-xs text-gray-500">
            Lieferfenster: {' '}
            <span className="font-semibold text-gray-700">
              {new Date(etaEarliest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              {initialEtaLatest ? ` – ${new Date(initialEtaLatest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : ''}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
