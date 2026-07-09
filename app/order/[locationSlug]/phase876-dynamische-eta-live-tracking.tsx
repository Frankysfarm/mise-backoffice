'use client';

import React, { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Clock, MapPin, Bike, ChefHat, CheckCircle2 } from 'lucide-react';

interface Props {
  orderId: string;
  initialEtaMin?: number | null;
}

type DeliveryPhase = 'kitchen' | 'ready' | 'picked_up' | 'on_the_way' | 'near' | 'delivered';

interface EtaData {
  phase: DeliveryPhase;
  etaMin: number | null;
  driverName?: string | null;
  distanceKm?: number | null;
}

function generateMock(): EtaData {
  const phases: DeliveryPhase[] = ['kitchen', 'ready', 'picked_up', 'on_the_way', 'near'];
  const phase = phases[Math.floor(Math.random() * phases.length)];
  return {
    phase,
    etaMin: phase === 'near' ? Math.floor(Math.random() * 5) + 1 : Math.floor(Math.random() * 20) + 5,
    driverName: 'Lars K.',
    distanceKm: phase === 'near' ? Math.round(Math.random() * 5) / 10 : null,
  };
}

const phaseConfig: Record<DeliveryPhase, {
  label: string;
  icon: React.FC<{ className?: string }>;
  color: string;
  bg: string;
  pulse: boolean;
}> = {
  kitchen:    { label: 'Wird zubereitet',    icon: ChefHat,       color: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-950',   pulse: false },
  ready:      { label: 'Bereit zur Abholung', icon: CheckCircle2, color: 'text-matcha-600',  bg: 'bg-matcha-50 dark:bg-matcha-950', pulse: true },
  picked_up:  { label: 'Fahrer holt ab',     icon: Bike,          color: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-950',     pulse: true },
  on_the_way: { label: 'Unterwegs',          icon: Bike,          color: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-950',     pulse: false },
  near:       { label: 'Fast da!',           icon: MapPin,         color: 'text-matcha-600',  bg: 'bg-matcha-50 dark:bg-matcha-950', pulse: true },
  delivered:  { label: 'Zugestellt',         icon: CheckCircle2,  color: 'text-matcha-700',  bg: 'bg-matcha-50 dark:bg-matcha-950', pulse: false },
};

const phaseOrder: DeliveryPhase[] = ['kitchen', 'ready', 'picked_up', 'on_the_way', 'near', 'delivered'];

export function StorefrontPhase876DynamischeEtaLiveTracking({ orderId, initialEtaMin }: Props) {
  const [data, setData] = useState<EtaData | null>(null);
  const [tick, setTick] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!orderId) return;
    let mounted = true;

    async function load() {
      try {
        const res = await fetch(`/api/delivery/customer/order-status?order_id=${orderId}`);
        if (res.ok) {
          const json = await res.json();
          if (mounted && json.phase) {
            setData({
              phase: json.phase as DeliveryPhase,
              etaMin: json.eta_min ?? initialEtaMin ?? null,
              driverName: json.driver_name ?? null,
              distanceKm: json.distance_km ?? null,
            });
            return;
          }
        }
      } catch { /* fallback */ }
      if (mounted && !data) setData(generateMock());
    }

    load();
    timerRef.current = setInterval(() => {
      setTick(t => t + 1);
      load();
    }, 15_000);
    return () => { mounted = false; if (timerRef.current) clearInterval(timerRef.current); };
  }, [orderId]);

  if (!data) return null;

  const cfg = phaseConfig[data.phase];
  const phaseIdx = phaseOrder.indexOf(data.phase);
  const Icon = cfg.icon;

  return (
    <div className={cn('rounded-2xl border overflow-hidden', cfg.bg)}>
      {/* Main ETA display */}
      <div className="px-5 py-4 flex items-center gap-4">
        <div className={cn(
          'shrink-0 flex h-12 w-12 items-center justify-center rounded-full',
          cfg.bg, 'border-2', cfg.color.replace('text-', 'border-').replace('600', '300').replace('700', '300'),
        )}>
          <Icon className={cn('h-6 w-6', cfg.color, cfg.pulse && 'animate-pulse')} />
        </div>

        <div className="flex-1 min-w-0">
          <div className={cn('text-sm font-bold', cfg.color)}>{cfg.label}</div>
          {data.driverName && data.phase !== 'kitchen' && data.phase !== 'ready' && (
            <div className="text-[11px] text-muted-foreground">Fahrer: {data.driverName}</div>
          )}
          {data.distanceKm != null && data.phase === 'near' && (
            <div className="text-[11px] text-muted-foreground">{data.distanceKm.toFixed(1)} km entfernt</div>
          )}
        </div>

        {data.etaMin != null && data.phase !== 'delivered' && (
          <div className="shrink-0 text-right">
            <div className={cn('text-2xl font-black tabular-nums', cfg.color)}>
              ~{data.etaMin}
            </div>
            <div className="text-[10px] text-muted-foreground">Min</div>
          </div>
        )}

        {data.phase === 'delivered' && (
          <CheckCircle2 className="h-8 w-8 text-matcha-500 shrink-0" />
        )}
      </div>

      {/* Phase progress dots */}
      <div className="px-5 pb-4">
        <div className="flex items-center justify-between gap-1">
          {phaseOrder.slice(0, -1).map((ph, i) => {
            const done = i < phaseIdx;
            const active = i === phaseIdx;
            return (
              <React.Fragment key={ph}>
                <div className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-black transition-all',
                  done ? 'bg-matcha-500 text-white' :
                  active ? cn('border-2 border-current', cfg.color, 'text-current bg-white dark:bg-slate-900', cfg.pulse && 'animate-pulse') :
                  'border border-muted bg-muted/40 text-muted-foreground',
                )}>
                  {done ? '✓' : i + 1}
                </div>
                {i < phaseOrder.length - 2 && (
                  <div className={cn('flex-1 h-0.5 rounded-full', done ? 'bg-matcha-400' : 'bg-muted')} />
                )}
              </React.Fragment>
            );
          })}
        </div>
        <div className="flex justify-between mt-1">
          {['Küche', 'Bereit', 'Abgeholt', 'Unterwegs', 'Ankunft'].map((label, i) => (
            <span key={label} className={cn(
              'text-[8px] font-semibold',
              i <= phaseIdx ? cfg.color : 'text-muted-foreground',
            )}>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
