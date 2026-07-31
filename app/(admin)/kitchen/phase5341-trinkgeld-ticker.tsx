'use client';

import { useEffect, useState } from 'react';
import { HandCoins, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_trinkgeld: number;
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_trinkgeld: number;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'm1', fahrer_name: 'Julia F.', rang: 1, avg_trinkgeld: 3.20, alert_niedrig: false },
    { fahrer_id: 'm2', fahrer_name: 'Sara K.',  rang: 2, avg_trinkgeld: 2.80, alert_niedrig: false },
    { fahrer_id: 'm3', fahrer_name: 'Max M.',   rang: 3, avg_trinkgeld: 1.50, alert_niedrig: false },
    { fahrer_id: 'm4', fahrer_name: 'Tim B.',   rang: 4, avg_trinkgeld: 0.40, alert_niedrig: true  },
  ],
  team_avg_trinkgeld: 1.98,
  alert_count: 1,
  gesamt: 4,
};

export function KitchenPhase5341TriinkgeldTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    if (!locationId) { setData(MOCK); return; }
    const res = await fetch(
      `/api/delivery/admin/fahrer-trinkgeld-ranking?location_id=${locationId}`
    ).catch(() => null);
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
    <div className="rounded-xl border border-amber-700 bg-amber-900/50 px-4 py-3 mb-3 flex items-center gap-3">
      <HandCoins className="w-4 h-4 text-amber-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-400">Trinkgeld (30 Tage) — Beste/r</div>
        <div className="text-sm font-bold text-amber-100 truncate">
          #{top.rang} {top.fahrer_name} — € {top.avg_trinkgeld.toFixed(2)}
        </div>
        <div className="text-[10px] text-gray-500 mt-0.5">
          Team-Ø: € {data.team_avg_trinkgeld.toFixed(2)} · {data.gesamt} Fahrer erfasst
          {data.alert_count > 0 && (
            <span className="ml-2 text-red-400 inline-flex items-center gap-0.5">
              <AlertTriangle className="w-3 h-3" />
              {data.alert_count} niedrig
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
