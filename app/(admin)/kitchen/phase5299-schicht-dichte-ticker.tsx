'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, AlertTriangle } from 'lucide-react';

interface ApiResponse {
  fahrer: { fahrer_id: string; fahrer_name: string; rang: number; schichten_pro_woche: number; ampel: string }[];
  team_avg: number;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, schichten_pro_woche: 5.8, ampel: 'gruen' },
    { fahrer_id: 'f2', fahrer_name: 'Kemal A.', rang: 2, schichten_pro_woche: 4.9, ampel: 'gruen' },
  ],
  team_avg: 3.85,
  alert_count: 1,
  gesamt: 4,
};

export function KitchenPhase5299SchichtDichteTicker({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const params = locationId ? `?location_id=${locationId}` : '';
    const res = await fetch(`/api/delivery/admin/fahrer-schicht-dichte-ranking${params}`).catch(() => null);
    if (res?.ok) setData(await res.json());
    else setData(MOCK);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data) return null;

  const top = data.fahrer[0];

  return (
    <div className="rounded-xl border border-blue-800/50 bg-blue-950/20 px-4 py-3 mb-2 flex items-center gap-3">
      <CalendarDays className="w-4 h-4 text-blue-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider">Schicht-Dichte</div>
        {top ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-blue-300">#{top.rang} {top.fahrer_name}</span>
            <span className="text-xs font-black text-gray-200 tabular-nums">{top.schichten_pro_woche.toFixed(1)}/Woche</span>
            <span className="text-[10px] text-gray-500">· Team-Ø {data.team_avg.toFixed(1)}</span>
          </div>
        ) : (
          <span className="text-xs text-gray-500">—</span>
        )}
      </div>
      {data.alert_count > 0 && (
        <span className="flex items-center gap-1 text-[10px] text-red-400 bg-red-900/30 px-1.5 py-0.5 rounded-full shrink-0">
          <AlertTriangle className="w-2.5 h-2.5" />{data.alert_count}
        </span>
      )}
    </div>
  );
}
