'use client';
import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';

interface ApiData {
  fahrer: { avg_bewertung: number }[];
  team_avg: number;
}

interface Props {
  locationId: string;
  className?: string;
}

export function StorefrontPhase2356BewertungsSiegel({ locationId, className }: Props) {
  const [avg, setAvg] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    async function load() {
      try {
        const r = await fetch(`/api/delivery/admin/fahrer-kundenzufriedenheit?location_id=${locationId}`);
        if (!r.ok) return;
        const d: ApiData = await r.json();
        if (d.team_avg >= 4.0) setAvg(d.team_avg);
      } catch {}
    }
    load();
    const t = setInterval(load, 4 * 60 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!mounted || avg === null) return null;

  return (
    <div className={`inline-flex items-center gap-1.5 bg-yellow-50 border border-yellow-200 rounded-full px-3 py-1 text-xs text-yellow-800 font-medium ${className ?? ''}`}>
      <Star size={12} className="shrink-0 fill-yellow-400 text-yellow-400" />
      <span>⭐ {avg.toFixed(1)} von 5 — Bewertet von unseren Kunden</span>
    </div>
  );
}
