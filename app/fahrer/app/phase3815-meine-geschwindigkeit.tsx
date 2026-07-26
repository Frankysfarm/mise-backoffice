'use client';

import { useState, useEffect, useCallback } from 'react';
import { Gauge, TrendingUp, TrendingDown } from 'lucide-react';

interface MeineGeschwindigkeitData {
  avg_kmh: number;
  rang: number;
  gesamt: number;
  rank_delta: number;
  team_avg_kmh: number;
  ziel_kmh: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  coaching_tipp: string;
}

const MOCK: MeineGeschwindigkeitData = {
  avg_kmh: 21,
  rang: 3,
  gesamt: 4,
  rank_delta: -1,
  team_avg_kmh: 22.5,
  ziel_kmh: 25,
  ampel: 'gelb',
  coaching_tipp: 'Deine Geschwindigkeit liegt unter dem Ziel — optimiere deine Routen!',
};

function ampelClasses(ampel: MeineGeschwindigkeitData['ampel']) {
  if (ampel === 'gruen') return { value: 'text-blue-700', badge: 'bg-blue-100 text-blue-800', bar: 'bg-blue-500' };
  if (ampel === 'gelb')  return { value: 'text-yellow-600', badge: 'bg-yellow-100 text-yellow-700', bar: 'bg-yellow-400' };
  return                        { value: 'text-gray-500',  badge: 'bg-gray-100 text-gray-700',    bar: 'bg-gray-400' };
}

export function FahrerPhase3815MeineGeschwindigkeit({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<MeineGeschwindigkeitData>(MOCK);

  const load = useCallback(async () => {
    if (!driverId || !locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-geschwindigkeit-ranking?location_id=${locationId}`);
      if (!res.ok) return;
      const json = await res.json();
      const me = json.fahrer?.find((f: { fahrer_id: string }) => f.fahrer_id === driverId);
      if (!me) return;
      const ziel = json.ziel_kmh ?? 25;
      setData({
        avg_kmh: me.avg_kmh,
        rang: me.rang,
        gesamt: json.gesamt,
        rank_delta: me.rank_delta,
        team_avg_kmh: json.team_avg_kmh,
        ziel_kmh: ziel,
        ampel: me.ampel,
        coaching_tipp: me.ampel === 'rot'
          ? 'Deine Durchschnittsgeschwindigkeit ist sehr niedrig. Wähle kürzere Routen und optimiere deine Fahrtzeiten!'
          : me.ampel === 'gelb'
          ? `Noch ${Math.max(0, ziel - me.avg_kmh).toFixed(1)} km/h bis zum Ziel — optimiere deine Routen!`
          : 'Ausgezeichnet! Du gehörst zu den schnellsten Fahrern — weiter so!',
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
  const maxKmh = Math.max(data.avg_kmh, data.team_avg_kmh, data.ziel_kmh);
  const barPct = Math.round((data.avg_kmh / maxKmh) * 100);
  const zielBarPct = Math.round((data.ziel_kmh / maxKmh) * 100);
  const teamBarPct = Math.round((data.team_avg_kmh / maxKmh) * 100);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Gauge className="w-5 h-5 text-blue-600" />
        <span className="font-semibold text-gray-900 text-sm">Meine Geschwindigkeit</span>
      </div>

      {/* Haupt-Wert */}
      <div className="text-center space-y-1">
        <div className={`text-5xl font-black ${c.value}`}>{data.avg_kmh}</div>
        <div className="text-sm text-gray-500 font-medium">km/h Ø (letzte 30 Tage)</div>
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
          <span>Ich ({data.avg_kmh} km/h)</span>
          <span>Ziel ≥{data.ziel_kmh} km/h</span>
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
          <span>Team-Ø {data.team_avg_kmh} km/h</span>
          <div className="h-2.5 w-16 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-300 rounded-full" style={{ width: `${teamBarPct}%` }} />
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
