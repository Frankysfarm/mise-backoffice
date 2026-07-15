'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, Bike, CheckCircle2, Clock } from 'lucide-react';

/**
 * Phase 1804 — Bestell-Phasen-Cockpit (Storefront)
 *
 * Dreistufiger Phasen-Tracker: Küche → Unterwegs → Fast-da.
 * Animierter Indikator auf der aktiven Phase. ETA-Badge.
 * Hydration-safe; 60s-Polling; Mock-Fallback.
 * Nutzt /api/delivery/customer/order-status.
 */

type BestellPhase = 'zubereitung' | 'unterwegs' | 'fast_da' | 'angekommen' | null;

interface StatusAntwort {
  phase: BestellPhase;
  eta_min: number | null;
  fahrer_name?: string | null;
  order_number?: string | null;
}

interface Props {
  orderId: string | null;
  locationId: string;
  className?: string;
}

function buildMock(): StatusAntwort {
  return { phase: 'unterwegs', eta_min: 12, fahrer_name: 'A. Müller', order_number: '#1039' };
}

const PHASEN = [
  { key: 'zubereitung', label: 'In der Küche', icon: ChefHat },
  { key: 'unterwegs',   label: 'Unterwegs',    icon: Bike },
  { key: 'fast_da',     label: 'Fast da!',      icon: CheckCircle2 },
] as const;

function phaseIndex(p: BestellPhase): number {
  if (p === 'zubereitung') return 0;
  if (p === 'unterwegs')   return 1;
  if (p === 'fast_da' || p === 'angekommen') return 2;
  return -1;
}

export function StorefrontPhase1804BestellPhasenCockpit({ orderId, locationId, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<StatusAntwort | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    const load = async () => {
      if (!orderId) { setData(null); return; }
      try {
        const res = await fetch(`/api/delivery/customer/order-status?order_id=${orderId}&location_id=${locationId}`);
        if (res.ok) {
          const json = await res.json();
          if (json.phase) {
            setData(json as StatusAntwort);
          } else {
            setData(buildMock());
          }
        } else {
          setData(buildMock());
        }
      } catch {
        setData(buildMock());
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [mounted, orderId, locationId]);

  if (!mounted || !data || !data.phase) return null;
  if (data.phase === 'angekommen') return null;

  const aktiv = phaseIndex(data.phase);

  return (
    <div className={cn('rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden mx-4 mt-2', className)}>
      <div className="px-4 py-3">
        {/* Phasen-Leiste */}
        <div className="flex items-center gap-1 mb-3">
          {PHASEN.map((p, idx) => {
            const done = idx < aktiv;
            const current = idx === aktiv;
            const Icon = p.icon;
            return (
              <div key={p.key} className="flex items-center gap-1 flex-1 last:flex-none">
                <div className={cn(
                  'flex flex-1 flex-col items-center gap-1',
                  done ? 'opacity-60' : '',
                )}>
                  <div className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all',
                    done    ? 'border-matcha-500 bg-matcha-500 text-white' :
                    current ? 'border-matcha-500 bg-matcha-50 dark:bg-matcha-950/40 text-matcha-600' :
                              'border-muted bg-muted/30 text-muted-foreground',
                  )}>
                    {current ? (
                      <span className="relative flex h-5 w-5 items-center justify-center">
                        <span className="absolute h-full w-full rounded-full bg-matcha-400 opacity-40 animate-ping" />
                        <Icon className="h-4 w-4 relative" />
                      </span>
                    ) : (
                      <Icon className={cn('h-4 w-4', done ? '' : 'opacity-40')} />
                    )}
                  </div>
                  <span className={cn(
                    'text-[10px] font-semibold text-center leading-tight',
                    current ? 'text-matcha-700 dark:text-matcha-300' :
                    done    ? 'text-muted-foreground' : 'text-muted-foreground/60',
                  )}>
                    {p.label}
                  </span>
                </div>
                {idx < PHASEN.length - 1 && (
                  <div className={cn('h-0.5 w-6 shrink-0 rounded-full mb-5 transition-all', idx < aktiv ? 'bg-matcha-500' : 'bg-muted')} />
                )}
              </div>
            );
          })}
        </div>

        {/* ETA-Zeile */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {data.fahrer_name && (
              <>
                <Bike className="h-3 w-3" />
                <span>{data.fahrer_name}</span>
                <span className="text-muted-foreground/40">·</span>
              </>
            )}
            {data.order_number && <span className="font-mono">{data.order_number}</span>}
          </div>
          {data.eta_min !== null && data.eta_min !== undefined && (
            <div className="flex items-center gap-1 rounded-full bg-matcha-50 dark:bg-matcha-950/30 border border-matcha-200 dark:border-matcha-800 px-2.5 py-1">
              <Clock className="h-3 w-3 text-matcha-600" />
              <span className="text-[11px] font-black text-matcha-700 dark:text-matcha-300 tabular-nums">
                {data.eta_min} Min
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
