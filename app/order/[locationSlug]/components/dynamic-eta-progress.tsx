'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, ChefHat, Clock, Package, Truck, type LucideIcon } from 'lucide-react';

type OrderStatus = 'bestätigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert';

interface Props {
  status: string;
  bestelltAm: string | null;
  etaEarliest: string | null;
  etaLatest: string | null;
  typ: 'lieferung' | 'abholung' | string;
  defaultPrepMin?: number;
  defaultDeliveryMin?: number;
}

const STAGES: {
  key: OrderStatus;
  label: string;
  icon: LucideIcon;
}[] = [
  { key: 'bestätigt',      label: 'Bestätigt',   icon: Check    },
  { key: 'in_zubereitung', label: 'Zubereitung', icon: ChefHat  },
  { key: 'fertig',         label: 'Abholbereit', icon: Package  },
  { key: 'unterwegs',      label: 'Unterwegs',   icon: Truck    },
  { key: 'geliefert',      label: 'Geliefert',   icon: Check    },
];

const STATUS_ORDER: OrderStatus[] = [
  'bestätigt', 'in_zubereitung', 'fertig', 'unterwegs', 'geliefert',
];

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function fmtCountdown(iso: string): string {
  const secs = Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
  if (secs <= 0) return 'in Kürze';
  const m = Math.floor(secs / 60);
  return m > 0 ? `in ${m} Min` : 'gleich';
}

export function DynamicEtaProgress({
  status,
  bestelltAm,
  etaEarliest,
  etaLatest,
  typ,
  defaultPrepMin = 20,
  defaultDeliveryMin = 35,
}: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 10_000);
    return () => clearInterval(iv);
  }, []);

  const isPickup = typ === 'abholung';
  const activeStages = isPickup
    ? STAGES.filter(s => s.key !== 'unterwegs' && s.key !== 'geliefert')
    : STAGES;

  const currentIdx = STATUS_ORDER.indexOf(status as OrderStatus);
  const isDelivered = status === 'geliefert';

  // ETA label
  const etaLabel = (() => {
    if (isDelivered) return 'Erfolgreich geliefert';
    if (etaEarliest && etaLatest) {
      const now = Date.now();
      const earliest = new Date(etaEarliest).getTime();
      if (earliest > now) {
        return `${fmtCountdown(etaEarliest)} · ${fmtTime(etaEarliest)}–${fmtTime(etaLatest)}`;
      }
      return `${fmtTime(etaEarliest)}–${fmtTime(etaLatest)} Uhr`;
    }
    if (bestelltAm) {
      const ordered = new Date(bestelltAm).getTime();
      const target = ordered + (defaultPrepMin + (isPickup ? 0 : defaultDeliveryMin)) * 60_000;
      const now = Date.now();
      if (target > now) {
        const minsLeft = Math.floor((target - now) / 60_000);
        return `ca. ${minsLeft} Min`;
      }
    }
    return `ca. ${defaultPrepMin + (isPickup ? 0 : defaultDeliveryMin)} Min`;
  })();

  return (
    <div className="w-full space-y-3">
      {/* ETA-Anzeige */}
      <div className={cn(
        'flex items-center gap-2 rounded-xl px-4 py-3',
        isDelivered ? 'bg-matcha-50' : 'bg-blue-50',
      )}>
        <Clock size={16} className={isDelivered ? 'text-matcha-600' : 'text-blue-600'} />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {isDelivered ? 'Zugestellt' : isPickup ? 'Abholzeit' : 'Lieferzeit'}
          </div>
          <div className="text-sm font-bold text-foreground">{etaLabel}</div>
        </div>
      </div>

      {/* Fortschritts-Schritte */}
      <div className="flex items-start gap-0">
        {activeStages.map((stage, idx) => {
          const stageStatusIdx = STATUS_ORDER.indexOf(stage.key);
          const done    = stageStatusIdx < currentIdx || isDelivered;
          const active  = stageStatusIdx === currentIdx;
          const pending = stageStatusIdx > currentIdx;
          const isLast  = idx === activeStages.length - 1;

          return (
            <div key={stage.key} className="flex flex-col items-center" style={{ flex: 1 }}>
              {/* Icon + Verbindungslinie */}
              <div className="flex items-center w-full">
                {idx > 0 && (
                  <div className={cn(
                    'h-0.5 flex-1',
                    done || active ? 'bg-matcha-400' : 'bg-border',
                  )} />
                )}
                <div className={cn(
                  'h-8 w-8 rounded-full flex items-center justify-center border-2 shrink-0 transition-all',
                  done   ? 'bg-matcha-500 border-matcha-600 text-white' :
                  active ? 'bg-blue-500 border-blue-600 text-white ring-2 ring-blue-300 ring-offset-1' :
                           'bg-muted border-border text-muted-foreground',
                )}>
                  <stage.icon size={14} />
                </div>
                {!isLast && (
                  <div className={cn(
                    'h-0.5 flex-1',
                    done ? 'bg-matcha-400' : 'bg-border',
                  )} />
                )}
              </div>

              {/* Label */}
              <div className={cn(
                'mt-1 text-center text-[9px] font-bold leading-tight px-0.5',
                done   ? 'text-matcha-700' :
                active ? 'text-blue-700' :
                         'text-muted-foreground',
              )}>
                {stage.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
