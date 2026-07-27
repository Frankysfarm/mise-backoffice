'use client';

import { useState, useEffect, useCallback } from 'react';
import { Euro, TrendingUp, TrendingDown, Minus, WifiOff } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  umsatz_pro_schicht: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg: number;
  gesamt: number;
}

const MOCK_ME: FahrerRow = {
  fahrer_id: 'me',
  fahrer_name: 'Sara K.',
  rang: 2,
  umsatz_pro_schicht: 241,
  rank_delta: 0,
  ampel: 'gruen',
  alert_bottom: false,
};

interface Props {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase4043MeinUmsatzProSchicht({ driverId, locationId, isOnline }: Props) {
  const [me, setMe] = useState<FahrerRow>(MOCK_ME);
  const [teamAvg, setTeamAvg] = useState(217);
  const [gesamt, setGesamt] = useState(4);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!driverId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ driver_id: driverId });
      if (locationId) params.set('location_id', locationId);
      const res = await fetch(`/api/delivery/admin/fahrer-umsatz-pro-schicht?${params}`);
      if (res.ok) {
        const json: ApiData = await res.json();
        if (json.fahrer && json.fahrer.length > 0) {
          setMe(json.fahrer[0]);
          setTeamAvg(json.team_avg);
          setGesamt(json.gesamt);
        }
      }
    } catch {
      // Mock-Fallback
    } finally {
      setLoading(false);
    }
  }, [driverId, locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-2 text-gray-400">
        <WifiOff className="w-4 h-4" />
        <span className="text-xs">Umsatz nicht verfügbar (offline)</span>
      </div>
    );
  }

  const valueColor =
    me.ampel === 'gruen' ? 'text-emerald-600' :
    me.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500';

  const coaching =
    me.ampel === 'gruen'
      ? 'Top – dein Umsatz pro Schicht liegt über dem Teamdurchschnitt!'
      : me.ampel === 'gelb'
      ? 'Tipp: Höhere Bestellwerte oder mehr Touren steigern deinen Umsatz.'
      : 'Achtung: Dein Umsatz ist deutlich unter dem Teamdurchschnitt.';

  const DeltaIcon =
    me.rank_delta > 0
      ? <TrendingUp className="w-4 h-4 text-emerald-500" />
      : me.rank_delta < 0
      ? <TrendingDown className="w-4 h-4 text-red-400" />
      : <Minus className="w-4 h-4 text-gray-300" />;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Euro className="w-4 h-4 text-emerald-500" />
          <span className="text-sm font-semibold text-gray-900">Mein Umsatz/Schicht</span>
        </div>
        {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
      </div>

      <div className="flex items-end gap-3">
        <span className={`text-5xl font-bold tabular-nums ${valueColor}`}>
          {me.umsatz_pro_schicht}
        </span>
        <div className="flex flex-col items-start pb-1">
          <span className="text-base text-gray-500">€/Schicht</span>
          <div className="flex items-center gap-1">
            {DeltaIcon}
            <span className={`text-2xl font-semibold ${valueColor}`}>#{me.rang}</span>
          </div>
          <span className="text-[10px] text-gray-400">von {gesamt} Fahrern</span>
        </div>
      </div>

      <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">{coaching}</div>

      <div className="flex justify-between text-[11px] text-gray-400 px-1">
        <span>Team-Ø {teamAvg} €/Schicht</span>
        <span>Ziel ≥200 €/Schicht</span>
      </div>
    </div>
  );
}
