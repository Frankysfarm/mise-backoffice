'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, TrendingUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type WaveLevel = 'normal' | 'elevated' | 'rush' | 'extreme';

interface WaveData {
  currentRatePerHour: number;
  avgRatePerHour: number;
  multiplier: number;
  level: WaveLevel;
  ordersLast30Min: number;
  peakHour: number | null;
  etaAbklingMin: number | null;
  alertMessage: string | null;
}

interface ApiResponse {
  ok: boolean;
  data: WaveData;
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

const levelConfig: Record<WaveLevel, { bg: string; border: string; icon: React.ReactNode; label: string } | null> = {
  normal: null,
  elevated: {
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    icon: <TrendingUp className="h-4 w-4 text-amber-600 shrink-0" />,
    label: 'Erhöhte Nachfrage',
  },
  rush: {
    bg: 'bg-orange-50',
    border: 'border-orange-400',
    icon: <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0" />,
    label: 'Rush erkannt',
  },
  extreme: {
    bg: 'bg-red-50',
    border: 'border-red-500',
    icon: <Zap className="h-4 w-4 text-red-600 shrink-0 animate-pulse" />,
    label: 'Extrem-Rush!',
  },
};

export function KitchenOrderWaveAlert({ locationId }: Props) {
  const [data, setData] = useState<WaveData | null>(null);

  const load = () => {
    if (!locationId) return;
    fetch(`/api/delivery/admin/order-wave-detector?location_id=${encodeURIComponent(locationId)}`)
      .then((r) => r.json())
      .then((d: ApiResponse) => setData(d.data ?? null))
      .catch(() => {});
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId || !data) return null;

  const cfg = levelConfig[data.level];
  if (!cfg) return null;

  return (
    <div className={cn('rounded-2xl border px-5 py-4 flex items-start gap-3', cfg.bg, cfg.border)}>
      {cfg.icon}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-sm">{cfg.label}</span>
          {data.multiplier > 1 && (
            <span className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-black',
              data.level === 'extreme' ? 'bg-red-500 text-white' : 'bg-amber-400 text-white',
            )}>
              {data.multiplier}× Ø
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {data.ordersLast30Min} Bestellungen in den letzten 30 Min · {data.currentRatePerHour}/h aktuell (Ø {data.avgRatePerHour}/h)
          {data.etaAbklingMin !== null && ` · Abklingen ca. in ${data.etaAbklingMin} Min`}
        </p>
      </div>
    </div>
  );
}
