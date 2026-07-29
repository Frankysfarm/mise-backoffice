'use client';

import { useEffect, useState } from 'react';
import { Star, AlertTriangle } from 'lucide-react';

interface ApiResponse {
  fahrer: { fahrer_name: string; zufriedenheits_index: number; ampel: string }[];
  team_avg_index: number;
  beste_name: string;
  alert_count: number;
}

export function KitchenPhase4716ZufriedenheitsTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-zufriedenheits-index-ranking?location_id=${locationId}`);
      if (r.ok) setData(await r.json());
    } catch { /* silent */ }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return (
    <div className="rounded-xl bg-indigo-900 p-3 text-indigo-300 text-xs animate-pulse">
      Lade Zufriedenheits-Ticker…
    </div>
  );

  const top = data.fahrer[0];

  return (
    <div className="rounded-xl bg-indigo-900 text-white p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Star className="w-4 h-4 text-indigo-300" />
        <span className="text-xs font-semibold text-indigo-100">Zufriedenheits-Index</span>
      </div>

      {data.alert_count > 0 && (
        <div className="flex items-center gap-1 text-red-300 text-[10px]">
          <AlertTriangle className="w-3 h-3" />
          Niedriger Team-Index!
        </div>
      )}

      {top && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-indigo-300">#1 {top.fahrer_name}</span>
          <span className="text-lg font-black text-emerald-400">{top.zufriedenheits_index}</span>
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] text-indigo-400">
        <span>Team-Ø</span>
        <span className="font-semibold text-indigo-200">{data.team_avg_index}</span>
      </div>
    </div>
  );
}
