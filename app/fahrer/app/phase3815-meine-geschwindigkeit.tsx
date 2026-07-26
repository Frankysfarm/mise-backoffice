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
  team_avg_kmh: 22,
  ziel_kmh: 25,
  ampel: 'gelb',
  coaching_tipp: 'Noch 4 km/h unter dem Ziel. Plane deine Route effizient, um schneller zu werden!',
};

function ampelClasses(ampel: MeineGeschwindigkeitData['ampel']) {
  if (ampel === 'gruen') return { value: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800', bar: 'bg-emerald-500' };
  if (ampel === 'gelb')  return { value: 'text-yellow-600',  badge: 'bg-yellow-100 text-yellow-700',   bar: 'bg-yellow-400'  };
  return                        { value: 'text-red-500',     badge: 'bg-red-100 text-red-700',         bar: 'bg-red-400'     };
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
      const diff = Math.max(0, ziel - me.avg_kmh);
      setData({
        avg_kmh: me.avg_kmh,
        rang: me.rang,
        gesamt: json.gesamt,
        rank_delta: me.rank_delta,
        team_avg_kmh: json.team_avg_kmh,
        ziel_kmh: ziel,
        ampel: me.ampel,
        coaching_tipp: me.ampel === 'rot'
          ? 'Du bist sehr langsam unterwegs. Plane Routen ohne Umwege und fahre direkter!'
          : me.ampel === 'gelb'
          ? `Noch ${diff} km/h unter dem Ziel. Effizientere Routen helfen dir, schneller zu werden!`
          : 'Klasse Tempo! Du gehörst zu den schnellsten Fahrern — weiter so!',
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
  const maxVal = Math.max(data.avg_kmh, data.ziel_kmh, data.team_avg_kmh, 1);
  const barPct = (data.avg_kmh / maxVal) * 100;
  const zielBarPct = (data.ziel_kmh / maxVal) * 100;
  const teamBarPct = (data.team_avg_kmh / maxVal) * 100;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Gauge className="w-5 h-5 text-blue-500" />
        <span className="font-semibold text-gray-900 text-sm">Meine Geschwindigkeit</span>
      </div>

      {/* Haupt-Wert */}
      <div className="text-center space-y-1">
        <div className={`text-5xl font-black ${c.value}`}>{data.avg_kmh}</div>
        <div className="text-sm font-semibold text-gray-500">km/h</div>
        <div className="text-xs text-gray-400">Ø Geschwindigkeit (letzte 30 Tage)</div>
        <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${c.badge}`}>
          Rang #{data.rang} von {data.gesamt}
          {data.rank_delta !== 0 && (
            data.rank_delta > 0
              ? <TrendingUp className="w-3 h-3" />
              : <TrendingDown className="w-3 h-3" />
          )}
        </div>
      </div>

      {/* Ziel-Balken */}
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
