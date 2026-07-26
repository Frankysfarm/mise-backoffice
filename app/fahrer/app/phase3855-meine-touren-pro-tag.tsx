'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, TrendingUp, TrendingDown, Minus, Wifi } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  touren_pro_tag: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_touren: number;
  alert_count: number;
}

const MOCK_FAHRER: FahrerRow = {
  fahrer_id: 'demo',
  fahrer_name: 'Julia F.',
  rang: 1,
  touren_pro_tag: 8.2,
  rank_delta: 1,
  ampel: 'gruen',
};

export function FahrerPhase3855MeineTourenProTag({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [fahrer, setFahrer] = useState<FahrerRow>(MOCK_FAHRER);
  const [teamAvg, setTeamAvg] = useState(6.65);
  const [gesamt, setGesamt] = useState(4);
  const [loading, setLoading] = useState(false);

  const ziel = 7;

  const load = useCallback(async () => {
    if (!locationId || !driverId || !isOnline) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-touren-pro-tag?location_id=${locationId}`);
      if (res.ok) {
        const d: ApiData = await res.json();
        const me = d.fahrer.find(f => f.fahrer_id === driverId);
        if (me) {
          setFahrer(me);
          setTeamAvg(d.team_avg_touren);
          setGesamt(d.fahrer.length);
        }
      }
    } catch {
      // Mock-Fallback
    } finally {
      setLoading(false);
    }
  }, [driverId, locationId, isOnline]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-2 text-sm text-gray-400">
        <Wifi className="w-4 h-4" />
        <span>Offline — Touren-Statistik nicht verfügbar</span>
      </div>
    );
  }

  const valColor = fahrer.ampel === 'gruen' ? 'text-emerald-600' : fahrer.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-500';
  const rangColor = fahrer.rang === 1 ? 'text-yellow-500' : fahrer.rang <= Math.ceil(gesamt / 4) ? 'text-emerald-600' : fahrer.rang > Math.floor(gesamt * 0.75) ? 'text-red-500' : 'text-gray-700';
  const istGut = fahrer.touren_pro_tag >= ziel;

  const coaching = fahrer.touren_pro_tag < 5
    ? 'Du fährst wenige Touren. Optimiere deine Routenplanung und reduziere Pausen zwischen den Touren.'
    : fahrer.touren_pro_tag < ziel
      ? 'Gutes Tempo! Mit etwas mehr Effizienz beim Beladen erreichst du das Tagesziel.'
      : 'Exzellente Leistung! Du bist ein Top-Fahrer im Team.';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-green-500" />
          <span className="text-sm font-semibold text-gray-900">Meine Touren/Tag</span>
          {loading && <span className="w-2.5 h-2.5 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />}
        </div>
        <span className="text-xs text-gray-400">Ziel ≥{ziel}/Tag</span>
      </div>

      {/* Wert + Rang */}
      <div className="flex items-end justify-between">
        <div>
          <div className={`text-5xl font-black leading-none ${valColor}`}>{fahrer.touren_pro_tag}</div>
          <div className="flex items-center gap-1 mt-1">
            {fahrer.rank_delta > 0
              ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              : fahrer.rank_delta < 0
                ? <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                : <Minus className="w-3.5 h-3.5 text-gray-400" />
            }
            <span className="text-xs text-gray-500">
              {fahrer.rank_delta > 0 ? '+' : ''}{fahrer.rank_delta} Rang
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-3xl font-black ${rangColor}`}>#{fahrer.rang}</div>
          <div className="text-[10px] text-gray-400">von {gesamt}</div>
        </div>
      </div>

      {/* Fortschrittsbalken */}
      <div>
        <div className="flex justify-between text-[10px] text-gray-400 mb-1">
          <span>Touren/Tag</span>
          <span>{istGut ? '✓ Ziel erreicht' : `${(ziel - fahrer.touren_pro_tag).toFixed(1)} fehlen`}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${fahrer.ampel === 'gruen' ? 'bg-emerald-500' : fahrer.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400'}`}
            style={{ width: `${Math.min(100, (fahrer.touren_pro_tag / Math.max(fahrer.touren_pro_tag, ziel)) * 100)}%` }}
          />
        </div>
      </div>

      {/* Team-Avg */}
      <div className="text-[11px] text-gray-500 text-center">
        Team-Ø: <span className="font-semibold text-gray-700">{teamAvg} Touren/Tag</span>
      </div>

      {/* Coaching-Tipp */}
      <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-[11px] text-green-800">
        {coaching}
      </div>
    </div>
  );
}
