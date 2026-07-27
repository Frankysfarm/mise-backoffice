'use client';

import { useEffect, useState } from 'react';
import { TrendingDown, AlertTriangle } from 'lucide-react';

interface VerbesserungData {
  fahrer: { fahrer_id: string; fahrer_name: string; rang: number; delta_min: number; ampel: string }[];
  team_avg_delta: number;
  bester_name: string;
  alert_count: number;
  ziel_delta_min: number;
}

function fmt(v: number) {
  if (v < 0) return `${v}m`;
  if (v > 0) return `+${v}m`;
  return '±0m';
}

export function KitchenPhase3991ReactionsVerbesserungTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<VerbesserungData | null>(null);

  async function load() {
    try {
      const params = locationId ? `?location_id=${locationId}` : '';
      const res = await fetch(`/api/delivery/admin/fahrer-reaktionszeit-verbesserung${params}`);
      if (res.ok) setData(await res.json());
    } catch {}
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <TrendingDown className="w-4 h-4 text-green-600 shrink-0" />
        <span>RZ-Verbess.</span>
        <span className="ml-auto text-green-700 font-mono">
          {data.fahrer[0] ? `#1 ${data.fahrer[0].fahrer_name} ${fmt(data.fahrer[0].delta_min)}` : '—'}
        </span>
      </div>

      {data.alert_count > 0 && (
        <div className="flex items-center gap-1 mt-1 text-xs text-red-600">
          <AlertTriangle className="w-3 h-3" />
          <span>Sinkende Reaktionszeit! ({data.alert_count})</span>
        </div>
      )}

      <div className="flex items-center justify-between mt-1 text-xs text-gray-400">
        <span>Team-Avg {fmt(data.team_avg_delta)}</span>
        <span>Ziel {fmt(data.ziel_delta_min)}</span>
      </div>
    </div>
  );
}
