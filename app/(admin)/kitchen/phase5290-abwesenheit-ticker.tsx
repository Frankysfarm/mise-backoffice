'use client';

import { useEffect, useState } from 'react';
import { UserMinus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  abwesenheit_tage: number;
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: '1', fahrer_name: 'Anna M.', rang: 1, abwesenheit_tage: 0, alert_hoch: false },
  ],
  team_avg: 4.0,
  alert_count: 1,
  gesamt: 6,
};

export function KitchenPhase5290AbwesenheitTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const url = locationId
      ? `/api/delivery/admin/fahrer-abwesenheit-ranking?location_id=${locationId}`
      : '/api/delivery/admin/fahrer-abwesenheit-ranking';
    const res = await fetch(url).catch(() => null);
    if (res?.ok) setData(await res.json());
    else setData(MOCK);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data?.fahrer?.length) return null;

  const top = data.fahrer[0];

  return (
    <div className="rounded-xl border border-red-700 bg-red-900/60 px-4 py-3 mb-3 flex items-center gap-3">
      <UserMinus className="w-4 h-4 text-red-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-400">Abwesenheit — Wenigste</div>
        <div className="text-sm font-bold text-red-100 truncate">
          #{top.rang} {top.fahrer_name} — {top.abwesenheit_tage} Tage
        </div>
        <div className="text-[10px] text-gray-500 mt-0.5">
          Team-Ø: {data.team_avg.toFixed(1)} Tage · {data.gesamt} Fahrer erfasst
          {data.alert_count > 0 && (
            <span className="ml-2 text-red-400 inline-flex items-center gap-0.5">
              <AlertTriangle className="w-3 h-3" />
              {data.alert_count} Hoch-Alert
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
