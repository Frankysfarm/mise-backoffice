'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChefHat, Clock, X } from 'lucide-react';

type AlertLevel = 'ok' | 'warning' | 'critical';

interface OrderItem {
  id: string;
  bestellnummer: string | null;
  status: string;
  createdAt: string;
  waitMin: number;
}

interface ApiData {
  ok: boolean;
  alertLevel: AlertLevel;
  currentCount: number;
  threshold: number;
  pct: number;
  longestWaitMin: number | null;
  orders: OrderItem[];
}

interface Props {
  locationId: string | null;
}

const LEVEL_STYLE: Record<AlertLevel, {
  bg: string; border: string; text: string; iconColor: string; label: string; animate: boolean;
}> = {
  ok:       { bg: '', border: '',                       text: '',                   iconColor: '',              label: 'OK',          animate: false },
  warning:  { bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-800', iconColor: 'text-amber-500', label: 'Auslastung hoch', animate: false },
  critical: { bg: 'bg-red-50',   border: 'border-red-500',   text: 'text-red-800',   iconColor: 'text-red-500',   label: 'KÜCHE ÜBERLASTET', animate: true },
};

export function KitchenKapazitaetsAlert({ locationId }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const prevLevel = useRef<AlertLevel>('ok');

  const load = () => {
    if (!locationId) return;
    fetch(`/api/delivery/admin/kitchen-capacity-alert?location_id=${locationId}`)
      .then((r) => r.json())
      .then((d: ApiData) => {
        // Re-show if alert level escalated
        if (d.alertLevel !== 'ok' && d.alertLevel !== prevLevel.current) {
          setDismissed(false);
        }
        prevLevel.current = d.alertLevel;
        setData(d);
      })
      .catch(() => {/* silent */});
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data || data.alertLevel === 'ok' || dismissed) return null;

  const style = LEVEL_STYLE[data.alertLevel];

  return (
    <div className={cn(
      'relative rounded-xl border-2 p-4',
      style.bg, style.border,
      style.animate && 'animate-pulse',
    )}>
      {/* Dismiss */}
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 p-1 rounded-full hover:bg-black/10 transition-colors"
        aria-label="Schließen"
      >
        <X className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn('shrink-0 mt-0.5', style.iconColor)}>
          {data.alertLevel === 'critical'
            ? <AlertTriangle className="h-5 w-5" />
            : <ChefHat className="h-5 w-5" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-sm font-black uppercase tracking-wider', style.text)}>
              {style.label}
            </span>
            <span className={cn('text-xs font-bold', style.text)}>
              {data.currentCount} von {data.threshold} Bestellungen in Zubereitung
            </span>
          </div>

          {/* Capacity bar */}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-2.5 rounded-full bg-black/10 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-700',
                  data.alertLevel === 'critical' ? 'bg-red-500' : 'bg-amber-400',
                )}
                style={{ width: `${Math.min(data.pct, 100)}%` }}
              />
            </div>
            <span className={cn('text-[10px] font-black tabular-nums shrink-0', style.text)}>
              {data.pct}%
            </span>
          </div>

          {/* Longest wait */}
          {data.longestWaitMin != null && data.longestWaitMin >= 15 && (
            <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-red-700">
              <Clock className="h-3 w-3" />
              Längste Wartezeit: {data.longestWaitMin} Min
            </div>
          )}

          {/* Order list (critical only) */}
          {data.alertLevel === 'critical' && data.orders.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {data.orders.slice(0, 10).map((o) => (
                <span
                  key={o.id}
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[9px] font-bold tabular-nums',
                    o.waitMin >= 25
                      ? 'bg-red-100 border-red-300 text-red-700'
                      : 'bg-amber-100 border-amber-300 text-amber-700',
                  )}
                >
                  #{o.bestellnummer ?? o.id.slice(-4)} · {o.waitMin}m
                </span>
              ))}
              {data.orders.length > 10 && (
                <span className="rounded-full border px-2 py-0.5 text-[9px] font-bold text-muted-foreground">
                  +{data.orders.length - 10} weitere
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
