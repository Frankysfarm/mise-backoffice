'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ApiData {
  hoch_risiko_anzahl: number;
  gesamt_risiko: 'niedrig' | 'mittel' | 'hoch';
  fahrer: { risiko_stufe: string }[];
}

export function StorefrontPhase2219ZuverlaessigkeitsSiegel({
  locationId,
  className,
}: {
  locationId: string;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    setMounted(true);
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-ausfallrisiko?location_id=${locationId}`);
        if (res.ok && !cancelled) setData(await res.json());
      } catch {
        // ignore
      }
    }

    load();
    const id = setInterval(load, 6 * 60 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [locationId]);

  if (!mounted || !data) return null;

  const zuvlaessigeFahrer = data.fahrer.filter((f) => f.risiko_stufe === 'niedrig').length;
  const gesamt = data.fahrer.length;
  if (gesamt === 0) return null;

  const reliabilityPct = Math.round((zuvlaessigeFahrer / gesamt) * 100);
  if (reliabilityPct < 95) return null;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-full px-3 py-1 text-xs font-medium text-green-700 dark:text-green-400',
        className
      )}
    >
      <ShieldCheck className="w-3.5 h-3.5" />
      <span>Pünktliche Lieferung in {reliabilityPct}% der Fälle</span>
    </div>
  );
}
