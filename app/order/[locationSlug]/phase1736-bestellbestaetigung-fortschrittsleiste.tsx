'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle, ChefHat, Truck, Package } from 'lucide-react';

/**
 * Phase 1736 — Bestellbestätigungs-Fortschrittsleiste (Storefront)
 *
 * 4-Schritt-Leiste (Bestellt→Zubereitung→Unterwegs→Geliefert)
 * basierend auf Bestellstatus; Props-basiert; Hydration-safe.
 */

type BestellStatus =
  | 'neu' | 'bestellt' | 'accepted' | 'angenommen'
  | 'zubereitung' | 'in_zubereitung' | 'preparing'
  | 'unterwegs' | 'on_route' | 'gestartet' | 'dispatched'
  | 'geliefert' | 'delivered' | 'completed' | 'abgeschlossen';

interface Schritt {
  key: string;
  label: string;
  Icon: React.ElementType;
}

const SCHRITTE: Schritt[] = [
  { key: 'bestellt',     label: 'Bestellt',    Icon: CheckCircle },
  { key: 'zubereitung',  label: 'Zubereitung', Icon: ChefHat     },
  { key: 'unterwegs',    label: 'Unterwegs',   Icon: Truck       },
  { key: 'geliefert',    label: 'Geliefert',   Icon: Package     },
];

function statusToStep(status: string): number {
  const s = status.toLowerCase();
  if (['geliefert', 'delivered', 'completed', 'abgeschlossen'].includes(s)) return 3;
  if (['unterwegs', 'on_route', 'gestartet', 'dispatched'].includes(s)) return 2;
  if (['zubereitung', 'in_zubereitung', 'preparing'].includes(s)) return 1;
  return 0;
}

interface Props {
  status?: BestellStatus | string | null;
  className?: string;
}

export function StorefrontPhase1736BestellbestaetigungFortschrittsleiste({ status, className }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted || !status) return null;

  const aktiv = statusToStep(status);

  return (
    <div className={cn('rounded-xl border border-border/60 bg-background/70 p-3', className)}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
        Bestellstatus
      </p>

      <div className="relative flex items-start justify-between">
        {/* Verbindungslinie */}
        <div className="absolute top-4 left-[calc(12.5%)] right-[calc(12.5%)] h-0.5 bg-muted" />
        <div
          className="absolute top-4 left-[calc(12.5%)] h-0.5 bg-green-500 transition-all duration-700"
          style={{ width: `${(aktiv / (SCHRITTE.length - 1)) * 75}%` }}
        />

        {SCHRITTE.map((schritt, idx) => {
          const done = idx <= aktiv;
          const current = idx === aktiv;

          return (
            <div key={schritt.key} className="relative z-10 flex flex-col items-center gap-1.5 w-1/4">
              <div className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-500',
                done
                  ? 'border-green-500 bg-green-500 text-white'
                  : 'border-border bg-background text-muted-foreground',
                current && !done && 'border-green-400 bg-green-50 dark:bg-green-950/30',
              )}>
                <schritt.Icon className="h-4 w-4" />
              </div>

              <span className={cn(
                'text-center text-[10px] font-semibold leading-tight',
                done ? 'text-green-700 dark:text-green-300' : 'text-muted-foreground',
                current && 'text-green-600 dark:text-green-400',
              )}>
                {schritt.label}
              </span>

              {current && (
                <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-[8px] font-black text-green-600 dark:text-green-400 whitespace-nowrap">
                  ● Jetzt
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
