'use client';

import { useState, useEffect, useCallback } from 'react';
import { Package, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  avg_abholzeit_min: number;
  rang: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
}

const MOCK: ApiResponse = {
  team_avg: 3.4,
  fahrer: [
    { fahrer_id: '1', fahrer_name: 'Thomas W.', avg_abholzeit_min: 1.8, rang: 1, rank_delta: 0, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: '2', fahrer_name: 'Mia S.', avg_abholzeit_min: 2.9, rang: 2, rank_delta: 1, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: '3', fahrer_name: 'Jan K.', avg_abholzeit_min: 4.1, rang: 3, rank_delta: -1, ampel: 'gelb', alert_hoch: false },
    { fahrer_id: '4', fahrer_name: 'Sara B.', avg_abholzeit_min: 6.8, rang: 4, rank_delta: 0, ampel: 'rot', alert_hoch: true },
  ],
};

const AMPEL_COLOR: Record<string, string> = {
  gruen: 'text-emerald-600',
  gelb: 'text-orange-500',
  rot: 'text-red-600',
};

const AMPEL_BG: Record<string, string> = {
  gruen: 'bg-emerald-50 border-emerald-200',
  gelb: 'bg-orange-50 border-orange-200',
  rot: 'bg-red-50 border-red-200',
};

const COACHING: Record<string, string> = {
  gruen: 'Top-Abholzeit! Weiter so.',
  gelb: 'Solide — kurze Wartezeiten sind möglich.',
  rot: 'Hohe Abholzeit — zügiger ans Restaurant fahren.',
};

export function FahrerPhase3671MeineAbholzeit({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<ApiResponse | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-wartezeit?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch {}
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const source = data ?? MOCK;
  const me = source.fahrer.find(f => f.fahrer_id === driverId) ?? source.fahrer[0];
  if (!me) return null;

  const DeltaIcon = me.rank_delta < 0 ? TrendingUp : me.rank_delta > 0 ? TrendingDown : Minus;
  const deltaColor = me.rank_delta < 0 ? 'text-emerald-500' : me.rank_delta > 0 ? 'text-red-500' : 'text-gray-400';

  return (
    <div className={`rounded-xl border p-3 space-y-2 ${AMPEL_BG[me.ampel]}`}>
      <div className="flex items-center gap-2">
        <Package className="w-4 h-4 text-blue-500" />
        <span className="font-semibold text-gray-900 text-sm">Meine Abholzeit</span>
        <span className="ml-auto text-xs text-gray-400">Rang #{me.rang}</span>
      </div>

      <div className="flex items-center gap-3">
        <span className={`text-3xl font-black ${AMPEL_COLOR[me.ampel]}`}>
          {me.avg_abholzeit_min.toFixed(1)}<span className="text-base font-medium">min</span>
        </span>
        <div className="flex items-center gap-1">
          <DeltaIcon className={`w-4 h-4 ${deltaColor}`} />
          {me.rank_delta !== 0 && (
            <span className={`text-sm font-medium ${deltaColor}`}>
              {me.rank_delta > 0 ? `+${me.rank_delta}` : me.rank_delta} Platz
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-600">{COACHING[me.ampel]}</p>

      <div className="flex justify-between text-xs text-gray-400 border-t pt-1">
        <span>Team-Ø: {source.team_avg.toFixed(1)}min</span>
        <span>Ziel ≤3min</span>
      </div>
    </div>
  );
}
