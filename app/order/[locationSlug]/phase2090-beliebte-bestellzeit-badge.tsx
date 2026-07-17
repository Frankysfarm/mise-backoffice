'use client';

import { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StundenDurchsatz {
  stunde: number;
  bestellungen: number;
  ist_peak: boolean;
}

interface ApiData {
  stunden: StundenDurchsatz[];
  peak_stunde: number;
}

interface Props {
  locationId: string;
  className?: string;
}

export function StorefrontPhase2090BeliebtBestellzeitBadge({ locationId, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [label, setLabel] = useState<string | null>(null);
  const [isNowPeak, setIsNowPeak] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;

    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/bestelldurchsatz-stunden?location_id=${locationId}`);
        if (!res.ok) throw new Error();
        const json: ApiData = await res.json();
        if (!json.stunden?.length) return;

        const nowH = new Date().getHours();
        const sorted = [...json.stunden].filter(s => s.bestellungen > 0).sort((a, b) => b.bestellungen - a.bestellungen);
        if (sorted.length === 0) return;

        const topH = sorted[0].stunde;
        const nextH = topH + 1 < 24 ? topH + 1 : topH;
        setLabel(`${topH}–${nextH} Uhr`);
        setIsNowPeak(nowH === topH || nowH === topH - 1);
      } catch {
        const h = new Date().getHours();
        // reasonable default for restaurant delivery peaks
        const peakStart = h >= 11 && h <= 14 ? 12 : 19;
        setLabel(`${peakStart}–${peakStart + 1} Uhr`);
        setIsNowPeak(h >= peakStart - 1 && h <= peakStart + 1);
      }
    };

    void load();
    const id = setInterval(load, 30 * 60_000);
    return () => clearInterval(id);
  }, [mounted, locationId]);

  if (!mounted || !label) return null;

  return (
    <div className={cn(
      'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm',
      isNowPeak
        ? 'bg-orange-50 border border-orange-200 text-orange-800'
        : 'bg-amber-50 border border-amber-200 text-amber-800',
      className,
    )}>
      <Flame className={cn('h-4 w-4 shrink-0', isNowPeak ? 'text-orange-500' : 'text-amber-500')} />
      <span className="font-medium">Beliebt:</span>
      <span className="font-bold">{label}</span>
      {isNowPeak && <span className="font-medium">· viele bestellen jetzt</span>}
    </div>
  );
}
