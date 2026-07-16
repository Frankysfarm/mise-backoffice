'use client';

/**
 * Phase 1893 — Bestellstatus-Phasen-Leiste (Storefront)
 *
 * Horizontale Fortschrittsleiste mit 4 Phasen-Icons:
 * Angenommen → Küche → Fahrer unterwegs → Geliefert.
 * Aktive Phase hervorgehoben. SSR-safe. 20-Sek-Polling.
 * Hydration-safe (kein Date bei Mount).
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, ChefHat, MapPin, Package, X } from 'lucide-react';

interface ApiResponse {
  status?: string | null;
  eta_min?: number | null;
  fahrer_name?: string | null;
}

interface Props {
  orderId: string;
  className?: string;
}

const PHASES = [
  { key: 'angenommen',  label: 'Angenommen', icon: Package,  stati: new Set(['neu', 'accepted', 'angenommen']) },
  { key: 'kueche',      label: 'Küche',      icon: ChefHat,  stati: new Set(['in_zubereitung', 'zubereitung', 'preparing', 'ready']) },
  { key: 'unterwegs',   label: 'Unterwegs',  icon: MapPin,   stati: new Set(['dispatched', 'unterwegs', 'on_route', 'gestartet', 'aktiv']) },
  { key: 'geliefert',   label: 'Geliefert',  icon: Check,    stati: new Set(['delivered', 'geliefert', 'abgeschlossen']) },
] as const;

function activePhaseIndex(status: string | null | undefined): number {
  if (!status) return 0;
  for (let i = PHASES.length - 1; i >= 0; i--) {
    if ((PHASES[i].stati as Set<string>).has(status)) return i;
  }
  if (status === 'storniert' || status === 'cancelled') return -1;
  return 0;
}

export function StorefrontPhase1893BestellstatusPhasenLeiste({ orderId, className }: Props) {
  const [data, setData]         = useState<ApiResponse | null>(null);
  const [etaCountdown, setEta]  = useState<number | null>(null);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    if (!orderId) return;

    async function poll() {
      try {
        const res = await fetch(`/api/delivery/orders/${orderId}/status`);
        if (res.ok) {
          const json: ApiResponse = await res.json();
          setData(json);
          if (json.status === 'storniert' || json.status === 'cancelled') setCancelled(true);
          if (typeof json.eta_min === 'number') setEta(json.eta_min);
        }
      } catch {
        // Network error — keep previous state
      }
    }

    poll();
    const id = setInterval(poll, 20_000);
    return () => clearInterval(id);
  }, [orderId]);

  const phaseIdx = cancelled ? -1 : activePhaseIndex(data?.status);

  if (cancelled) {
    return (
      <div className={cn('flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-950 px-4 py-3 ring-1 ring-red-300', className)}>
        <X className="h-4 w-4 text-red-500 shrink-0" />
        <p className="text-sm font-semibold text-red-700 dark:text-red-300">Bestellung storniert</p>
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl bg-card ring-1 ring-border/60 px-4 py-3 space-y-3', className)}>
      {/* Phasen-Leiste */}
      <div className="flex items-center">
        {PHASES.map((ph, i) => {
          const Icon   = ph.icon;
          const done   = i < phaseIdx;
          const active = i === phaseIdx;
          const future = i > phaseIdx;

          return (
            <div key={ph.key} className="flex items-center flex-1 last:flex-none">
              {/* Icon-Kreis */}
              <div className="flex flex-col items-center gap-0.5">
                <div
                  className={cn(
                    'h-8 w-8 rounded-full flex items-center justify-center ring-2 transition-all duration-500',
                    done   && 'bg-emerald-500 ring-emerald-400',
                    active && 'bg-matcha-600 ring-matcha-400 scale-110',
                    future && 'bg-muted ring-border',
                  )}
                >
                  {done
                    ? <Check className="h-4 w-4 text-white" />
                    : <Icon className={cn('h-4 w-4', active ? 'text-white' : 'text-muted-foreground')} />}
                </div>
                <span className={cn(
                  'text-[9px] font-semibold whitespace-nowrap',
                  active ? 'text-matcha-700 dark:text-matcha-300' : done ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
                )}>
                  {ph.label}
                </span>
              </div>

              {/* Connector */}
              {i < PHASES.length - 1 && (
                <div className={cn(
                  'flex-1 h-0.5 mx-1 mb-4 rounded-full transition-all duration-500',
                  i < phaseIdx ? 'bg-emerald-400' : 'bg-border',
                )} />
              )}
            </div>
          );
        })}
      </div>

      {/* ETA + Fahrername */}
      {data && (
        <div className="flex items-center justify-between text-xs">
          {data.fahrer_name && phaseIdx === 2 && (
            <span className="font-medium text-muted-foreground">
              Fahrer: <span className="font-bold text-foreground">{data.fahrer_name}</span>
            </span>
          )}
          {typeof etaCountdown === 'number' && phaseIdx < 3 && (
            <span className="ml-auto font-mono font-black text-sm text-foreground tabular-nums">
              ca. {etaCountdown} Min
            </span>
          )}
          {phaseIdx === 3 && (
            <span className="ml-auto text-emerald-600 dark:text-emerald-400 font-bold">Guten Appetit! 🎉</span>
          )}
        </div>
      )}
    </div>
  );
}
