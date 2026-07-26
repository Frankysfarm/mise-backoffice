'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, TrendingUp, TrendingDown, Minus, Wifi } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  stopps_pro_tour: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_stopps: number;
  alert_count: number;
}

const MOCK_FAHRER: FahrerRow = {
  fahrer_id: 'demo',
  fahrer_name: 'Julia F.',
  rang: 1,
  stopps_pro_tour: 12.5,
  rank_delta: 1,
  ampel: 'gruen',
};

export function FahrerPhase3860MeineStoppsProTour({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [fahrer, setFahrer] = useState<FahrerRow>(MOCK_FAHRER);
  const [teamAvg, setTeamAvg] = useState(9.75);
  const [gesamt, setGesamt] = useState(4);
  const [loading, setLoading] = useState(false);

  const ziel = 10;

  const load = useCallback(async () => {
    if (!locationId || !driverId || !isOnline) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-stopps-pro-tour?location_id=${locationId}`);
      if (res.ok) {
        const d: ApiData = await res.json();
        const me = d.fahrer.find(f => f.fahrer_id === driverId);
        if (me) {
          setFahrer(me);
          setTeamAvg(d.team_avg_stopps);
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
        <span>Offline — Stopp-Statistik nicht verfügbar</span>
      </div>
    );
  }

  const valColor = fahrer.ampel === 'gruen' ? 'text-emerald-600' : fahrer.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-500';
  const rangColor = fahrer.rang === 1 ? 'text-yellow-500' : fahrer.rang <= Math.ceil(gesamt / 4) ? 'text-emerald-600' : fahrer.rang > Math.floor(gesamt * 0.75) ? 'text-red-500' : 'text-gray-700';
  const istGut = fahrer.stopps_pro_tour >= ziel;

  const coaching = fahrer.stopps_pro_tour < 7
    ? 'Du hast wenige Stopps pro Tour. Frage deinen Dispatcher nach dichteren Routenplänen.'
    : fahrer.stopps_pro_tour < ziel
      ? 'Gutes Tempo! Dichtere Routenplanung könnte dir weitere Stopps pro Tour bringen.'
      : 'Sehr effiziente Routenauslastung! Du bist ein Vorbild für das Team.';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-semibold text-gray-900">Meine Stopps/Tour</span>
          {loading && <span className="w-2.5 h-2.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />}
        </div>
        <span className="text-xs text-gray-400">Ziel ≥{ziel}/Tour</span>
      </div>

      {/* Wert + Rang */}
      <div className="flex items-end justify-between">
        <div>
          <div className={`text-5xl font-black leading-none ${valColor}`}>{fahrer.stopps_pro_tour}</div>
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
          <span>Stopps/Tour</span>
          <span>{istGut ? '✓ Ziel erreicht' : `${(ziel - fahrer.stopps_pro_tour).toFixed(1)} fehlen`}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${fahrer.ampel === 'gruen' ? 'bg-emerald-500' : fahrer.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400'}`}
            style={{ width: `${Math.min(100, (fahrer.stopps_pro_tour / Math.max(fahrer.stopps_pro_tour, ziel)) * 100)}%` }}
          />
        </div>
      </div>

      {/* Team-Avg */}
      <div className="text-[11px] text-gray-500 text-center">
        Team-Ø: <span className="font-semibold text-gray-700">{teamAvg} Stopps/Tour</span>
      </div>

      {/* Coaching-Tipp */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 text-[11px] text-indigo-800">
        {coaching}
      </div>
    </div>
  );
}
