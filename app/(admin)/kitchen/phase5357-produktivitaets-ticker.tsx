'use client';

import { useEffect, useState } from 'react';
import { Zap, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  deliveries_pro_h: number;
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_pro_h: number;
  produktivste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, deliveries_pro_h: 4.8, alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, deliveries_pro_h: 4.1, alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, deliveries_pro_h: 3.6, alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, deliveries_pro_h: 2.2, alert_niedrig: true  },
  ],
  team_avg_pro_h: 3.7,
  produktivste_name: 'Julia F.',
  alert_count: 1,
  gesamt: 4,
};

export function KitchenPhase5357ProduktivitaetsTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    if (!locationId) { setData(MOCK); return; }
    const res = await fetch(
      `/api/delivery/admin/fahrer-lieferungen-pro-stunde-ranking?location_id=${locationId}`
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
    <div className="rounded-xl border border-violet-700 bg-violet-900/50 px-4 py-3 mb-3 flex items-center gap-3">
      <Zap className="w-4 h-4 text-violet-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-400">Produktivitäts-Ranking (30 Tage) — Beste/r</div>
        <div className="text-sm font-bold text-violet-100 truncate">
          #{top.rang} {top.fahrer_name} — {top.deliveries_pro_h.toFixed(1)} Lieferungen/h
        </div>
        <div className="text-[10px] text-gray-500 mt-0.5">
          Team-Ø: {data.team_avg_pro_h.toFixed(1)}/h · {data.gesamt} Fahrer erfasst
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
