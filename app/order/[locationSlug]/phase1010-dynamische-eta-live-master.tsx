'use client';

/**
 * Phase 1010 — Dynamische ETA Live Master
 * Kundenansicht: Echtzeit-Lieferstatus-Timeline + Countdown + Fahrer-Annäherungs-Indikator
 * Polling: 20 Sek. + 1-Sek-Tick
 */

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Bike, CheckCircle2, ChefHat, Clock, MapPin, Package, Zap } from 'lucide-react';

type OrderStatus =
  | 'neu' | 'bestätigt' | 'in_zubereitung' | 'fertig'
  | 'abgeholt' | 'unterwegs' | 'geliefert' | 'storniert';

interface Props {
  orderId?: string | null;
  locationId?: string | null;
  initialStatus?: OrderStatus | null;
  initialEtaMin?: number | null;
  driverName?: string | null;
  className?: string;
}

interface TrackData {
  status: OrderStatus;
  etaMin: number | null;
  etaAt: string | null;
  driverName: string | null;
  prepMin: number | null;
  bestellt_am: string | null;
}

type Step = { key: OrderStatus; label: string; icon: React.ReactNode };

const STEPS: Step[] = [
  { key: 'neu',          label: 'Bestellt',    icon: <Package className="h-4 w-4" /> },
  { key: 'in_zubereitung', label: 'Küche',     icon: <ChefHat className="h-4 w-4" /> },
  { key: 'fertig',       label: 'Fertig',       icon: <Zap className="h-4 w-4" /> },
  { key: 'unterwegs',   label: 'Unterwegs',    icon: <Bike className="h-4 w-4" /> },
  { key: 'geliefert',   label: 'Geliefert',    icon: <CheckCircle2 className="h-4 w-4" /> },
];

const STATUS_ORDER: OrderStatus[] = ['neu', 'bestätigt', 'in_zubereitung', 'fertig', 'abgeholt', 'unterwegs', 'geliefert'];

function stepIndex(status: OrderStatus): number {
  if (status === 'bestätigt') return 0;
  if (status === 'in_zubereitung') return 1;
  if (status === 'fertig') return 2;
  if (status === 'abgeholt' || status === 'unterwegs') return 3;
  if (status === 'geliefert') return 4;
  return 0;
}

function secsLeft(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
}

function fmtMmSs(secs: number): string {
  const abs = Math.abs(secs);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function StorefrontPhase1010DynamischeEtaLiveMaster({
  orderId,
  locationId,
  initialStatus,
  initialEtaMin,
  driverName: initDriver,
  className,
}: Props) {
  const supabase = createClient();
  const [data, setData] = useState<TrackData>({
    status: initialStatus ?? 'neu',
    etaMin: initialEtaMin ?? null,
    etaAt: initialEtaMin ? new Date(Date.now() + initialEtaMin * 60_000).toISOString() : null,
    driverName: initDriver ?? null,
    prepMin: null,
    bestellt_am: null,
  });
  const [tick, setTick] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    if (!orderId) return;
    const { data: o } = await supabase
      .from('customer_orders')
      .select(`
        status, eta_earliest, geschaetzte_zubereitung_min, bestellt_am,
        batch:mise_delivery_batches(driver:mise_drivers(name))
      `)
      .eq('id', orderId)
      .single();
    if (!o) return;
    const batch = Array.isArray(o.batch) ? o.batch[0] : o.batch;
    const driver = batch?.driver ? (Array.isArray(batch.driver) ? batch.driver[0] : batch.driver) : null;
    setData({
      status: o.status as OrderStatus,
      etaMin: o.eta_earliest ? Math.max(0, Math.round(secsLeft(o.eta_earliest)! / 60)) : null,
      etaAt: o.eta_earliest ?? null,
      driverName: driver?.name ?? null,
      prepMin: o.geschaetzte_zubereitung_min ?? null,
      bestellt_am: o.bestellt_am ?? null,
    });
  }

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 20_000);
    tickRef.current = setInterval(() => setTick((t) => t + 1), 1_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const currentStep = stepIndex(data.status);
  const isDelivered = data.status === 'geliefert';
  const isOnTheWay = data.status === 'unterwegs' || data.status === 'abgeholt';
  const secs = secsLeft(data.etaAt);
  const isLate = secs !== null && secs < 0 && !isDelivered;
  const etaColor = isLate ? 'text-red-600' : isOnTheWay ? 'text-blue-600' : 'text-stone-700';

  return (
    <div className={cn('rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm', className)}>
      {/* Header */}
      <div className={cn(
        'px-4 py-3 flex items-center gap-3',
        isDelivered ? 'bg-green-600' : isOnTheWay ? 'bg-blue-600' : 'bg-stone-800'
      )}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-white">
          {isDelivered ? <CheckCircle2 className="h-5 w-5" /> : isOnTheWay ? <Bike className="h-5 w-5" /> : <ChefHat className="h-5 w-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
            {isDelivered ? 'Geliefert!' : isOnTheWay ? 'Dein Fahrer ist unterwegs' : 'Deine Bestellung wird zubereitet'}
          </div>
          <div className="text-base font-black text-white leading-tight">
            {isDelivered
              ? 'Guten Appetit!'
              : data.driverName
              ? `Fahrer: ${data.driverName}`
              : 'Live-Tracking aktiv'}
          </div>
        </div>
        {!isDelivered && data.etaAt && (
          <div className="shrink-0 text-right">
            <div className="text-[10px] text-white/70">ETA</div>
            <div className={cn('font-mono text-lg font-black tabular-nums text-white leading-none', isLate && 'text-red-200')}>
              {secs !== null ? (isLate ? `+${fmtMmSs(secs)}` : fmtMmSs(secs)) : `${data.etaMin ?? '?'} Min`}
            </div>
          </div>
        )}
      </div>

      {/* Step timeline */}
      <div className="px-4 py-4">
        <div className="relative flex items-start justify-between">
          {/* Connector line */}
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-stone-100" />
          <div
            className={cn('absolute top-4 left-4 h-0.5 transition-all duration-700',
              isDelivered ? 'bg-green-500' : 'bg-blue-500'
            )}
            style={{ width: `${Math.min(100, (currentStep / (STEPS.length - 1)) * 100)}%` }}
          />

          {STEPS.map((step, i) => {
            const done = i < currentStep;
            const active = i === currentStep;
            return (
              <div key={step.key} className="relative flex flex-col items-center gap-1.5" style={{ zIndex: 1 }}>
                <div className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all',
                  done ? 'border-green-500 bg-green-500 text-white' :
                  active ? 'border-blue-500 bg-blue-500 text-white shadow-lg shadow-blue-500/30' :
                  'border-stone-200 bg-white text-stone-400'
                )}>
                  {step.icon}
                </div>
                <span className={cn(
                  'text-[10px] font-semibold text-center leading-tight',
                  done ? 'text-green-600' : active ? 'text-blue-600' : 'text-stone-400'
                )}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ETA detail row */}
      {!isDelivered && (
        <div className="border-t border-stone-100 px-4 py-2.5 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
            <Clock className="h-3.5 w-3.5" />
            {isLate
              ? <span className="text-red-600 font-semibold">Lieferung überfällig</span>
              : <span>Geschätzte Ankunft</span>
            }
          </div>
          <div className={cn('text-sm font-bold tabular-nums', etaColor)}>
            {data.etaMin !== null ? `ca. ${data.etaMin} Min` : '—'}
          </div>
        </div>
      )}

      {isDelivered && (
        <div className="border-t border-green-100 px-4 py-2.5 flex items-center gap-2 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span className="text-sm font-medium text-green-700">Bestellung wurde geliefert</span>
        </div>
      )}
    </div>
  );
}
