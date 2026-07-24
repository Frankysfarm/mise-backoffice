'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  avg_bestellwert: number;
  rang: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_low: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  gesamt: number;
}

const AMPEL_COLOR: Record<string, string> = {
  gruen: 'text-emerald-600',
  gelb: 'text-orange-500',
  rot: 'text-red-600',
};

const COACHING: Record<string, string> = {
  gruen: 'Top-Bestellwert! Weiter so.',
  gelb: 'Solider Bestellwert — Upsells können helfen.',
  rot: 'Niedriger Bestellwert — auf Zusatzartikel hinweisen.',
};

export function FahrerPhase3665MeinBestellwert({
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
      const res = await fetch(`/api/delivery/admin/fahrer-bestellwert?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline || !data) return null;

  const ich = data.fahrer.find((f) => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!ich) return null;

  const DeltaIcon = ich.rank_delta > 0 ? TrendingUp : ich.rank_delta < 0 ? TrendingDown : Minus;
  const deltaColor = ich.rank_delta > 0 ? 'text-emerald-500' : ich.rank_delta < 0 ? 'text-red-500' : 'text-gray-400';
  const pct = data.gesamt > 1 ? Math.round(((data.gesamt - ich.rang) / (data.gesamt - 1)) * 100) : 100;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-emerald-500" />
        <h3 className="font-semibold text-gray-900">Mein Ø Bestellwert</h3>
      </div>

      <div className="flex items-end gap-4">
        <span className={`text-5xl font-black ${AMPEL_COLOR[ich.ampel]}`}>
          {ich.avg_bestellwert.toFixed(2)} €
        </span>
        <div className="flex items-center gap-1 mb-1">
          <span className={`text-3xl font-bold text-gray-400`}>#{ich.rang}</span>
          <DeltaIcon className={`w-4 h-4 ${deltaColor}`} />
          {ich.rank_delta !== 0 && (
            <span className={`text-sm font-semibold ${deltaColor}`}>
              {ich.rank_delta > 0 ? `+${ich.rank_delta}` : ich.rank_delta}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Rang {ich.rang} von {data.gesamt}</span>
          <span>Team-Ø: {data.team_avg.toFixed(2)} €</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${ich.ampel === 'gruen' ? 'bg-emerald-400' : ich.ampel === 'gelb' ? 'bg-orange-400' : 'bg-red-400'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className={`text-sm px-3 py-2 rounded-lg ${ich.ampel === 'gruen' ? 'bg-emerald-50 text-emerald-700' : ich.ampel === 'gelb' ? 'bg-orange-50 text-orange-700' : 'bg-red-50 text-red-700'}`}>
        {COACHING[ich.ampel]}
      </div>
    </div>
  );
}
