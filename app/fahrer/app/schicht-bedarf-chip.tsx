'use client';

import { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';
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

export function SchichtBedarfChip({ locationId }: Props) {
  const [peaks, setPeaks] = useState<CapacitySlot[]>([]);

  useEffect(() => {
    const load = async () => {
      const res = await fetch(
        `/api/delivery/admin/capacity-planner?action=gaps&location_id=${locationId}`,
      );
      if (res.ok) {
        const json = await res.json() as ApiResponse;
        // Show up to 2 gaps with recommendation
        setPeaks((json.gaps ?? []).filter((g) => g.coverageGap > 0).slice(0, 2));
      }
    };
    void load();
    const iv = setInterval(() => void load(), 15 * 60 * 1000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (peaks.length === 0) return null;

  return (
    <div className="rounded-xl bg-orange-50 border border-orange-200 p-3 text-sm">
      <div className="flex items-center gap-1.5 font-medium text-orange-700 mb-1.5">
        <Flame className="h-4 w-4" />
        Fahrerbedarf heute
      </div>
      <div className="space-y-1">
        {peaks.map((p) => (
          <div key={p.id} className="flex justify-between text-xs text-orange-600">
            <span>{hourLabel(p.hourOfDay)} Uhr</span>
            <span>{p.coverageGap} Fahrer{p.coverageGap > 1 ? ' fehlen' : ' fehlt'}</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-orange-400 mt-1.5">Bitte Schicht einplanen!</p>
    </div>
  );
}
