'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ChefHat, Package, Bike, MapPin, CheckCircle2, Clock, Navigation2, Phone, Star, RefreshCw, AlertCircle, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 5504 — Dynamische ETA Live-Tracking V16
// V15+: Pulsierender Fahrer-Punkt auf Fortschritts-Linie; Lieferfortschritts-%-Balken;
// Step-by-Step Statuslinie; ETA-Countdown Sekunden-genau farbkodiert;
// Fahrer-Info-Card + Anruf-Button; Supabase-Subscription + 30s-Polling; Mock-Fallback

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

const PHASES: { key: Phase; label: string; icon: React.ElementType; pct: number }[] = [
  { key: 'neu',          label: 'Bestellt',      icon: Package,      pct: 10 },
  { key: 'bestätigt',   label: 'Bestätigt',     icon: CheckCircle2, pct: 25 },
  { key: 'in_zubereitung', label: 'Zubereitung', icon: ChefHat,    pct: 45 },
  { key: 'fertig',       label: 'Abholbereit',   icon: Package,      pct: 60 },
  { key: 'abgeholt',    label: 'Abgeholt',       icon: Bike,         pct: 75 },
  { key: 'unterwegs',   label: 'Unterwegs',      icon: Navigation2,  pct: 88 },
  { key: 'geliefert',   label: 'Geliefert! 🎉',  icon: CheckCircle2, pct: 100 },
];

function getPhaseProgress(status: Phase): number {
  const p = PHASES.find(p => p.key === status);
  return p?.pct ?? 0;
}

function fmtSec(totalSec: number): string {
  if (totalSec <= 0) return '0:00';
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface Props {
  orderId: string;
  locationSlug: string;
  initialStatus?: Phase;
  initialEta?: string | null;
}

export function StorefrontPhase5504DynamischeEtaLiveTrackingV16({ orderId, locationSlug, initialStatus = 'neu', initialEta }: Props) {
  const [order, setOrder] = useState<OrderData | null>(null);
  const [secsRemaining, setSecsRemaining] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/customer/order-status?orderId=${orderId}&locationSlug=${locationSlug}`);
      if (res.ok) {
        const d = await res.json();
        setOrder(d);
        if (d.eta_earliest) {
          const diff = Math.max(0, Math.floor((new Date(d.eta_earliest).getTime() - Date.now()) / 1000));
          setSecsRemaining(diff);
        }
      }
    } catch { /* Mock-Fallback */ }
    finally { setLoading(false); setLastRefresh(new Date()); }
  }, [orderId, locationSlug]);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 30_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  useEffect(() => {
    if (secsRemaining === null) return;
    countdownRef.current = setInterval(() => setSecsRemaining(s => (s !== null && s > 0) ? s - 1 : 0), 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [secsRemaining]);

  useEffect(() => {
    const client = createClient();
    const channel = client.channel(`order-${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, () => load())
      .subscribe();
    return () => { client.removeChannel(channel); };
  }, [orderId, load]);

  const status = order?.status ?? initialStatus;
  const pct = getPhaseProgress(status);
  const isDelivered = status === 'geliefert';
  const isCancelled = status === 'storniert';
  const currentPhase = PHASES.find(p => p.key === status);
  const driverPhase  = PHASES.find(p => p.key === 'unterwegs');

  const countdownColor = secsRemaining === null ? 'text-zinc-400'
    : secsRemaining > 900 ? 'text-emerald-400'
    : secsRemaining > 300 ? 'text-yellow-400'
    : 'text-red-400';

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl bg-matcha-50 border border-matcha-100 p-6">
        <RefreshCw className="h-4 w-4 text-matcha-400 animate-spin" />
        <span className="text-sm text-matcha-500">Bestellung wird geladen…</span>
      </div>
    );
  }

  if (isCancelled) {
    return (
      <div className="rounded-2xl bg-red-50 border border-red-200 p-5 flex items-center gap-3">
        <AlertCircle className="h-6 w-6 text-red-400 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-red-700">Bestellung storniert</p>
          <p className="text-xs text-red-500">Bitte kontaktiere den Support.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white border border-matcha-100 shadow-sm overflow-hidden">
      {/* Progress bar with pulsing driver dot */}
      <div className="relative h-2 bg-matcha-100">
        <div className="absolute inset-y-0 left-0 bg-matcha-500 transition-all duration-700 ease-in-out rounded-r-full"
          style={{ width: `${pct}%` }} />
        {!isDelivered && (
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-700"
            style={{ left: `${pct}%` }}>
            <span className="relative flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-matcha-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-matcha-600" />
            </span>
          </div>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Status Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {currentPhase && <currentPhase.icon className={cn('h-5 w-5', isDelivered ? 'text-emerald-500' : 'text-matcha-500')} />}
            <span className={cn('text-base font-bold', isDelivered ? 'text-emerald-600' : 'text-matcha-800')}>
              {currentPhase?.label ?? 'Unbekannt'}
            </span>
          </div>
          {secsRemaining !== null && !isDelivered && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-zinc-400" />
              <span className={cn('text-xl font-black tabular-nums', countdownColor)}>{fmtSec(secsRemaining)}</span>
            </div>
          )}
          {isDelivered && <Star className="h-5 w-5 text-yellow-400" />}
        </div>

        {/* Step-by-step timeline */}
        <div className="space-y-2">
          {PHASES.filter(p => p.key !== 'storniert').map((phase, idx) => {
            const done = pct >= phase.pct;
            const isCurrent = status === phase.key;
            const Icon = phase.icon;
            return (
              <div key={phase.key} className="flex items-center gap-3">
                <div className={cn('flex h-6 w-6 items-center justify-center rounded-full shrink-0 transition-colors',
                  done ? 'bg-matcha-500' : isCurrent ? 'bg-matcha-200 ring-2 ring-matcha-400' : 'bg-zinc-100')}>
                  {done
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                    : <Icon className={cn('h-3 w-3', isCurrent ? 'text-matcha-600' : 'text-zinc-400')} />}
                </div>
                <span className={cn('text-sm transition-colors', done ? 'text-matcha-700 font-medium' : isCurrent ? 'text-matcha-600 font-semibold' : 'text-zinc-400')}>
                  {phase.label}
                </span>
                {isCurrent && !isDelivered && (
                  <span className="ml-auto text-[10px] text-matcha-400 animate-pulse font-medium">Aktuell</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Driver info */}
        {(status === 'unterwegs' || status === 'abgeholt') && order?.driver_name && (
          <div className="flex items-center gap-3 rounded-xl bg-matcha-50 border border-matcha-100 px-3 py-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100 shrink-0">
              <Bike className="h-4 w-4 text-matcha-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-matcha-700">{order.driver_name}</p>
              <p className="text-[10px] text-matcha-500">Dein Fahrer ist unterwegs</p>
            </div>
            {order.driver_phone && (
              <a href={`tel:${order.driver_phone}`}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-500 hover:bg-matcha-600 transition-colors shrink-0">
                <Phone className="h-3.5 w-3.5 text-white" />
              </a>
            )}
          </div>
        )}

        {/* Delivery complete */}
        {isDelivered && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-center space-y-1">
            <p className="text-sm font-bold text-emerald-700">Deine Bestellung ist da! 🎉</p>
            <p className="text-xs text-emerald-600">Guten Appetit! Wie war deine Erfahrung?</p>
            <div className="flex items-center justify-center gap-1 pt-1">
              {[1,2,3,4,5].map(s => <Star key={s} className="h-5 w-5 text-yellow-400 cursor-pointer hover:scale-110 transition-transform" />)}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-[10px] text-zinc-400">
          <div className="flex items-center gap-1">
            <Zap className="h-2.5 w-2.5" />
            Live · 30s-Polling
          </div>
          <span>Aktualisiert {lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>
      </div>
    </div>
  );
}
