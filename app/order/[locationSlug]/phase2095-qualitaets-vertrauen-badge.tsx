'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ShieldCheck } from 'lucide-react';

interface Props {
  locationId: string;
  className?: string;
}

export function StorefrontPhase2095QualitaetsVertrauenBadge({ locationId, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [topName, setTopName] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    async function load() {
      try {
        const res = await fetch(`/api/delivery/admin/tages-qualitaets-score?location_id=${locationId}`);
        if (res.ok) {
          const data = await res.json();
          setScore(data.team_score ?? null);
          setTopName(data.top_fahrer ?? null);
        }
      } catch { /* ignore */ }
    }
    load();
    const t = setInterval(load, 30 * 60_000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!mounted || score === null || score < 60) return null;

  const label =
    score >= 90 ? 'Exzellente Servicequalität' :
    score >= 80 ? 'Sehr gute Servicequalität' :
    'Gute Servicequalität';

  return (
    <div className={cn('flex items-center gap-2 rounded-full border border-matcha-200 bg-matcha-50 px-3 py-1.5', className)}>
      <ShieldCheck className="h-4 w-4 text-matcha-600 shrink-0" />
      <span className="text-xs font-semibold text-matcha-800">
        {label} · Score {score}
        {topName && <span className="font-normal text-matcha-600"> · Bester Fahrer: {topName}</span>}
      </span>
    </div>
  );
}
