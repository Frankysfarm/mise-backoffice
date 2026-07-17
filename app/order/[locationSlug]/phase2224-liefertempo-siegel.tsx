'use client';

import { useEffect, useState } from 'react';

interface Props {
  locationId: string;
  className?: string;
}

export function StorefrontPhase2224LiefertempoSiegel({ locationId, className = '' }: Props) {
  const [mounted, setMounted] = useState(false);
  const [teamAvg, setTeamAvg] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    async function laden() {
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-wartezeit?location_id=${locationId}`);
        if (!res.ok) return;
        const d = await res.json();
        const avg: number | null = d?.team_avg_wartezeit ?? null;
        setTeamAvg(typeof avg === 'number' && avg < 5 ? avg : null);
      } catch {
        // noop
      }
    }

    laden();
    const id = setInterval(laden, 4 * 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [mounted, locationId]);

  if (!mounted || teamAvg === null) return null;

  return (
    <div
      className={`flex items-center gap-2 rounded-full bg-gradient-to-r from-green-400 to-teal-500 text-white px-4 py-1.5 text-sm font-semibold shadow-sm ${className}`}
    >
      <span>⚡</span>
      <span>Unsere Fahrer liefern ohne Wartezeit</span>
    </div>
  );
}
