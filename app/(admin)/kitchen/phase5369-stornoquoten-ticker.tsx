'use client';

import { useEffect, useState } from 'react';
import { XCircle, AlertTriangle } from 'lucide-react';

interface ApiResponse {
  fahrer: { fahrer_id: string; fahrer_name: string; rang: number; rate_pct: number; alert_hoch: boolean }[];
  team_avg_rate: number;
  beste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, rate_pct: 1, alert_hoch: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, rate_pct: 17, alert_hoch: true },
  ],
  team_avg_rate: 8,
  beste_name: 'Julia F.',
  alert_count: 1,
  gesamt: 4,
};

export function KitchenPhase5369StornoquotenTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    if (!locationId) { setData(MOCK); return; }
    const res = await fetch(
      `/api/delivery/admin/fahrer-storno-rate-ranking?location_id=${locationId}`
    );
    if (!res.ok) { setData(MOCK); return; }
    setData(await res.json());
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!data) return null;

  const best = data.fahrer.find(f => f.rang === 1);

  return (
    <div className="bg-gray-900 rounded-xl p-3 flex items-center gap-3 flex-wrap">
      <XCircle className="w-4 h-4 text-orange-400 shrink-0" />
      <span className="text-xs text-gray-400">Stornoquote:</span>
      {best && (
        <span className="text-xs font-semibold text-white">
          Beste/r: <span className="text-green-400">{best.fahrer_name}</span> — {best.rate_pct}%
        </span>
      )}
      <span className="text-xs text-gray-400">Team-Ø: <span className="text-orange-400">{data.team_avg_rate}%</span></span>
      {data.alert_count > 0 && (
        <span className="flex items-center gap-1 text-xs text-red-400">
          <AlertTriangle className="w-3 h-3" /> {data.alert_count} hoch (&gt;10%)
        </span>
      )}
    </div>
  );
}
