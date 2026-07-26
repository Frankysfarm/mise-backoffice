'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, TrendingUp, TrendingDown } from 'lucide-react';

interface MeineSchichtstundenData {
  avg_stunden: number;
  rang: number;
  gesamt: number;
  rank_delta: number;
  team_avg_stunden: number;
  ziel_stunden: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  coaching_tipp: string;
}

const MOCK: MeineSchichtstundenData = {
  avg_stunden: 5.5,
  rang: 3,
  gesamt: 4,
  rank_delta: -1,
  team_avg_stunden: 5.93,
  ziel_stunden: 6,
  ampel: 'gelb',
  coaching_tipp: 'Noch 0.5h zum Ziel! Mehr Schichten helfen dir, dein Ranking zu verbessern.',
};

function ampelClasses(ampel: MeineSchichtstundenData['ampel']) {
  if (ampel === 'gruen') return { value: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500' };
  if (ampel === 'gelb')  return { value: 'text-yellow-600',  badge: 'bg-yellow-100 text-yellow-700',  bar: 'bg-yellow-400' };
  return                        { value: 'text-red-600',     badge: 'bg-red-100 text-red-700',        bar: 'bg-red-500' };
}

export function FahrerPhase3755MeineSchichtstunden({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<MeineSchichtstundenData>(MOCK);

  const load = useCallback(async () => {
    if (!driverId || !locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-schichtstunden-ranking?location_id=${locationId}`);
      if (!res.ok) return;
      const json = await res.json();
      const me = json.fahrer?.find((f: { fahrer_id: string }) => f.fahrer_id === driverId);
      if (!me) return;
      setData({
        avg_stunden: me.avg_stunden,
        rang: me.rang,
        gesamt: json.gesamt,
        rank_delta: me.rank_delta,
        team_avg_stunden: json.team_avg_stunden,
        ziel_stunden: json.ziel_stunden ?? 6,
        ampel: me.ampel,
        coaching_tipp: me.ampel === 'rot'
          ? 'Deine Schichtstunden sind unterdurchschnittlich. Nimm mehr Schichten an, um dein Ranking zu verbessern!'
          : me.ampel === 'gelb'
          ? `Noch ${Math.max(0, json.ziel_stunden - me.avg_stunden).toFixed(1)}h zum Ziel. Mehr Einsatz zahlt sich aus!`
          : 'Klasse! Du bist einer der fleißigsten Fahrer — weiter so!',
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
  const barPct = Math.min((data.avg_stunden / Math.max(data.ziel_stunden, 0.1)) * 100, 100);
  const teamBarPct = Math.min((data.team_avg_stunden / Math.max(data.ziel_stunden, 0.1)) * 100, 100);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Clock className="w-5 h-5 text-blue-500" />
        <span className="font-semibold text-gray-900 text-sm">Meine Schichtstunden</span>
      </div>

      {/* Haupt-Wert */}
      <div className="text-center space-y-1">
        <div className={`text-5xl font-black ${c.value}`}>{data.avg_stunden}h</div>
        <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${c.badge}`}>
          Rang #{data.rang} von {data.gesamt}
          {data.rank_delta !== 0 && (
            data.rank_delta < 0
              ? <TrendingUp className="w-3 h-3" />
              : <TrendingDown className="w-3 h-3" />
          )}
        </div>
      </div>

      {/* Ziel-Balken */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[11px] text-gray-500">
          <span>Ich ({data.avg_stunden}h)</span>
          <span>Ziel ≥{data.ziel_stunden}h</span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${c.bar} rounded-full transition-all duration-700`}
            style={{ width: `${barPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-gray-400">
          <span>Team-Ø {data.team_avg_stunden}h</span>
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
