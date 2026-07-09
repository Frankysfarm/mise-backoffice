'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Bike, CheckCircle2, ChefHat, Clock, MapPin, Package, Truck,
} from 'lucide-react';

/**
 * EtaLiveKommando — Kunden-seitige Echtzeit-ETA-Anzeige
 *
 * Sticky-Bottom-Band für die Storefront, das den Bestellstatus
 * als visuelle Zeitleiste mit Live-Countdown anzeigt.
 * Status: bestätigt → in_zubereitung → fertig → unterwegs → geliefert
 */

type OrderStatus =
  | 'bestätigt'
  | 'in_zubereitung'
  | 'fertig'
  | 'unterwegs'
  | 'geliefert'
  | string;

interface Props {
  status: OrderStatus;
  etaEarliest?: string | null;
  etaLatest?: string | null;
  bestellnummer?: string;
  sticky?: boolean;
}

const STEPS: { key: string; label: string; icon: React.ElementType }[] = [
  { key: 'bestätigt',      label: 'Bestätigt',     icon: CheckCircle2 },
  { key: 'in_zubereitung', label: 'Zubereitung',   icon: ChefHat },
  { key: 'fertig',         label: 'Bereit',         icon: Package },
  { key: 'unterwegs',      label: 'Unterwegs',      icon: Bike },
  { key: 'geliefert',      label: 'Geliefert!',     icon: MapPin },
];

const STATUS_ORDER: Record<string, number> = {
  'bestätigt': 0,
  'in_zubereitung': 1,
  'fertig': 2,
  'unterwegs': 3,
  'geliefert': 4,
};

function useTick() {
  const [, set] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => set((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
}

function Countdown({ iso, label }: { iso: string; label: string }) {
  useTick();
  const secs = Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
  if (secs <= 0) {
    return (
      <span className="text-sm font-black text-matcha-600">Jeden Moment!</span>
    );
  }
  const mm = Math.floor(secs / 60);
  const ss = secs % 60;
  const urgent = secs < 300;
  return (
    <div className="text-center">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={cn('text-lg font-black tabular-nums', urgent ? 'text-amber-500 animate-pulse' : 'text-foreground')}>
        {mm}:{String(ss).padStart(2, '0')}
      </p>
    </div>
  );
}

export function EtaLiveKommando({ status, etaEarliest, etaLatest, bestellnummer, sticky = true }: Props) {
  const currentIdx = STATUS_ORDER[status] ?? 0;
  const isDelivered = status === 'geliefert';

  return (
    <div className={cn(
      'rounded-xl border border-border bg-card shadow-lg p-4',
      sticky && 'sticky bottom-4 z-30',
    )}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck size={14} className="text-matcha-600" />
          <span className="text-sm font-semibold text-foreground">
            {isDelivered ? 'Geliefert!' : 'Lieferstatus'}
          </span>
          {bestellnummer && (
            <span className="text-[10px] text-muted-foreground">#{bestellnummer}</span>
          )}
        </div>
        {etaEarliest && !isDelivered && (
          <Countdown iso={etaEarliest} label="noch ca." />
        )}
      </div>

      {/* Progress steps */}
      <div className="flex items-center">
        {STEPS.map((step, i) => {
          const done    = i < currentIdx;
          const active  = i === currentIdx;
          const pending = i > currentIdx;
          const Icon = step.icon;

          return (
            <div key={step.key} className="flex flex-1 items-center">
              <div className="flex flex-col items-center flex-1">
                {/* Icon */}
                <div className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all',
                  done   && 'border-matcha-500 bg-matcha-500 text-white',
                  active && 'border-matcha-500 bg-matcha-50 text-matcha-600 scale-110 shadow-md',
                  pending && 'border-muted bg-muted text-muted-foreground',
                )}>
                  <Icon size={14} />
                </div>
                {/* Label */}
                <span className={cn(
                  'mt-1 text-[9px] text-center font-medium leading-tight',
                  done || active ? 'text-matcha-600' : 'text-muted-foreground',
                )}>
                  {step.label}
                </span>
              </div>
              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div className={cn(
                  'h-0.5 flex-none w-4 -mx-1',
                  i < currentIdx ? 'bg-matcha-500' : 'bg-muted',
                )} />
              )}
            </div>
          );
        })}
      </div>

      {/* ETA window */}
      {etaEarliest && etaLatest && !isDelivered && (
        <div className="mt-3 rounded-lg bg-matcha-50 border border-matcha-200 px-3 py-2 flex items-center justify-center gap-2">
          <Clock size={12} className="text-matcha-600" />
          <p className="text-xs text-matcha-700 font-medium">
            Ankunft zwischen {new Date(etaEarliest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} und {new Date(etaLatest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
          </p>
        </div>
      )}

      {isDelivered && (
        <div className="mt-3 rounded-lg bg-matcha-50 border border-matcha-200 px-3 py-2 text-center">
          <p className="text-sm font-bold text-matcha-700">🎉 Guten Appetit!</p>
        </div>
      )}
    </div>
  );
}
