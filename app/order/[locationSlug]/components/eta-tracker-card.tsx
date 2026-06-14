'use client';

/**
 * EtaTrackerCard — Erweiterter Lieferstatus mit Meilensteinen
 *
 * Zeigt Live-Tracking mit:
 * - Aktueller Stufe + Fortschrittsbalken
 * - Echtzeit-Countdown bis zur Lieferung
 * - Fahrername wenn unterwegs
 * - Ampel für Lieferzuverlässigkeit
 *
 * Ergänzt DynamicEtaProgress durch Echtzeit-Subscription
 * und Fahrer-Informationen.
 *
 * Pollt Supabase direkt auf order-Änderungen.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Bike, Check, ChefHat, Clock, MapPin, Package, Truck, Zap } from 'lucide-react';

type OrderStatus = 'neu' | 'bestätigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert';

interface Props {
  orderId: string;
  bestellnummer: string;
  initialStatus?: string;
  initialEtaEarliest?: string | null;
  initialEtaLatest?: string | null;
  isDelivery?: boolean;
  defaultPrepMin?: number;
  defaultDeliveryMin?: number;
}

const STEPS = [
  { status: 'bestätigt',      label: 'Bestätigt',   icon: Check,    color: 'bg-matcha-500 border-matcha-600' },
  { status: 'in_zubereitung', label: 'Zubereitung', icon: ChefHat,  color: 'bg-orange-500 border-orange-600' },
  { status: 'fertig',         label: 'Bereit',      icon: Package,  color: 'bg-blue-500 border-blue-600' },
  { status: 'unterwegs',      label: 'Unterwegs',   icon: Truck,    color: 'bg-purple-500 border-purple-600' },
  { status: 'geliefert',      label: 'Geliefert',   icon: Check,    color: 'bg-matcha-500 border-matcha-600' },
] as const;

const STATUS_ORDER: string[] = ['bestätigt', 'in_zubereitung', 'fertig', 'unterwegs', 'geliefert'];

function fmtCountdown(iso: string): string {
  const secs = Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
  if (secs <= 0) return 'in Kürze';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m > 0) return `${m}:${String(s).padStart(2, '0')} Min`;
  return `${s} Sek`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function EtaTrackerCard({
  orderId,
  bestellnummer,
  initialStatus = 'bestätigt',
  initialEtaEarliest,
  initialEtaLatest,
  isDelivery = true,
  defaultPrepMin = 20,
  defaultDeliveryMin = 35,
}: Props) {
  const [status, setStatus]           = useState(initialStatus);
  const [etaEarliest, setEtaEarliest] = useState(initialEtaEarliest ?? null);
  const [etaLatest, setEtaLatest]     = useState(initialEtaLatest ?? null);
  const [driverName, setDriverName]   = useState<string | null>(null);
  const [stopsBefore, setStopsBefore] = useState<number | null>(null);
  const [, setTick]                   = useState(0);
  const supabase = createClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Live-Ticker
  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 10_000);
    return () => clearInterval(iv);
  }, []);

  // Supabase Realtime subscription
  useEffect(() => {
    const ch = supabase
      .channel(`eta-tracker-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'customer_orders', filter: `id=eq.${orderId}` },
        (payload: { new: Record<string, unknown> }) => {
          const r = payload.new;
          if (r.status) setStatus(r.status as string);
          if (r.eta_earliest) setEtaEarliest(r.eta_earliest as string);
          if (r.eta_latest)   setEtaLatest(r.eta_latest as string);
        },
      )
      .subscribe();
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // Fetch driver info when order is "unterwegs"
  useEffect(() => {
    if (status !== 'unterwegs') return;
    supabase
      .from('delivery_batch_stops')
      .select('reihenfolge, batch:delivery_batches(fahrer:employees(vorname, nachname))')
      .eq('order_id', orderId)
      .maybeSingle()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: { data: any }) => {
        const d = data;
        if (d?.batch?.fahrer) {
          setDriverName(`${d.batch.fahrer.vorname} ${d.batch.fahrer.nachname.charAt(0)}.`);
        }
        if (d?.reihenfolge) setStopsBefore(Math.max(0, d.reihenfolge - 1));
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, orderId]);

  const currentIdx  = STATUS_ORDER.indexOf(status);
  const isDelivered = status === 'geliefert';
  const activeSteps = isDelivery ? STEPS : STEPS.filter(s => s.status !== 'unterwegs' && s.status !== 'geliefert');

  // ETA label
  const etaLabel = (() => {
    if (isDelivered) return null;
    if (etaEarliest) {
      const earliest = new Date(etaEarliest).getTime();
      if (earliest > Date.now()) return fmtCountdown(etaEarliest);
      if (etaLatest) return `${fmtTime(etaEarliest)}–${fmtTime(etaLatest)}`;
    }
    return `ca. ${defaultPrepMin + (isDelivery ? defaultDeliveryMin : 0)} Min`;
  })();

  const progressPct = isDelivered ? 100 : Math.round((currentIdx / (STATUS_ORDER.length - 1)) * 100);

  return (
    <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
      {/* Header */}
      <div className={cn(
        'flex items-center justify-between px-4 py-3',
        isDelivered ? 'bg-matcha-50' : 'bg-blue-50',
      )}>
        <div className="flex items-center gap-2">
          <div className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full',
            isDelivered ? 'bg-matcha-100' : 'bg-blue-100',
          )}>
            {isDelivered
              ? <Check className="h-4 w-4 text-matcha-700" />
              : status === 'unterwegs'
              ? <Truck className="h-4 w-4 text-blue-700" />
              : status === 'in_zubereitung'
              ? <ChefHat className="h-4 w-4 text-orange-600" />
              : <Clock className="h-4 w-4 text-blue-600" />
            }
          </div>
          <div>
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
              Bestellung #{bestellnummer.slice(-6)}
            </div>
            <div className="text-sm font-black">
              {isDelivered ? 'Erfolgreich geliefert!' : STEPS.find(s => s.status === status)?.label ?? status}
            </div>
          </div>
        </div>
        {etaLabel && (
          <div className="text-right">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">
              {status === 'unterwegs' ? 'Noch ca.' : 'ETA'}
            </div>
            <div className="text-sm font-black tabular-nums text-blue-700">{etaLabel}</div>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="h-1.5 bg-muted">
        <div
          className={cn(
            'h-full transition-all duration-1000',
            isDelivered ? 'bg-matcha-500' : 'bg-blue-500',
          )}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Steps */}
      <div className="px-4 py-3">
        <div className="flex items-start gap-0">
          {activeSteps.map((step, idx) => {
            const stepIdx = STATUS_ORDER.indexOf(step.status);
            const done    = stepIdx < currentIdx || isDelivered;
            const active  = stepIdx === currentIdx && !isDelivered;
            const isLast  = idx === activeSteps.length - 1;
            const Icon    = step.icon;

            return (
              <div key={step.status} className="flex flex-col items-center flex-1">
                <div className="flex items-center w-full">
                  {idx > 0 && (
                    <div className={cn('h-0.5 flex-1', done || active ? 'bg-blue-400' : 'bg-border')} />
                  )}
                  <div className={cn(
                    'h-7 w-7 rounded-full flex items-center justify-center border-2 shrink-0',
                    done   ? 'bg-blue-500 border-blue-600 text-white' :
                    active ? 'bg-white border-blue-500 text-blue-600 ring-2 ring-blue-200' :
                             'bg-muted border-border text-muted-foreground',
                    active && 'animate-pulse',
                  )}>
                    <Icon className="h-3 w-3" />
                  </div>
                  {!isLast && (
                    <div className={cn('h-0.5 flex-1', done ? 'bg-blue-400' : 'bg-border')} />
                  )}
                </div>
                <div className={cn(
                  'mt-1 text-center text-[9px] font-bold px-0.5 leading-tight',
                  done   ? 'text-blue-600' :
                  active ? 'text-blue-700' : 'text-muted-foreground',
                )}>
                  {step.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Driver Info (wenn unterwegs) */}
      {status === 'unterwegs' && (
        <div className="border-t px-4 py-2.5 bg-purple-50 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100">
            <Bike className="h-4 w-4 text-purple-700" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-purple-800">
              {driverName ?? 'Fahrer'} ist unterwegs
            </div>
            {stopsBefore !== null && stopsBefore > 0 && (
              <div className="flex items-center gap-1 text-[11px] text-purple-600">
                <MapPin className="h-3 w-3" />
                {stopsBefore} {stopsBefore === 1 ? 'Lieferung' : 'Lieferungen'} vor dir
              </div>
            )}
            {stopsBefore === 0 && (
              <div className="flex items-center gap-1 text-[11px] text-purple-700 font-bold">
                <Zap className="h-3 w-3" />
                Nächste Lieferung bist du!
              </div>
            )}
          </div>
          <div className="h-2 w-2 rounded-full bg-purple-500 animate-pulse shrink-0" />
        </div>
      )}
    </div>
  );
}
