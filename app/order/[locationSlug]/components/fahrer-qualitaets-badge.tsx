'use client';

// Phase 350 — FahrerQualitaetsBadge
// Storefront: Zeigt Qualitätsindikator basierend auf Wochen-Top-Fahrer-Daten

import { useEffect, useState } from 'react';
import { Award } from 'lucide-react';

interface Props {
  locationId: string | null;
  orderType: string;
}

interface TopEntry {
  rank: number;
  driverName: string | null;
  weeklyPoints: number;
  onTimeRate: number | null;
}

export function FahrerQualitaetsBadge({ locationId, orderType }: Props) {
  const [top, setTop] = useState<TopEntry | null>(null);

  useEffect(() => {
    if (!locationId || orderType !== 'lieferung') return;
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
    const iv = setInterval(load, 300_000);
    return () => { alive = false; clearInterval(iv); };
  }, [locationId, orderType]);

  if (!top || orderType !== 'lieferung') return null;
  if ((top.onTimeRate ?? 0) < 85) return null;

  return (
    <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
      <Award className="h-4 w-4 text-emerald-600 shrink-0" />
      <div className="text-sm">
        <span className="font-semibold text-emerald-800">Top-Fahrer aktiv</span>
        {top.onTimeRate !== null && (
          <span className="text-emerald-700 ml-1">· {top.onTimeRate.toFixed(0)}% Pünktlichkeit</span>
        )}
      </div>
    </div>
  );
}
