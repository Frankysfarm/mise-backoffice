'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Flame } from 'lucide-react';

interface Props {
  locationId: string;
  className?: string;
}

interface KategorieTempoRow {
  avg_min: number;
  bestellungen: number;
}

const POLL_MS = 30 * 60 * 1000;
const DEFAULT_MOCK_MIN = 18;

export function StorefrontPhase2063FrischeGarantieBadge({ locationId, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [avgMin, setAvgMin] = useState<number | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/zubereitungs-tempo-analyse?location_id=${locationId}`);
        if (!res.ok) throw new Error();
        const rows: KategorieTempoRow[] = await res.json();
        const arr = Array.isArray(rows) ? rows : [];
        if (arr.length === 0) { if (!cancelled) setAvgMin(DEFAULT_MOCK_MIN); return; }
        const totalOrders = arr.reduce((s, r) => s + (r.bestellungen ?? 1), 0);
        const weightedSum = arr.reduce((s, r) => s + r.avg_min * (r.bestellungen ?? 1), 0);
        const overallAvg = totalOrders > 0 ? Math.round(weightedSum / totalOrders) : DEFAULT_MOCK_MIN;
        if (!cancelled) setAvgMin(overallAvg);
      } catch {
        if (!cancelled) setAvgMin(DEFAULT_MOCK_MIN);
      }
    };

    load();
    const iv = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (!mounted || avgMin === null) return null;

  return (
    <div className={cn(
      'flex items-center gap-2 rounded-full bg-orange-950 border border-orange-700 px-3 py-1.5 text-xs font-medium text-orange-200',
      className,
    )}>
      <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0" />
      <span>Frisch zubereitet · Ø {avgMin} Min Kochzeit</span>
    </div>
  );
}
