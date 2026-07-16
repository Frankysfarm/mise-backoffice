'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Star } from 'lucide-react';

interface Props {
  locationId: string;
  className?: string;
}

const POLL_MS = 60 * 60 * 1000;
const THRESHOLD = 4.0;

export function StorefrontPhase2039KundenbewertungsVertrauensBadge({ locationId, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);
  const [teamAvg, setTeamAvg] = useState<number | null>(null);
  const [count, setCount] = useState<number>(0);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-bewertungs-trend?location_id=${locationId}`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        const avg: number = json.team_avg ?? 0;
        const total: number = (json.fahrer ?? []).reduce(
          (s: number, f: { bewertungs_count: number }) => s + f.bewertungs_count,
          0,
        );
        if (!cancelled) {
          setTeamAvg(avg);
          setCount(total);
          setShow(avg >= THRESHOLD);
        }
      } catch {
        if (!cancelled) setShow(false);
      }
    };

    load();
    const iv = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (!mounted || !show) return null;

  return (
    <div className={cn('flex items-center gap-1.5 rounded-full bg-yellow-950 border border-yellow-700 px-3 py-1 text-xs font-medium text-yellow-300', className)}>
      <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
      {count > 0
        ? `${count}+ begeisterte Kunden — Ø ${teamAvg?.toFixed(1)} ★`
        : `Top-Bewertung Ø ${teamAvg?.toFixed(1)} ★`}
    </div>
  );
}
