'use client';

import { useState, useEffect, useCallback } from 'react';
import { Banknote, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_tip_eur: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_eur: number;
  gesamt: number;
}

const AMPEL_COLOR: Record<string, string> = {
  gruen: 'text-emerald-600',
  gelb: 'text-yellow-600',
  rot: 'text-red-600',
};

const COACHING: Record<string, string> = {
  gruen: 'Top-Trinkgeld! Freundlichkeit und Pünktlichkeit zahlen sich aus!',
  gelb: 'Solides Trinkgeld — ein Lächeln mehr macht den Unterschied.',
  rot: 'Geringes Trinkgeld — sei besonders freundlich und pünktlich.',
};

export function FahrerPhase3689MeinTrinkgeld({
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
      const res = await fetch(`/api/delivery/admin/fahrer-trinkgeld-ranking?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline || !data) return null;

  const sorted = [...data.fahrer].sort((a, b) => b.avg_tip_eur - a.avg_tip_eur);
  const ich = sorted.find((f) => f.fahrer_id === driverId) ?? sorted[0];
  if (!ich) return null;

  const rang = sorted.indexOf(ich) + 1;
  const gesamt = sorted.length;
  const pct = gesamt > 1 ? Math.round(((gesamt - rang) / (gesamt - 1)) * 100) : 100;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Banknote className="w-5 h-5 text-green-600" />
        <h3 className="font-semibold text-gray-900">Mein Trinkgeld</h3>
      </div>

      <div className="flex items-end gap-4">
        <span className={`text-5xl font-black ${AMPEL_COLOR[ich.ampel]}`}>
          {ich.avg_tip_eur.toFixed(2)} €
        </span>
        <div className="flex flex-col mb-1">
          <span className="text-xs text-gray-400">Ø/Stopp</span>
          <div className="flex items-center gap-1">
            <span className="text-3xl font-bold text-gray-400">#{rang}</span>
            {ich.rank_delta > 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            ) : ich.rank_delta < 0 ? (
              <TrendingDown className="w-4 h-4 text-red-500" />
            ) : (
              <Minus className="w-4 h-4 text-gray-400" />
            )}
            {ich.rank_delta !== 0 && (
              <span className={`text-sm font-semibold ${ich.rank_delta > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {ich.rank_delta > 0 ? '+' : ''}{ich.rank_delta}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Rang {rang} von {gesamt}</span>
          <span>Team-Ø: {data.team_avg_eur.toFixed(2)} €</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${ich.ampel === 'gruen' ? 'bg-emerald-400' : ich.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className={`text-sm px-3 py-2 rounded-lg ${ich.ampel === 'gruen' ? 'bg-emerald-50 text-emerald-700' : ich.ampel === 'gelb' ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'}`}>
        {COACHING[ich.ampel]}
      </div>
    </div>
  );
}
