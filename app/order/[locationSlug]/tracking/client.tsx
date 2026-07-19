'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  ChefHat, Package, Bike, MapPin, CheckCircle2,
  Clock, Navigation2, Phone, Star, RefreshCw,
  AlertCircle, ArrowLeft, Zap, TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

type Phase = 'neu' | 'bestätigt' | 'in_zubereitung' | 'fertig' | 'abgeholt' | 'unterwegs' | 'geliefert' | 'storniert';

interface OrderData {
  id: string;
  status: Phase;
  created_at: string;
  eta_earliest: string | null;
  eta_latest: string | null;
  kunde_name: string | null;
  gesamtbetrag: number;
  adresse: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  driver_lat?: number | null;
  driver_lng?: number | null;
}

const PHASE_CONFIG: { key: Phase; label: string; icon: React.ElementType; desc: string }[] = [
  { key: 'neu',          label: 'Bestellt',      icon: Package,      desc: 'Deine Bestellung wurde empfangen' },
  { key: 'bestätigt',   label: 'Bestätigt',     icon: CheckCircle2, desc: 'Restaurant hat bestätigt' },
  { key: 'in_zubereitung', label: 'Zubereitung', icon: ChefHat,    desc: 'Dein Essen wird zubereitet' },
  { key: 'fertig',       label: 'Abholbereit',   icon: Package,      desc: 'Bereit zur Abholung' },
  { key: 'abgeholt',    label: 'Abgeholt',       icon: Bike,         desc: 'Fahrer hat abgeholt' },
  { key: 'unterwegs',   label: 'Unterwegs',      icon: Navigation2,  desc: 'Fahrer ist unterwegs' },
  { key: 'geliefert',   label: 'Geliefert',      icon: CheckCircle2, desc: 'Erfolgreich geliefert!' },
];

const ACTIVE_PHASES: Phase[] = ['neu', 'bestätigt', 'in_zubereitung', 'fertig', 'abgeholt', 'unterwegs', 'geliefert'];

function phaseIndex(status: Phase): number {
  return ACTIVE_PHASES.indexOf(status);
}

function formatEta(earliest: string | null, latest: string | null): string {
  if (!earliest) return 'Wird berechnet…';
  const e = new Date(earliest);
  const l = latest ? new Date(latest) : null;
  const fmt = (d: Date) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return l ? `${fmt(e)} – ${fmt(l)} Uhr` : `${fmt(e)} Uhr`;
}

function minutesUntil(isoStr: string | null): number | null {
  if (!isoStr) return null;
  const diff = new Date(isoStr).getTime() - Date.now();
  return Math.max(0, Math.round(diff / 60_000));
}

function secondsUntil(isoStr: string | null): number | null {
  if (!isoStr) return null;
  const diff = new Date(isoStr).getTime() - Date.now();
  return Math.max(0, Math.floor(diff / 1_000));
}

function fmtMmSs(sek: number): string {
  const m = Math.floor(sek / 60);
  const s = sek % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface Props {
  initialOrder: OrderData;
  locationSlug: string;
}

export function TrackingClient({ initialOrder, locationSlug }: Props) {
  const [order, setOrder] = useState<OrderData>(initialOrder);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [secRemain, setSecRemain] = useState<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const supabase = createClient();

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const { data } = await supabase
      .from('customer_orders')
      .select(`
        id, status, created_at, eta_earliest, eta_latest,
        kunde_name, gesamtbetrag, adresse,
        batch:mise_delivery_batches(
          driver:mise_drivers(name, telefon, last_lat, last_lng)
        )
      `)
      .eq('id', initialOrder.id)
      .single();

    if (data) {
      const batch = Array.isArray(data.batch) ? data.batch[0] : data.batch;
      const driver = batch?.driver ? (Array.isArray(batch.driver) ? batch.driver[0] : batch.driver) : null;
      setOrder({
        id: data.id,
        status: data.status as Phase,
        created_at: data.created_at,
        eta_earliest: data.eta_earliest,
        eta_latest: data.eta_latest,
        kunde_name: data.kunde_name,
        gesamtbetrag: data.gesamtbetrag,
        adresse: data.adresse,
        driver_name: driver?.name ?? null,
        driver_phone: driver?.telefon ?? null,
        driver_lat: driver?.last_lat ?? null,
        driver_lng: driver?.last_lng ?? null,
      });
      setLastUpdated(new Date());
    }
    setRefreshing(false);
  }, [initialOrder.id, supabase]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`tracking-${initialOrder.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'customer_orders',
          filter: `id=eq.${initialOrder.id}`,
        },
        () => { refresh(); },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [initialOrder.id, supabase, refresh]);

  // Auto-refresh every 30s
  useEffect(() => {
    const iv = setInterval(refresh, 30_000);
    return () => clearInterval(iv);
  }, [refresh]);

  // Second-level countdown when ETA is within 15 minutes
  useEffect(() => {
    const etaSec = secondsUntil(order.eta_earliest);
    if (etaSec !== null && etaSec <= 15 * 60 && !['geliefert', 'storniert'].includes(order.status)) {
      setSecRemain(etaSec);
      tickRef.current = setInterval(() => {
        setSecRemain(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
      }, 1_000);
    } else {
      setSecRemain(null);
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    }
    return () => { if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; } };
  }, [order.eta_earliest, order.status]);

  const currentIdx = phaseIndex(order.status);
  const isDelivered = order.status === 'geliefert';
  const isCancelled = order.status === 'storniert';
  const etaMins = minutesUntil(order.eta_earliest);
  const isOnTheWay = ['abgeholt', 'unterwegs'].includes(order.status);

  return (
    <div className="min-h-screen bg-matcha-50/30">
      {/* Header */}
      <div className="bg-matcha-900 text-white px-4 pt-safe-top">
        <div className="max-w-lg mx-auto pb-5 pt-3">
          <div className="flex items-center gap-3 mb-4">
            <Link
              href={`/order/${locationSlug}`}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="text-sm font-medium text-matcha-200">Live-Tracking</span>
            <button
              onClick={refresh}
              disabled={refreshing}
              className="ml-auto flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </button>
          </div>

          {/* ETA display */}
          {!isCancelled && !isDelivered && (
            <div className="text-center mb-2">
              {secRemain !== null && secRemain <= 15 * 60 ? (
                <>
                  <div className="flex items-baseline justify-center gap-1">
                    <div className={cn(
                      'font-mono text-5xl font-black tabular-nums mb-1',
                      secRemain <= 120 ? 'animate-pulse text-yellow-300' : 'text-white',
                    )}>
                      {fmtMmSs(secRemain)}
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-1.5 text-matcha-300 text-sm">
                    <Zap className="h-3.5 w-3.5 text-yellow-400" />
                    Echtzeit-Countdown
                  </div>
                </>
              ) : etaMins !== null && etaMins > 0 ? (
                <>
                  <div className="text-5xl font-bold tabular-nums mb-1">{etaMins}</div>
                  <div className="text-matcha-300 text-sm">Minuten noch</div>
                </>
              ) : (
                <div className="text-2xl font-semibold text-matcha-100">Gleich da!</div>
              )}
              <div className="text-matcha-400 text-xs mt-1">{formatEta(order.eta_earliest, order.eta_latest)}</div>
            </div>
          )}

          {isDelivered && (
            <div className="text-center py-2">
              <div className="text-4xl mb-1">🎉</div>
              <div className="text-xl font-semibold">Geliefert!</div>
              <div className="text-matcha-300 text-sm mt-1">Guten Appetit!</div>
            </div>
          )}

          {isCancelled && (
            <div className="text-center py-2">
              <AlertCircle className="h-10 w-10 mx-auto text-red-400 mb-2" />
              <div className="text-xl font-semibold">Storniert</div>
              <div className="text-matcha-300 text-sm mt-1">Diese Bestellung wurde storniert</div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Progress timeline */}
        {!isCancelled && (
          <div className="bg-white rounded-2xl border border-matcha-100 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-matcha-700 mb-4 uppercase tracking-wide">Bestellstatus</h2>
            <div className="space-y-0">
              {PHASE_CONFIG.filter(p => p.key !== 'storniert').map((phase, idx) => {
                const done = idx < currentIdx;
                const active = idx === currentIdx;
                const upcoming = idx > currentIdx;
                const Icon = phase.icon;
                const isLast = idx === PHASE_CONFIG.length - 1;

                return (
                  <div key={phase.key} className="flex gap-3">
                    {/* Icon column */}
                    <div className="flex flex-col items-center">
                      <div
                        className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-500',
                          done && 'border-matcha-500 bg-matcha-500 text-white',
                          active && 'border-matcha-500 bg-white text-matcha-600 shadow-md shadow-matcha-100',
                          upcoming && 'border-matcha-200 bg-matcha-50 text-matcha-300',
                        )}
                      >
                        {active ? (
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-matcha-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-matcha-500" />
                          </span>
                        ) : (
                          <Icon className="h-4 w-4" />
                        )}
                      </div>
                      {!isLast && (
                        <div className={cn(
                          'w-0.5 flex-1 my-1 min-h-[1.5rem] transition-colors duration-500',
                          done ? 'bg-matcha-400' : 'bg-matcha-100',
                        )} />
                      )}
                    </div>

                    {/* Text column */}
                    <div className={cn('pb-4', isLast && 'pb-0')}>
                      <p className={cn(
                        'text-sm font-semibold',
                        done && 'text-matcha-600',
                        active && 'text-matcha-800',
                        upcoming && 'text-matcha-300',
                      )}>
                        {phase.label}
                      </p>
                      {active && (
                        <p className="text-xs text-matcha-500 mt-0.5">{phase.desc}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Driver info */}
        {isOnTheWay && order.driver_name && (
          <div className="bg-white rounded-2xl border border-matcha-100 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Proximity pulse ring */}
                <div className="relative h-12 w-12 shrink-0">
                  {secRemain !== null && secRemain <= 10 * 60 && (
                    <>
                      <span className="absolute inset-0 rounded-full bg-matcha-400 opacity-20 animate-ping" />
                      <span className="absolute inset-1 rounded-full bg-matcha-300 opacity-30 animate-ping" style={{ animationDelay: '0.3s' }} />
                    </>
                  )}
                  <div className="relative h-12 w-12 rounded-full bg-matcha-100 flex items-center justify-center">
                    <Bike className="h-6 w-6 text-matcha-600" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-matcha-800">{order.driver_name}</p>
                  <p className="text-xs text-matcha-500">
                    {secRemain !== null && secRemain <= 10 * 60 ? '🚀 Fast da!' : 'Dein Fahrer'}
                  </p>
                </div>
              </div>
              {order.driver_phone && (
                <a
                  href={`tel:${order.driver_phone}`}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-matcha-50 text-matcha-700 text-sm font-medium hover:bg-matcha-100 transition-colors"
                >
                  <Phone className="h-4 w-4" />
                  Anrufen
                </a>
              )}
            </div>
          </div>
        )}

        {/* Delivery address */}
        {order.adresse && (
          <div className="bg-white rounded-2xl border border-matcha-100 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <MapPin className="h-4 w-4 text-matcha-500" />
              </div>
              <div>
                <p className="text-xs text-matcha-500 mb-0.5">Lieferadresse</p>
                <p className="text-sm font-medium text-matcha-800">{order.adresse}</p>
              </div>
            </div>
          </div>
        )}

        {/* ETA detail + Dynamische Fortschrittsanzeige */}
        {!isCancelled && !isDelivered && (
          <div className="bg-white rounded-2xl border border-matcha-100 p-4 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <Clock className="h-4 w-4 text-matcha-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-matcha-500 mb-0.5">Voraussichtliche Ankunft</p>
                <p className="text-sm font-semibold text-matcha-800">{formatEta(order.eta_earliest, order.eta_latest)}</p>
              </div>
              {etaMins !== null && etaMins > 0 && (
                <div className="flex items-center gap-1 text-xs font-semibold text-matcha-600">
                  <TrendingUp className="h-3.5 w-3.5" />
                  {etaMins} min
                </div>
              )}
            </div>
            {/* Dynamische ETA-Fortschrittsleiste */}
            {order.eta_earliest && order.created_at && (
              (() => {
                const totalMs = new Date(order.eta_earliest).getTime() - new Date(order.created_at).getTime();
                const elapsedMs = Date.now() - new Date(order.created_at).getTime();
                const pct = totalMs > 0 ? Math.min(100, Math.max(0, Math.round((elapsedMs / totalMs) * 100))) : 0;
                const isLate = pct >= 100;
                return (
                  <div>
                    <div className="flex justify-between text-[10px] text-matcha-400 mb-1">
                      <span>Bestellt</span>
                      <span className={cn(isLate ? 'text-amber-500 font-semibold' : 'text-matcha-400')}>
                        {isLate ? 'Gleich da!' : `${pct}%`}
                      </span>
                      <span>Ankunft</span>
                    </div>
                    <div className="h-2 rounded-full bg-matcha-100 overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-1000',
                          isLate ? 'bg-amber-400 animate-pulse' : 'bg-matcha-500'
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        )}

        {/* Order summary */}
        <div className="bg-white rounded-2xl border border-matcha-100 p-4 shadow-sm">
          <h3 className="text-xs font-semibold text-matcha-500 uppercase tracking-wide mb-3">Bestelldetails</h3>
          <div className="flex justify-between items-center">
            <span className="text-sm text-matcha-600">Bestellnummer</span>
            <span className="text-xs font-mono text-matcha-400">{order.id.slice(0, 8).toUpperCase()}</span>
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-sm text-matcha-600">Gesamtbetrag</span>
            <span className="text-sm font-semibold text-matcha-800">
              {(order.gesamtbetrag / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
            </span>
          </div>
        </div>

        {/* Post-delivery rating prompt */}
        {isDelivered && (
          <div className="bg-matcha-800 text-white rounded-2xl p-5 text-center shadow-sm">
            <Star className="h-8 w-8 mx-auto mb-2 text-yellow-400 fill-yellow-400" />
            <p className="font-semibold mb-1">Wie war dein Essen?</p>
            <p className="text-sm text-matcha-300 mb-4">Dein Feedback hilft uns, besser zu werden.</p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  className="flex items-center justify-center h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-yellow-400 transition-colors"
                  onClick={() => {}} // future: submit rating
                >
                  <Star className={cn('h-5 w-5', n >= 4 && 'fill-yellow-400')} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Last updated */}
        <p className="text-center text-xs text-matcha-400">
          Zuletzt aktualisiert: {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </p>
      </div>
    </div>
  );
}
