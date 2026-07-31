'use client';

import { useEffect, useState } from 'react';
import { Euro, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  umsatz_avg: number;
  alert_low: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'm1', fahrer_name: 'Julia F.', rang: 1, umsatz_avg: 38.00, alert_low: false },
    { fahrer_id: 'm2', fahrer_name: 'Sara K.',  rang: 2, umsatz_avg: 32.00, alert_low: false },
    { fahrer_id: 'm3', fahrer_name: 'Max M.',   rang: 3, umsatz_avg: 27.00, alert_low: false },
    { fahrer_id: 'm4', fahrer_name: 'Tim B.',   rang: 4, umsatz_avg: 21.00, alert_low: true  },
  ],
  team_avg: 29.50,
  alert_count: 1,
  gesamt: 4,
};

export function KitchenPhase5345UmsatzTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    if (!locationId) { setData(MOCK); return; }
    const res = await fetch(
      `/api/delivery/admin/fahrer-umsatz-pro-tour?location_id=${locationId}`
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
    <div className="rounded-xl border border-green-700 bg-green-900/50 px-4 py-3 mb-3 flex items-center gap-3">
      <Euro className="w-4 h-4 text-green-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-400">Umsatz Ø/Tour (30 Tage) — Beste/r</div>
        <div className="text-sm font-bold text-green-100 truncate">
          #{top.rang} {top.fahrer_name} — € {top.umsatz_avg.toFixed(2)}
        </div>
        <div className="text-[10px] text-gray-500 mt-0.5">
          Team-Ø: € {data.team_avg.toFixed(2)} · {data.gesamt} Fahrer erfasst
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
