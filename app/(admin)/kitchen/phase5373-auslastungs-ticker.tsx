'use client';

import { useEffect, useState } from 'react';
import { BarChart2, AlertTriangle } from 'lucide-react';

interface ApiResponse {
  fahrer: { fahrer_id: string; fahrer_name: string; rang: number; auslastung_pct: number; alert_bottom: boolean }[];
  team_avg_pct: number;
  bester_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, auslastung_pct: 87, alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, auslastung_pct: 38, alert_bottom: true  },
  ],
  team_avg_pct: 65,
  bester_name: 'Julia F.',
  alert_count: 1,
  gesamt: 4,
};

export function KitchenPhase5373AuslastungsTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    if (!locationId) { setData(MOCK); return; }
    const res = await fetch(
      `/api/delivery/admin/fahrer-auslastungs-ranking?location_id=${locationId}`
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
      <BarChart2 className="w-4 h-4 text-blue-400 shrink-0" />
      <span className="text-xs text-gray-400">Auslastung:</span>
      {best && (
        <span className="text-xs font-semibold text-white">
          Beste/r: <span className="text-blue-400">{best.fahrer_name}</span> — {best.auslastung_pct}%
        </span>
      )}
      <span className="text-xs text-gray-400">Team-Ø: <span className="text-blue-400">{data.team_avg_pct}%</span></span>
      {data.alert_count > 0 && (
        <span className="flex items-center gap-1 text-xs text-red-400">
          <AlertTriangle className="w-3 h-3" /> {data.alert_count} niedrig
        </span>
      )}
    </div>
  );
}
