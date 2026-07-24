'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerUmsatzRow {
  fahrer_id: string;
  fahrer_name: string;
  umsatz_pro_stunde: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  rang: number;
}

interface ApiResponse {
  fahrer: FahrerUmsatzRow[];
  team_avg_umsatz: number;
  alert_count: number;
}

export function KitchenPhase3627UmsatzProStundeTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-umsatz-pro-stunde?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch {}
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!data || !locationId) return null;

  const sorted = [...data.fahrer].sort((a, b) => b.umsatz_pro_stunde - a.umsatz_pro_stunde);
  const bester = sorted[0];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-500" />
          <span className="font-semibold text-sm text-gray-900">Umsatz/h Ticker</span>
        </div>
        <div className="text-xs text-gray-500">
          <span className="font-bold text-emerald-700">#1 {bester?.fahrer_name}</span>
          <span className="ml-1">{bester?.umsatz_pro_stunde.toFixed(1) ?? '–'} €/h</span>
        </div>
      </div>

      {data.alert_count > 0 && (
        <div className="flex items-center gap-1 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
          <AlertTriangle className="w-3 h-3" />
          <span>Niedriger Umsatz/h!</span>
        </div>
      )}

      <div className="space-y-1">
        {sorted.map((f, i) => (
          <div key={f.fahrer_id} className="flex items-center gap-2 text-xs">
            <span className="text-gray-400 w-4">#{i + 1}</span>
            <span className="flex-1 truncate font-medium text-gray-800">{f.fahrer_name}</span>
            <span className={`font-bold w-14 text-right ${f.ampel === 'gruen' ? 'text-emerald-600' : f.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-600'}`}>
              {f.umsatz_pro_stunde.toFixed(1)} €/h
            </span>
            {f.rank_delta > 0 ? (
              <TrendingUp className="w-3 h-3 text-emerald-500" />
            ) : f.rank_delta < 0 ? (
              <TrendingDown className="w-3 h-3 text-red-400" />
            ) : (
              <Minus className="w-3 h-3 text-gray-300" />
            )}
          </div>
        ))}
      </div>

      <div className="text-xs text-gray-400 text-center">Team-Ø: {data.team_avg_umsatz.toFixed(1)} €/h · Ziel ≥35 €/h</div>
    </div>
  );
}
