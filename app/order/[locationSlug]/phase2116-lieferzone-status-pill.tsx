'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ZoneRow {
  zone: string;
  name: string;
  auslastungPct: number;
  status: 'ok' | 'hoch' | 'kritisch';
}

interface ApiData {
  zonen: ZoneRow[];
  alarm: boolean;
}

interface Props {
  locationId: string;
  className?: string;
}

export function StorefrontPhase2116LieferzoneStatusPill({ locationId, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [data, setData]       = useState<ApiData | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/admin/liefergebiet-auslastung?location_id=${locationId}`, { cache: 'no-store' });
        if (r.ok) setData(await r.json());
      } catch { /* silent */ }
    };
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [mounted, locationId]);

  if (!mounted || !data) return null;

  const avg = data.zonen.reduce((s, z) => s + z.auslastungPct, 0) / (data.zonen.length || 1);
  const label = avg >= 120 ? 'voll' : avg >= 80 ? 'stark belastet' : 'normal';
  const count = Math.round(data.zonen.reduce((s, z) => s + z.auslastungPct * z.auslastungPct, 0) / 100);

  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2.5 py-0.5 border',
      data.alarm
        ? 'bg-red-50 text-red-700 border-red-200'
        : avg >= 80
          ? 'bg-amber-50 text-amber-700 border-amber-200'
          : 'bg-green-50 text-green-700 border-green-200',
      className
    )}>
      <span className={cn(
        'h-1.5 w-1.5 rounded-full',
        data.alarm ? 'bg-red-500' : avg >= 80 ? 'bg-amber-500' : 'bg-green-500'
      )} />
      Deine Zone: {count > 0 ? `${count} Bestellungen · ` : ''}{label}
    </span>
  );
}
