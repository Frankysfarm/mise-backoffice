'use client';

import { useState, useEffect, useCallback } from 'react';
import { XCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  storno_quote: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
}

const AMPEL_TEXT: Record<string, string> = {
  gruen: 'text-emerald-600',
  gelb: 'text-yellow-600',
  rot: 'text-red-600',
};

const COACHING: Record<string, string> = {
  gruen: 'Sehr niedrige Stornoquote! Du lieferst zuverlässig ab.',
  gelb: 'Solide Quote. Achte auf klare Kommunikation mit Kunden.',
  rot: 'Deine Stornoquote ist zu hoch. Prüfe Ursachen bei stornierten Aufträgen.',
};

export function FahrerPhase3710MeineStornoquote({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-stornoquote?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline) return null;
  if (loading) return <div className="animate-pulse h-32 bg-gray-100 rounded-xl" />;
  if (!data || !locationId) return null;

  const me = data.fahrer.find((f) => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!me) return null;

  const total = data.fahrer.length;
  const barPct = total > 1 ? Math.round(((total - me.rang) / (total - 1)) * 100) : 100;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <XCircle className="w-5 h-5 text-red-500" />
        <h3 className="font-semibold text-gray-900">Meine Stornoquote</h3>
      </div>

      <div className="flex items-end gap-4">
        <span className={`text-5xl font-black tabular-nums ${AMPEL_TEXT[me.ampel]}`}>
          {me.storno_quote}<span className="text-2xl font-bold ml-1">%</span>
        </span>
        <div className="flex flex-col items-start">
          <span className={`text-3xl font-bold ${AMPEL_TEXT[me.ampel]}`}>#{me.rang}</span>
          <span className="text-xs text-gray-400">von {total}</span>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Bester</span>
          <span>Höchste</span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-2 rounded-full ${me.ampel === 'gruen' ? 'bg-emerald-500' : me.ampel === 'gelb' ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${Math.max(barPct, 4)}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Team-Ø {data.team_avg}%</span>
        <span className="flex items-center gap-1">
          {me.rank_delta < 0 ? (
            <><TrendingUp className="w-3 h-3 text-emerald-600" /><span className="text-emerald-600">Verbessert</span></>
          ) : me.rank_delta > 0 ? (
            <><TrendingDown className="w-3 h-3 text-red-500" /><span className="text-red-500">Verschlechtert</span></>
          ) : (
            <><Minus className="w-3 h-3 text-gray-400" /><span>Stabil</span></>
          )}
        </span>
      </div>

      <div className={`text-xs px-3 py-2 rounded-lg ${me.ampel === 'gruen' ? 'bg-emerald-50 text-emerald-700' : me.ampel === 'gelb' ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'}`}>
        {COACHING[me.ampel]}
      </div>
    </div>
  );
}
