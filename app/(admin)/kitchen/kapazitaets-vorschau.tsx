'use client';

import { useEffect, useState } from 'react';
import { Users, AlertTriangle } from 'lucide-react';
import type { CapacitySlot } from '@/lib/delivery/capacity-planner';

interface Props {
  locationId: string;
}

interface ApiResponse {
  ok: boolean;
  gaps: CapacitySlot[];
}

function hourLabel(h: number) {
  return `${String(h).padStart(2, '0')}:00`;
}

export function KapazitaetsVorschau({ locationId }: Props) {
  const [gaps, setGaps] = useState<CapacitySlot[]>([]);

  useEffect(() => {
    const load = async () => {
      const res = await fetch(
        `/api/delivery/admin/capacity-planner?action=gaps&location_id=${locationId}`,
      );
      if (res.ok) {
        const json = await res.json() as ApiResponse;
        setGaps((json.gaps ?? []).slice(0, 3));
      }
    };
    void load();
    const iv = setInterval(() => void load(), 10 * 60 * 1000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (gaps.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
        <AlertTriangle className="h-3.5 w-3.5" />
        Fahrermangel — nächste Stunden
      </div>
      {gaps.map((g) => (
        <div key={g.id} className="flex items-center justify-between text-xs">
          <span className="font-mono text-amber-700">{hourLabel(g.hourOfDay)}</span>
          <span className="text-amber-900">
            {g.scheduledDrivers === 0 ? (
              <span className="text-red-600 font-medium">kein Fahrer geplant</span>
            ) : (
              <span>{g.scheduledDrivers}/{g.recommendedDrivers} Fahrer</span>
            )}
          </span>
          <Users className="h-3 w-3 text-amber-500" />
        </div>
      ))}
    </div>
  );
}
