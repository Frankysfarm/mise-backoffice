'use client';

import { useEffect, useState } from 'react';
import { Star, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_rating: number;
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_rating: number;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'm1', fahrer_name: 'Julia F.', rang: 1, avg_rating: 4.9, alert_niedrig: false },
    { fahrer_id: 'm2', fahrer_name: 'Sara K.',  rang: 2, avg_rating: 4.6, alert_niedrig: false },
    { fahrer_id: 'm3', fahrer_name: 'Max M.',   rang: 3, avg_rating: 4.1, alert_niedrig: false },
    { fahrer_id: 'm4', fahrer_name: 'Tim B.',   rang: 4, avg_rating: 3.3, alert_niedrig: true  },
  ],
  team_avg_rating: 4.2,
  alert_count: 1,
  gesamt: 4,
};

export function KitchenPhase5337BewertungsTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    if (!locationId) { setData(MOCK); return; }
    const res = await fetch(
      `/api/delivery/admin/fahrer-bewertungs-ranking?location_id=${locationId}`
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
    <div className="rounded-xl border border-yellow-700 bg-yellow-900/50 px-4 py-3 mb-3 flex items-center gap-3">
      <Star className="w-4 h-4 text-yellow-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-400">Bewertung (30 Tage) — Beste/r</div>
        <div className="text-sm font-bold text-yellow-100 truncate">
          #{top.rang} {top.fahrer_name} — ★ {top.avg_rating}
        </div>
        <div className="text-[10px] text-gray-500 mt-0.5">
          Team-Ø: ★ {data.team_avg_rating} · {data.gesamt} Fahrer erfasst
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
