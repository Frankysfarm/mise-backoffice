'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  ChefHat, Clock, Zap, AlertTriangle, CheckCircle2, Navigation2,
  Flame, Timer, ArrowRight, Loader2,
} from 'lucide-react';

type CookSignal = {
  orderId: string;
  bestellnummer: string;
  kundeName: string;
  statusAktuell: string;
  prepMinEstimate: number;
  driverEtaMin: number | null;
  driverName: string | null;
  startIn: number | null; // negative = start immediately, null = no driver
  urgency: 'now' | 'soon' | 'wait' | 'ready';
};

function fmtMin(m: number): string {
  if (m <= 0) return 'sofort';
  if (m < 60) return `${Math.round(m)} Min`;
  return `${Math.floor(m / 60)}h ${Math.round(m % 60)}m`;
}

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  kunde_name: string;
  geschaetzte_zubereitung_min: number | null;
};

type Batch = {
  id: string;
  driver_id: string;
  status: string;
  started_at: string | null;
  total_eta_min: number | null;
};

type Stop = {
  batch_id: string;
  order_id: string;
  geliefert_am: string | null;
};

type Driver = {
  id: string;
  vorname: string;
  nachname: string;
  status: { ist_online: boolean; aktueller_batch_id: string | null } | null;
};

function computeSignals(
  orders: Order[],
  batches: Batch[],
  stops: Stop[],
  drivers: Driver[],
  defaultPrepMin: number,
): CookSignal[] {
  const now = Date.now();

  // Find returning drivers (underwegs batch → last stop)
  const returningDriverEtas: { driverId: string; driverName: string; etaMin: number }[] = [];
  for (const b of batches) {
    if (b.status !== 'unterwegs' && b.status !== 'on_route') continue;
    if (!b.started_at || b.total_eta_min == null) continue;
    const etaMs = new Date(b.started_at).getTime() + b.total_eta_min * 60_000;
    const etaMin = (etaMs - now) / 60_000;
    if (etaMin < 0 || etaMin > 60) continue;
    const driver = drivers.find(d => d.id === b.driver_id);
    if (!driver) continue;
    returningDriverEtas.push({
      driverId: b.driver_id,
      driverName: `${driver.vorname} ${driver.nachname[0]}.`,
      etaMin,
    });
  }

  const signals: CookSignal[] = [];
  for (const o of orders) {
    if (!['bestätigt', 'angenommen', 'in_zubereitung'].includes(o.status)) continue;
    const prepMin = o.geschaetzte_zubereitung_min ?? defaultPrepMin;

    // Find the batch this order belongs to
    const stop = stops.find(s => s.order_id === o.id && !s.geliefert_am);
    let driverEta: number | null = null;
    let driverName: string | null = null;

    if (stop) {
      const batch = batches.find(b => b.id === stop.batch_id);
      if (batch && (batch.status === 'unterwegs' || batch.status === 'on_route')) {
        const etaMs = batch.started_at && batch.total_eta_min != null
          ? new Date(batch.started_at).getTime() + batch.total_eta_min * 60_000
          : null;
        if (etaMs) {
          driverEta = (etaMs - now) / 60_000;
          const driver = drivers.find(d => d.id === batch.driver_id);
          if (driver) driverName = `${driver.vorname} ${driver.nachname[0]}.`;
        }
      }
    } else {
      // Assign to soonest returning driver
      const soonest = returningDriverEtas.sort((a, b) => a.etaMin - b.etaMin)[0];
      if (soonest) {
        driverEta = soonest.etaMin;
        driverName = soonest.driverName;
      }
    }

    let startIn: number | null = null;
    let urgency: CookSignal['urgency'] = 'wait';

    if (o.status === 'in_zubereitung') {
      urgency = 'ready';
    } else if (driverEta != null) {
      startIn = driverEta - prepMin;
      if (startIn <= 0) urgency = 'now';
      else if (startIn <= 3) urgency = 'soon';
      else urgency = 'wait';
    } else {
      urgency = 'wait';
    }

    signals.push({
      orderId: o.id,
      bestellnummer: o.bestellnummer,
      kundeName: o.kunde_name,
      statusAktuell: o.status,
      prepMinEstimate: prepMin,
      driverEtaMin: driverEta,
      driverName,
      startIn,
      urgency,
    });
  }

  // Sort: now > soon > wait
  const urgencyOrder = { now: 0, soon: 1, wait: 2, ready: 3 };
  return signals.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);
}

const URGENCY_STYLE = {
  now: {
    bg: 'bg-red-950/60 border-red-500/60',
    badge: 'bg-red-500 text-white animate-pulse',
    icon: Flame,
    label: 'JETZT KOCHEN',
    text: 'text-red-300',
  },
  soon: {
    bg: 'bg-amber-950/50 border-amber-500/50',
    badge: 'bg-amber-500 text-white',
    icon: Timer,
    label: 'BALD STARTEN',
    text: 'text-amber-300',
  },
  wait: {
    bg: 'bg-matcha-900/30 border-matcha-700/30',
    badge: 'bg-matcha-700 text-matcha-200',
    icon: Clock,
    label: 'WARTEN',
    text: 'text-matcha-400',
  },
  ready: {
    bg: 'bg-blue-950/50 border-blue-500/40',
    badge: 'bg-blue-600 text-white',
    icon: ChefHat,
    label: 'IN ZUBEREITUNG',
    text: 'text-blue-300',
  },
};

export function KitchenCookNowPanel({
  orders,
  batches,
  stops,
  drivers,
}: {
  orders: Order[];
  batches: Batch[];
  stops: Stop[];
  drivers: Driver[];
}) {
  const [defaultPrepMin, setDefaultPrepMin] = useState(20);
  const [signals, setSignals] = useState<CookSignal[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 15_000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    setSignals(computeSignals(orders, batches, stops, drivers, defaultPrepMin));
  }, [orders, batches, stops, drivers, defaultPrepMin, tick]);

  const nowCount = signals.filter(s => s.urgency === 'now').length;
  const soonCount = signals.filter(s => s.urgency === 'soon').length;

  if (signals.length === 0) return null;

  return (
    <div className="rounded-xl border border-matcha-700/50 bg-matcha-900/40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-matcha-700/40 bg-matcha-900/60">
        <Zap className="h-3.5 w-3.5 text-accent shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-widest text-matcha-300">
          Koch-Signal · {signals.length} Bestellungen
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {nowCount > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-black text-white animate-pulse">
              <Flame className="h-2.5 w-2.5" />
              {nowCount} jetzt
            </span>
          )}
          {soonCount > 0 && (
            <span className={cn('rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-black text-white', nowCount === 0 && '')}>
              {soonCount} bald
            </span>
          )}
        </div>
      </div>

      {/* Signal Cards */}
      <div className="divide-y divide-matcha-800/40">
        {signals.slice(0, 6).map(sig => {
          const style = URGENCY_STYLE[sig.urgency];
          const Icon = style.icon;
          return (
            <div key={sig.orderId} className={cn('flex items-start gap-3 px-3 py-2.5 border-l-2', style.bg, style.bg.includes('border-red') ? 'border-l-red-500' : style.bg.includes('border-amber') ? 'border-l-amber-500' : style.bg.includes('border-blue') ? 'border-l-blue-500' : 'border-l-matcha-600')}>
              <div className={cn('flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg mt-0.5', style.badge)}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono text-[11px] font-black text-matcha-200">
                    #{sig.bestellnummer.slice(-4)}
                  </span>
                  <span className="text-[10px] text-matcha-400 truncate">{sig.kundeName}</span>
                  <span className={cn('ml-auto text-[9px] font-bold uppercase tracking-wide shrink-0', style.text)}>
                    {style.label}
                  </span>
                </div>

                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="flex items-center gap-0.5 text-[10px] text-matcha-500">
                    <ChefHat className="h-2.5 w-2.5" />
                    {fmtMin(sig.prepMinEstimate)} Zubereitung
                  </span>

                  {sig.driverEtaMin != null && (
                    <span className={cn('flex items-center gap-0.5 text-[10px]', sig.driverEtaMin < 5 ? 'text-red-400 font-bold' : 'text-matcha-400')}>
                      <Navigation2 className="h-2.5 w-2.5" />
                      {sig.driverName && <span>{sig.driverName}: </span>}
                      in {fmtMin(sig.driverEtaMin)}
                    </span>
                  )}

                  {sig.startIn !== null && sig.urgency !== 'ready' && (
                    <span className={cn('flex items-center gap-0.5 text-[10px] font-bold ml-auto', sig.urgency === 'now' ? 'text-red-400' : sig.urgency === 'soon' ? 'text-amber-400' : 'text-matcha-500')}>
                      <ArrowRight className="h-2.5 w-2.5" />
                      {sig.startIn <= 0 ? 'Start überfällig!' : `Start in ${fmtMin(sig.startIn)}`}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer — prep time calibration */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-matcha-800/60 bg-matcha-900/60">
        <span className="text-[9px] text-matcha-600 uppercase tracking-wide">Standard-Zubereitung:</span>
        <div className="flex items-center gap-1 ml-auto">
          {[15, 20, 25, 30].map(m => (
            <button
              key={m}
              onClick={() => setDefaultPrepMin(m)}
              className={cn(
                'h-5 px-1.5 rounded text-[9px] font-bold transition',
                defaultPrepMin === m
                  ? 'bg-accent text-matcha-900'
                  : 'bg-matcha-800/60 text-matcha-400 hover:bg-matcha-700/60',
              )}
            >
              {m}m
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
