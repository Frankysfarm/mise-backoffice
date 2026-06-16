'use client';

import { useEffect, useState } from 'react';
import { Users, AlertTriangle, CheckCircle } from 'lucide-react';
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

export function KapazitaetsWarnung({ locationId }: Props) {
  const [gaps, setGaps] = useState<CapacitySlot[] | null>(null);

  useEffect(() => {
    const load = async () => {
      const res = await fetch(
        `/api/delivery/admin/capacity-planner?action=gaps&location_id=${locationId}`,
      );
      if (res.ok) {
        const json = await res.json() as ApiResponse;
        setGaps(json.gaps ?? []);
      }
    };
    void load();
    const iv = setInterval(() => void load(), 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (gaps === null) return null;

  if (gaps.length === 0) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs border border-emerald-200">
        <CheckCircle className="h-3 w-3" />
        Besetzung heute OK
      </div>
    );
  }

  const uncovered = gaps.filter((g) => g.scheduledDrivers === 0);
  const nextGap = gaps[0];

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border ${uncovered.length > 0 ? 'bg-red-50 border-red-200 text-red-700 animate-pulse' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span>
        {uncovered.length > 0
          ? `${hourLabel(nextGap.hourOfDay)} unbesetzt`
          : `${gaps.length} Slot${gaps.length > 1 ? 's' : ''} unterbesetzt`}
      </span>
      <Users className="h-3 w-3" />
    </div>
  );
}
