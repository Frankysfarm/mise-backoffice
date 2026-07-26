'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, TrendingUp, TrendingDown } from 'lucide-react';

interface MeineLieferzeitData {
  genauigkeit_pct: number;
  rang: number;
  gesamt: number;
  rank_delta: number;
  team_avg_pct: number;
  ziel_pct: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  coaching_tipp: string;
}

const MOCK: MeineLieferzeitData = {
  genauigkeit_pct: 74,
  rang: 3,
  gesamt: 4,
  rank_delta: -1,
  team_avg_pct: 79,
  ziel_pct: 90,
  ampel: 'gelb',
  coaching_tipp: 'Noch 16% zum Ziel! Plane mehr Pufferzeit pro Stopp ein.',
};

function ampelClasses(ampel: MeineLieferzeitData['ampel']) {
  if (ampel === 'gruen') return { value: 'text-violet-700', badge: 'bg-violet-100 text-violet-800', bar: 'bg-violet-500' };
  if (ampel === 'gelb')  return { value: 'text-yellow-600',  badge: 'bg-yellow-100 text-yellow-700',  bar: 'bg-yellow-400' };
  return                        { value: 'text-red-600',     badge: 'bg-red-100 text-red-700',        bar: 'bg-red-500' };
}

export function FahrerPhase3780MeineLieferzeitGenauigkeit({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<MeineLieferzeitData>(MOCK);

  const load = useCallback(async () => {
    if (!driverId || !locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-lieferzeit-genauigkeit?location_id=${locationId}`);
      if (!res.ok) return;
      const json = await res.json();
      const me = json.fahrer?.find((f: { fahrer_id: string }) => f.fahrer_id === driverId);
      if (!me) return;
      const ziel = json.ziel_pct ?? 90;
      const diff = Math.max(0, ziel - me.genauigkeit_pct);
      setData({
        genauigkeit_pct: me.genauigkeit_pct,
        rang: me.rang,
        gesamt: json.gesamt,
        rank_delta: me.rank_delta,
        team_avg_pct: json.team_avg_pct,
        ziel_pct: ziel,
        ampel: me.ampel,
        coaching_tipp: me.ampel === 'rot'
          ? 'Deine Lieferzeit-Genauigkeit ist zu niedrig. Optimiere Routen und plane mehr Pufferzeit!'
          : me.ampel === 'gelb'
          ? `Noch ${diff}% zum Ziel. Achte auf die ETA-Schätzungen — du schaffst das!`
          : 'Ausgezeichnet! Du lieferst fast immer pünktlich — weiter so!',
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
  const zielBarPct = data.ziel_pct;
  const teamBarPct = data.team_avg_pct;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Clock className="w-5 h-5 text-violet-500" />
        <span className="font-semibold text-gray-900 text-sm">Meine Lieferzeit-Genauigkeit</span>
      </div>

      {/* Haupt-Wert */}
      <div className="text-center space-y-1">
        <div className={`text-5xl font-black ${c.value}`}>{data.genauigkeit_pct}%</div>
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
          <span>Ich ({data.genauigkeit_pct}%)</span>
          <span>Ziel ≥{data.ziel_pct}%</span>
        </div>
        <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${c.bar} rounded-full transition-all duration-700`}
            style={{ width: `${data.genauigkeit_pct}%` }}
          />
          {/* Ziel-Marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-gray-400"
            style={{ left: `${zielBarPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-gray-400">
          <span>Team-Ø {data.team_avg_pct}%</span>
          <div className="h-2.5 w-16 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-violet-300 rounded-full" style={{ width: `${teamBarPct}%` }} />
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
