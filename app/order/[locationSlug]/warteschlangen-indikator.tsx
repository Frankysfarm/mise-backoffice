'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Users, Clock, Zap, ChefHat } from 'lucide-react';

interface Props {
  locationId: string;
  orderType?: 'lieferung' | 'abholung';
}

type QueueSignal = 'low' | 'normal' | 'high' | 'surge';

interface QueueData {
  signal: QueueSignal;
  pendingOrders: number;
  activeDrivers: number;
  etaExtensionMin: number;
  etaBaseMin: number;
}

const SIGNAL_CONFIG: Record<QueueSignal, {
  label: string; sub: string;
  bg: string; border: string; textColor: string; dotColor: string;
}> = {
  low: {
    label: 'Ruhige Zeit',
    sub: 'Kurze Wartezeiten erwartet',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    textColor: 'text-emerald-800',
    dotColor: 'bg-emerald-500',
  },
  normal: {
    label: 'Normaler Betrieb',
    sub: 'Übliche Lieferzeiten',
    bg: 'bg-stone-50',
    border: 'border-stone-200',
    textColor: 'text-stone-700',
    dotColor: 'bg-stone-400',
  },
  high: {
    label: 'Hohe Nachfrage',
    sub: 'Etwas längere Wartezeiten',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    textColor: 'text-amber-800',
    dotColor: 'bg-amber-500',
  },
  surge: {
    label: 'Spitzenzeit!',
    sub: 'Küche läuft auf Hochtouren',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    textColor: 'text-rose-800',
    dotColor: 'bg-rose-500',
  },
};

export function WarteschlangenIndikator({ locationId, orderType = 'lieferung' }: Props) {
  const [data, setData] = useState<QueueData | null>(null);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(
          `/api/delivery/eta/live?location_id=${locationId}`,
          { cache: 'no-store' },
        );
        if (!res.ok || cancelled) return;
        const d = await res.json();
        if (!cancelled) {
          setData({
            signal: (d.queue_signal as QueueSignal) ?? 'normal',
            pendingOrders: d.pending_orders ?? 0,
            activeDrivers: d.active_drivers ?? 0,
            etaExtensionMin: d.eta_extension_min ?? 0,
            etaBaseMin: d.eta_base_min ?? 35,
          });
        }
      } catch {
        // silently ignore - not critical info
      }
    }

    poll();
    const iv = setInterval(poll, 90_000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [locationId]);

  if (!data) return null;

  const cfg = SIGNAL_CONFIG[data.signal];
  const totalEta = data.etaBaseMin + data.etaExtensionMin;
  const isSurge = data.signal === 'surge';

  return (
    <div className={cn(
      'rounded-2xl border px-4 py-3 flex items-center gap-3 transition-all',
      cfg.bg, cfg.border,
    )}>
      {/* Signal dot */}
      <div className="relative shrink-0">
        <div className={cn('h-3 w-3 rounded-full', cfg.dotColor)} />
        {(isSurge || data.signal === 'high') && (
          <div className={cn(
            'absolute inset-0 rounded-full animate-ping opacity-50',
            cfg.dotColor,
          )} />
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className={cn('text-sm font-bold leading-tight', cfg.textColor)}>
          {cfg.label}
        </div>
        <div className={cn('text-xs leading-tight opacity-70', cfg.textColor)}>
          {cfg.sub}
        </div>
      </div>

      {/* ETA or driver count */}
      <div className="shrink-0 text-right">
        {orderType === 'lieferung' ? (
          <>
            <div className={cn('text-base font-black tabular-nums', cfg.textColor)}>
              ~{totalEta} Min
            </div>
            <div className={cn('text-[10px] opacity-60', cfg.textColor)}>
              {data.activeDrivers > 0 ? `${data.activeDrivers} Fahrer aktiv` : 'Lieferzeit'}
            </div>
          </>
        ) : (
          <>
            <div className={cn('text-base font-black tabular-nums', cfg.textColor)}>
              {data.pendingOrders > 0 ? data.pendingOrders : '–'}
            </div>
            <div className={cn('text-[10px] opacity-60', cfg.textColor)}>
              {data.pendingOrders === 1 ? 'Bestellung läuft' : 'Bestellungen'}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
