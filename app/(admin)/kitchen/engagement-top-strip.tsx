'use client';

// Phase 350 — KitchenEngagementTopStrip
// Zeigt den aktuellen Wochen-Top-Fahrer im Küchen-Dashboard.

import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';

interface TopEntry {
  rank: number;
  driverName: string | null;
  weeklyPoints: number;
  deliveries: number;
  onTimeRate: number | null;
}

interface Props {
  locationId: string | null;
}

export function KitchenEngagementTopStrip({ locationId }: Props) {
  const [top, setTop] = useState<TopEntry | null>(null);

  useEffect(() => {
    if (!locationId) return;
    let alive = true;

    const load = async () => {
      try {
        const res = await fetch(
          `/api/delivery/admin/driver-engagement?action=leaderboard&limit=1&location_id=${locationId}`,
        );
        if (!res.ok || !alive) return;
        const data = await res.json() as TopEntry[];
        setTop(data[0] ?? null);
      } catch {
        // silent
      }
    };

    void load();
    const iv = setInterval(load, 120_000);
    return () => { alive = false; clearInterval(iv); };
  }, [locationId]);

  if (!top) return null;

  return (
    <div className="mx-3 mb-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2 flex items-center gap-3">
      <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
      <span className="text-sm font-semibold text-amber-900">
        🥇 Wochen-Top: <span className="text-amber-700">{top.driverName ?? 'Fahrer'}</span>
      </span>
      <span className="text-xs text-amber-700 ml-auto">
        {top.weeklyPoints} Pts · {top.deliveries} Lieferungen
        {top.onTimeRate !== null ? ` · ${top.onTimeRate.toFixed(0)}% pünktlich` : ''}
      </span>
    </div>
  );
}
