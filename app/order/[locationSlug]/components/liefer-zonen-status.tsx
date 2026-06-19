'use client';

import { useEffect, useState } from 'react';
import { Clock, CheckCircle2, AlertTriangle, XCircle, Bike } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  locationSlug: string;
}

type ZoneStatus = 'available' | 'busy' | 'full' | 'offline';

interface ZoneInfo {
  status: ZoneStatus;
  etaMin: number;
  etaMax: number;
  activeDrivers: number;
}

const STATUS_CONFIG = {
  available: {
    Icon: CheckCircle2,
    label: 'Lieferung verfügbar',
    sub: (info: ZoneInfo) => `${info.etaMin}–${info.etaMax} Min · ${info.activeDrivers} Fahrer aktiv`,
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-200',
    iconColor: 'text-green-500',
  },
  busy: {
    Icon: AlertTriangle,
    label: 'Hohe Nachfrage',
    sub: (info: ZoneInfo) => `ca. ${info.etaMin}–${info.etaMax} Min Lieferzeit`,
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    iconColor: 'text-amber-500',
  },
  full: {
    Icon: XCircle,
    label: 'Derzeit ausgebucht',
    sub: () => 'Bitte später versuchen oder Abholung wählen',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    iconColor: 'text-red-500',
  },
  offline: {
    Icon: XCircle,
    label: 'Kein Lieferdienst',
    sub: () => 'Nur Abholung verfügbar',
    color: 'text-gray-600',
    bg: 'bg-gray-100',
    border: 'border-gray-200',
    iconColor: 'text-gray-400',
  },
} satisfies Record<ZoneStatus, {
  Icon: typeof CheckCircle2;
  label: string;
  sub: (info: ZoneInfo) => string;
  color: string;
  bg: string;
  border: string;
  iconColor: string;
}>;

function deriveStatus(data: Record<string, unknown>): ZoneInfo {
  const drivers = (data.activeDrivers as number | undefined) ?? 2;
  const pending = (data.pendingOrders as number | undefined) ?? 0;
  const etaMin = (data.etaMin as number | undefined) ?? 25;
  const etaMax = (data.etaMax as number | undefined) ?? 40;
  let status: ZoneStatus = 'available';
  if (drivers === 0) status = 'full';
  else if (pending > drivers * 3) status = 'busy';
  return { status, etaMin, etaMax, activeDrivers: drivers };
}

export function LieferzonenStatusKarte({ locationSlug }: Props) {
  const [info, setInfo] = useState<ZoneInfo>({
    status: 'available',
    etaMin: 25,
    etaMax: 40,
    activeDrivers: 2,
  });

  useEffect(() => {
    async function fetch_() {
      try {
        const res = await fetch(`/api/delivery/health?location=${encodeURIComponent(locationSlug)}`);
        if (res.ok) {
          const data = await res.json() as Record<string, unknown>;
          setInfo(deriveStatus(data));
        }
      } catch {
        // keep defaults
      }
    }
    fetch_();
    const id = setInterval(fetch_, 60_000);
    return () => clearInterval(id);
  }, [locationSlug]);

  const cfg = STATUS_CONFIG[info.status];
  const { Icon } = cfg;

  return (
    <div className={cn('flex items-center gap-3 rounded-xl px-4 py-3 border text-sm', cfg.bg, cfg.border)}>
      <Bike className={cn('w-5 h-5 flex-shrink-0', cfg.iconColor)} />
      <div className="flex-1 min-w-0">
        <p className={cn('font-semibold', cfg.color)}>{cfg.label}</p>
        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
          {(info.status === 'available' || info.status === 'busy') && (
            <Clock className="w-3 h-3" />
          )}
          {cfg.sub(info)}
        </p>
      </div>
      <Icon className={cn('w-5 h-5 flex-shrink-0', cfg.iconColor)} />
    </div>
  );
}
