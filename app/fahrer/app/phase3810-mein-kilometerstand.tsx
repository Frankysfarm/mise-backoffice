'use client';

import { useState, useEffect, useCallback } from 'react';
import { Route, TrendingUp, TrendingDown } from 'lucide-react';

interface MeinKilometerstandData {
  gesamt_km: number;
  rang: number;
  gesamt: number;
  rank_delta: number;
  team_avg_km: number;
  ziel_km: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  coaching_tipp: string;
}

const MOCK: MeinKilometerstandData = {
  gesamt_km: 890,
  rang: 3,
  gesamt: 4,
  rank_delta: -1,
  team_avg_km: 957,
  ziel_km: 800,
  ampel: 'gelb',
  coaching_tipp: 'Du liegst über dem Ziel — nimm mehr Touren an, um deinen Rang zu verbessern!',
};

function ampelClasses(ampel: MeinKilometerstandData['ampel']) {
  if (ampel === 'gruen') return { value: 'text-green-700', badge: 'bg-green-100 text-green-800', bar: 'bg-green-500' };
  if (ampel === 'gelb')  return { value: 'text-yellow-600', badge: 'bg-yellow-100 text-yellow-700', bar: 'bg-yellow-400' };
  return                        { value: 'text-gray-500',  badge: 'bg-gray-100 text-gray-700',    bar: 'bg-gray-400' };
}

export function FahrerPhase3810MeinKilometerstand({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<MeinKilometerstandData>(MOCK);

  const load = useCallback(async () => {
    if (!driverId || !locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-kilometerstand-ranking?location_id=${locationId}`);
      if (!res.ok) return;
      const json = await res.json();
      const me = json.fahrer?.find((f: { fahrer_id: string }) => f.fahrer_id === driverId);
      if (!me) return;
      const ziel = json.ziel_km ?? 800;
      setData({
        gesamt_km: me.gesamt_km,
        rang: me.rang,
        gesamt: json.gesamt,
        rank_delta: me.rank_delta,
        team_avg_km: json.team_avg_km,
        ziel_km: ziel,
        ampel: me.ampel,
        coaching_tipp: me.ampel === 'rot'
          ? 'Dein Kilometerstand ist sehr niedrig. Nimm mehr Touren an und erhöhe deine Schichten!'
          : me.ampel === 'gelb'
          ? `Noch ${Math.max(0, ziel - me.gesamt_km)} km bis zum Ziel — du schaffst das!`
          : 'Ausgezeichnet! Du bist einer der fleißigsten Fahrer — weiter so!',
      });
    } catch {
      // Mock-Fallback
    }
  }, [driverId, locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline) return null;

  const c = ampelClasses(data.ampel);
  const maxKm = Math.max(data.gesamt_km, data.team_avg_km, data.ziel_km);
  const barPct = Math.round((data.gesamt_km / maxKm) * 100);
  const zielBarPct = Math.round((data.ziel_km / maxKm) * 100);
  const teamBarPct = Math.round((data.team_avg_km / maxKm) * 100);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Route className="w-5 h-5 text-green-600" />
        <span className="font-semibold text-gray-900 text-sm">Mein Kilometerstand</span>
      </div>

      {/* Haupt-Wert */}
      <div className="text-center space-y-1">
        <div className={`text-5xl font-black ${c.value}`}>{data.gesamt_km}</div>
        <div className="text-sm text-gray-500 font-medium">km (letzte 30 Tage)</div>
        <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${c.badge}`}>
          Rang #{data.rang} von {data.gesamt}
          {data.rank_delta !== 0 && (
            data.rank_delta > 0
              ? <TrendingUp className="w-3 h-3" />
              : <TrendingDown className="w-3 h-3" />
          )}
        </div>
      </div>

      {/* Balken-Chart */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[11px] text-gray-500">
          <span>Ich ({data.gesamt_km} km)</span>
          <span>Ziel ≥{data.ziel_km} km</span>
        </div>
        <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${c.bar} rounded-full transition-all duration-700`}
            style={{ width: `${barPct}%` }}
          />
          {/* Ziel-Marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-gray-400"
            style={{ left: `${zielBarPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-gray-400">
          <span>Team-Ø {data.team_avg_km} km</span>
          <div className="h-2.5 w-16 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-300 rounded-full" style={{ width: `${teamBarPct}%` }} />
          </div>
        </div>
      </div>

      {/* Coaching-Tipp */}
      <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 leading-relaxed">
        💡 {data.coaching_tipp}
      </div>
    </div>
  );
}
