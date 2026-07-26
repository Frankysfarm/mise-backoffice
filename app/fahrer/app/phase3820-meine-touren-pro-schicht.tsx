'use client';

import { useState, useEffect, useCallback } from 'react';
import { Package, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

interface FahrerSingle {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  touren_pro_schicht: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_wenig: boolean;
}

interface ApiData {
  fahrer_single: FahrerSingle;
  team_avg: number;
  gesamt: number;
  ziel: number;
}

const MOCK: ApiData = {
  fahrer_single: { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, touren_pro_schicht: 8.5, rank_delta: 1, ampel: 'gruen', alert_wenig: false },
  team_avg: 6.35,
  gesamt: 4,
  ziel: 6.0,
};

export function FahrerPhase3820MeineTourenProSchicht({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/fahrer-touren-pro-schicht-ranking?location_id=${locationId}&driver_id=${driverId}`,
      );
      if (res.ok) setData(await res.json());
    } catch {
      // Mock-Fallback
    } finally {
      setLoading(false);
    }
  }, [locationId, driverId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline) return null;

  const f = data.fahrer_single;
  const rangPct = data.gesamt > 1 ? ((data.gesamt - f.rang) / (data.gesamt - 1)) * 100 : 100;
  const zielPct = Math.min((f.touren_pro_schicht / data.ziel) * 100, 100);

  const ampelText =
    f.ampel === 'gruen' ? 'text-emerald-700' : f.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-500';
  const ampelBg =
    f.ampel === 'gruen' ? 'bg-emerald-50' : f.ampel === 'gelb' ? 'bg-yellow-50' : 'bg-red-50';
  const ampelBar =
    f.ampel === 'gruen' ? 'bg-emerald-500' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';

  const coaching =
    f.ampel === 'gruen'
      ? 'Starke Leistung! Du lieferst überdurchschnittlich viele Touren pro Schicht.'
      : f.ampel === 'gelb'
      ? 'Solide — versuche, deine Touren pro Schicht auf ≥6.0 zu steigern.'
      : 'Wenige Touren diese Periode. Versuche, effizienter zwischen Aufträgen zu wechseln.';

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${ampelBg} border-gray-200`}>
      <div className="flex items-center gap-2">
        <Package className="w-5 h-5 text-orange-500" />
        <span className="font-semibold text-gray-900 text-sm">Meine Touren/Schicht</span>
        {loading && <span className="w-3 h-3 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />}
      </div>

      <div className="flex items-end justify-between">
        <div>
          <span className={`text-5xl font-black ${ampelText}`}>{f.touren_pro_schicht.toFixed(1)}</span>
          <span className="text-lg text-gray-500 ml-1">T/S</span>
        </div>
        <div className="text-right">
          <div className={`text-3xl font-black ${ampelText}`}>#{f.rang}</div>
          <div className="text-xs text-gray-500">von {data.gesamt}</div>
        </div>
      </div>

      {f.rank_delta !== 0 && (
        <div className="flex items-center gap-1 text-xs">
          {f.rank_delta > 0
            ? <><TrendingUp className="w-3.5 h-3.5 text-emerald-500" /><span className="text-emerald-700">+{f.rank_delta} Rang verbessert</span></>
            : <><TrendingDown className="w-3.5 h-3.5 text-red-500" /><span className="text-red-600">{f.rank_delta} Rang verschlechtert</span></>
          }
        </div>
      )}

      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-gray-500">
          <span>Rang-Position</span>
          <span>#{f.rang} von {data.gesamt}</span>
        </div>
        <div className="h-2 bg-white/60 rounded-full overflow-hidden">
          <div className={`h-full ${ampelBar} rounded-full transition-all duration-500`} style={{ width: `${rangPct}%` }} />
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-gray-500">
          <span>Ziel ≥{data.ziel.toFixed(1)} T/S</span>
          <span>{f.touren_pro_schicht.toFixed(1)} / {data.ziel.toFixed(1)}</span>
        </div>
        <div className="relative h-2 bg-white/60 rounded-full overflow-hidden">
          <div className={`h-full ${ampelBar} rounded-full transition-all duration-500`} style={{ width: `${zielPct}%` }} />
          <div className="absolute right-0 top-0 h-full w-px bg-orange-400" />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>Team-Avg</span>
        <span className="font-bold text-orange-600">{data.team_avg.toFixed(1)} T/S</span>
      </div>

      {f.alert_wenig && (
        <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-800">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>Wenige Touren!</span>
        </div>
      )}

      <div className={`text-xs rounded-lg p-2.5 ${ampelBg} border border-gray-100`}>
        <span className="text-gray-700">{coaching}</span>
      </div>
    </div>
  );
}
