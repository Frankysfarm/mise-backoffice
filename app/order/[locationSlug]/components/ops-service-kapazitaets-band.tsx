'use client';

import { useEffect, useState, useCallback } from 'react';
import { Bike, Clock, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HealthData {
  status: 'ok' | 'degraded' | 'down';
  activeDrivers: number;
  pendingOrders: number;
  etaMin: number;
  etaMax: number;
}

interface Props {
  locationId: string;
  orderType: 'lieferung' | 'abholung';
}

type CapacityLevel = 'high' | 'medium' | 'low' | 'unknown';

function getCapacity(data: HealthData): CapacityLevel {
  if (data.status === 'down') return 'low';
  const ratio = data.activeDrivers > 0 ? data.pendingOrders / data.activeDrivers : 99;
  if (ratio <= 2 && data.activeDrivers >= 2) return 'high';
  if (ratio <= 4 || data.activeDrivers >= 1) return 'medium';
  return 'low';
}

const CAPACITY_CFG: Record<CapacityLevel, {
  label: string;
  sublabel: string;
  dot: string;
  wrapper: string;
  text: string;
}> = {
  high:    { label: 'Schnelle Lieferung',  sublabel: 'Viele Fahrer verfügbar',     dot: 'bg-matcha-500 animate-pulse', wrapper: 'bg-matcha-50 border-matcha-200', text: 'text-matcha-700' },
  medium:  { label: 'Normale Lieferzeit',  sublabel: 'Kapazität ausreichend',       dot: 'bg-amber-400 animate-pulse',  wrapper: 'bg-amber-50 border-amber-200',   text: 'text-amber-700'  },
  low:     { label: 'Hohe Nachfrage',      sublabel: 'Längere Wartezeiten möglich', dot: 'bg-red-400',                  wrapper: 'bg-red-50 border-red-200',        text: 'text-red-700'    },
  unknown: { label: 'Status unbekannt',    sublabel: '',                            dot: 'bg-stone-300',                wrapper: 'bg-stone-50 border-stone-200',    text: 'text-stone-600'  },
};

export function OpsServiceKapazitaetsBand({ locationId, orderType }: Props) {
  const [data, setData] = useState<HealthData | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/health?location_id=${encodeURIComponent(locationId)}`);
      if (res.ok) setData(await res.json() as HealthData);
    } catch { /* ignore */ }
  }, [locationId]);

  useEffect(() => {
    if (orderType !== 'lieferung') return;
    void load();
    const iv = setInterval(() => void load(), 45_000);
    return () => clearInterval(iv);
  }, [load, orderType]);

  if (orderType !== 'lieferung' || !data) return null;

  const level = getCapacity(data);
  const cfg = CAPACITY_CFG[level];
  const etaLabel = data.etaMin > 0 && data.etaMax > 0
    ? `${data.etaMin}–${data.etaMax} Min`
    : null;

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm',
      cfg.wrapper,
    )}>
      {/* Pulse dot */}
      <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', cfg.dot)} />

      {/* Labels */}
      <div className="flex-1 min-w-0">
        <span className={cn('font-semibold', cfg.text)}>{cfg.label}</span>
        {cfg.sublabel && (
          <span className="text-muted-foreground text-xs ml-1.5">{cfg.sublabel}</span>
        )}
      </div>

      {/* ETA pill */}
      {etaLabel && (
        <div className="flex items-center gap-1 shrink-0">
          <Clock className={cn('h-3.5 w-3.5', cfg.text)} />
          <span className={cn('text-xs font-bold tabular-nums', cfg.text)}>{etaLabel}</span>
        </div>
      )}

      {/* Driver count */}
      {data.activeDrivers > 0 && (
        <div className="flex items-center gap-1 shrink-0">
          <Bike className={cn('h-3.5 w-3.5', cfg.text)} />
          <span className={cn('text-xs font-semibold', cfg.text)}>{data.activeDrivers}</span>
        </div>
      )}

      {/* Surge indicator */}
      {level === 'low' && (
        <Zap className="h-3.5 w-3.5 text-red-400 shrink-0" />
      )}
    </div>
  );
}
