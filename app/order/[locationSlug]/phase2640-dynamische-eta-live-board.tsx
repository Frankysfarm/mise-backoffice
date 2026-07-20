'use client';

/**
 * Phase 2640 — Dynamische ETA Live-Board (Storefront)
 *
 * Kunden-seitige Live-Tracking Komponente:
 * - Echtzeit-Countdown bis Lieferung (1-Sek-Tick)
 * - Bestellphasen-Timeline: Bestellt → Zubereitung → Unterwegs → Geliefert
 * - Fahrer-Annäherungsindikator (Entfernung in km)
 * - Farbampel: grün (pünktlich) / gelb (leichte Verzögerung) / rot (verspätet)
 * - Konfidenz-Badge für ETA-Genauigkeit
 * - 30-Sek-Polling
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, CheckCircle2, ChefHat, Bike, PackageCheck, Loader2 } from 'lucide-react';

type Phase = 'placed' | 'preparing' | 'on_the_way' | 'delivered';
type ETAStatus = 'on_time' | 'slight_delay' | 'delayed';

interface DeliveryStatus {
  orderId: string;
  phase: Phase;
  etaMinutes: number;
  originalEtaMinutes: number;
  etaStatus: ETAStatus;
  driverDistanceKm: number | null;
  driverName: string | null;
  confidence: number;
  estimatedDeliveryTime: string;
}

const MOCK: DeliveryStatus = {
  orderId: 'ORD-48291',
  phase: 'on_the_way',
  etaMinutes: 8,
  originalEtaMinutes: 30,
  etaStatus: 'on_time',
  driverDistanceKm: 1.4,
  driverName: 'Max M.',
  confidence: 87,
  estimatedDeliveryTime: '18:42',
};

const PHASES: { key: Phase; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { key: 'placed',     label: 'Bestellt',     Icon: ({ className }) => <CheckCircle2 className={className} /> },
  { key: 'preparing',  label: 'Zubereitung',  Icon: ({ className }) => <ChefHat     className={className} /> },
  { key: 'on_the_way', label: 'Unterwegs',    Icon: ({ className }) => <Bike        className={className} /> },
  { key: 'delivered',  label: 'Geliefert',    Icon: ({ className }) => <PackageCheck className={className} /> },
];

const PHASE_ORDER: Phase[] = ['placed', 'preparing', 'on_the_way', 'delivered'];

function etaColors(s: ETAStatus) {
  switch (s) {
    case 'delayed':      return { bg: 'bg-red-50',    border: 'border-red-200',    ring: 'bg-red-500',    text: 'text-red-700',    label: 'Verzögert' };
    case 'slight_delay': return { bg: 'bg-amber-50',  border: 'border-amber-200',  ring: 'bg-amber-500',  text: 'text-amber-700',  label: 'Kleine Verzögerung' };
    default:             return { bg: 'bg-matcha-50', border: 'border-matcha-200', ring: 'bg-matcha-500', text: 'text-matcha-700', label: 'Pünktlich' };
  }
}

function confColor(c: number) {
  if (c >= 80) return 'text-matcha-600 bg-matcha-100';
  if (c >= 60) return 'text-amber-600 bg-amber-100';
  return 'text-red-600 bg-red-100';
}

export function StorefrontPhase2640DynamischeEtaLiveBoard({ orderId }: { orderId: string | null }) {
  const [data, setData] = useState<DeliveryStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchData() {
    if (!orderId) return;
    if (data === null) setLoading(true);
    try {
      const r = await fetch(`/api/delivery/tracking?order_id=${orderId}`);
      if (r.ok) setData(await r.json());
      else setData(MOCK);
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    pollRef.current = setInterval(fetchData, 30_000);
    tickRef.current = setInterval(() => setTick(t => t + 1), 1_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  if (!orderId) return null;

  const d = data ?? MOCK;
  const colors = etaColors(d.etaStatus);
  const activeIdx = PHASE_ORDER.indexOf(d.phase);
  const etaDisplay = Math.max(0, d.etaMinutes - Math.floor(tick / 60));
  const isDelivered = d.phase === 'delivered';

  return (
    <div className={cn('rounded-xl border overflow-hidden', colors.bg, colors.border)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-inherit">
        <div className="flex items-center gap-2">
          <div className={cn('h-2.5 w-2.5 rounded-full', colors.ring)} />
          <span className="text-sm font-bold text-foreground">Deine Lieferung</span>
          <span className="text-[10px] text-muted-foreground">#{d.orderId}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-bold', confColor(d.confidence))}>
            {d.confidence}% genau
          </span>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {/* ETA Hero */}
      {!isDelivered ? (
        <div className="px-4 py-5 text-center">
          <div className={cn('text-4xl font-black tabular-nums', colors.text)}>
            {etaDisplay} Min
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            ca. {d.estimatedDeliveryTime} Uhr · {colors.label}
          </div>

          {d.driverDistanceKm !== null && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-[10px] font-semibold text-foreground">
              <Bike className="h-3 w-3 text-blue-500" />
              {d.driverName && <span>{d.driverName}</span>}
              <span>· {d.driverDistanceKm.toFixed(1)} km entfernt</span>
            </div>
          )}
        </div>
      ) : (
        <div className="px-4 py-5 flex flex-col items-center gap-2">
          <PackageCheck className="h-10 w-10 text-matcha-500" />
          <div className="text-lg font-black text-matcha-700">Geliefert!</div>
          <div className="text-xs text-muted-foreground">Guten Appetit 🍽️</div>
        </div>
      )}

      {/* Phase Timeline */}
      <div className="px-4 pb-4">
        <div className="flex items-start justify-between">
          {PHASES.map((p, i) => {
            const done    = i <= activeIdx;
            const current = i === activeIdx;
            return (
              <div key={p.key} className="flex flex-col items-center gap-1" style={{ flex: 1 }}>
                {/* Line connector */}
                {i < PHASES.length - 1 && (
                  <div className="sr-only" />
                )}
                <div className={cn(
                  'h-7 w-7 rounded-full flex items-center justify-center transition-all',
                  done
                    ? current
                      ? cn('ring-2 ring-offset-1', colors.border, 'bg-white')
                      : 'bg-matcha-500 text-white'
                    : 'bg-muted/30 text-muted-foreground'
                )}>
                  <p.Icon className={cn(
                    'h-3.5 w-3.5',
                    done ? (current ? colors.text : 'text-white') : 'text-muted-foreground/50'
                  )} />
                </div>
                <span className={cn(
                  'text-[9px] text-center leading-tight font-medium',
                  done ? (current ? colors.text : 'text-matcha-600') : 'text-muted-foreground'
                )}>
                  {p.label}
                </span>

                {/* Connector bar (between dots) */}
                {i < PHASES.length - 1 && (
                  <div className="absolute" />
                )}
              </div>
            );
          })}
        </div>

        {/* Connecting bar */}
        <div className="relative -mt-9 mb-4 flex items-center px-3.5">
          <div className="h-0.5 flex-1 bg-muted/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-matcha-500 transition-all duration-700"
              style={{ width: `${(activeIdx / (PHASES.length - 1)) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-inherit px-4 py-2 flex items-center gap-1.5 bg-white/30">
        <Clock className="h-3 w-3 text-muted-foreground" />
        <span className="text-[9px] text-muted-foreground">
          Original-ETA: {d.originalEtaMinutes} Min · Live-Update alle 30 Sek
        </span>
      </div>
    </div>
  );
}
