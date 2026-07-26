'use client';

import { useState, useEffect, useCallback } from 'react';
import { Timer, TrendingUp, TrendingDown } from 'lucide-react';

interface MeineReaktionszeitData {
  avg_reaktionszeit_sek: number;
  rang: number;
  gesamt: number;
  rank_delta: number;
  team_avg_sek: number;
  ziel_sek: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  coaching_tipp: string;
}

const MOCK: MeineReaktionszeitData = {
  avg_reaktionszeit_sek: 95,
  rang: 3,
  gesamt: 4,
  rank_delta: 1,
  team_avg_sek: 87,
  ziel_sek: 60,
  ampel: 'gelb',
  coaching_tipp: 'Noch 35s über dem Ziel. Halte das Handy griffbereit und nimm Aufträge sofort an!',
};

function ampelClasses(ampel: MeineReaktionszeitData['ampel']) {
  if (ampel === 'gruen') return { value: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800', bar: 'bg-emerald-500' };
  if (ampel === 'gelb')  return { value: 'text-yellow-600',  badge: 'bg-yellow-100 text-yellow-700',   bar: 'bg-yellow-400'  };
  return                        { value: 'text-red-500',     badge: 'bg-red-100 text-red-700',         bar: 'bg-red-400'     };
}

export function FahrerPhase3800MeineReaktionszeit({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<MeineReaktionszeitData>(MOCK);

  const load = useCallback(async () => {
    if (!driverId || !locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-reaktionszeit?location_id=${locationId}`);
      if (!res.ok) return;
      const json = await res.json();
      const me = json.fahrer?.find((f: { fahrer_id: string }) => f.fahrer_id === driverId);
      if (!me) return;
      const ziel = json.ziel_sek ?? 60;
      const diff = Math.max(0, me.avg_reaktionszeit_sek - ziel);
      setData({
        avg_reaktionszeit_sek: me.avg_reaktionszeit_sek,
        rang: me.rang,
        gesamt: json.gesamt,
        rank_delta: me.rank_delta,
        team_avg_sek: json.team_avg_sek,
        ziel_sek: ziel,
        ampel: me.ampel,
        coaching_tipp: me.ampel === 'rot'
          ? 'Deine Reaktionszeit ist sehr langsam. Benachrichtigungen einschalten und Aufträge sofort annehmen!'
          : me.ampel === 'gelb'
          ? `Noch ${diff}s über dem Ziel. Halte das Handy griffbereit!`
          : 'Klasse! Deine Reaktionszeit ist sehr gut — weiter so!',
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
  const maxVal = Math.max(data.avg_reaktionszeit_sek, data.ziel_sek, data.team_avg_sek, 1);
  const barPct = (data.avg_reaktionszeit_sek / maxVal) * 100;
  const zielBarPct = (data.ziel_sek / maxVal) * 100;
  const teamBarPct = (data.team_avg_sek / maxVal) * 100;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Timer className="w-5 h-5 text-blue-500" />
        <span className="font-semibold text-gray-900 text-sm">Meine Reaktionszeit</span>
      </div>

      {/* Haupt-Wert */}
      <div className="text-center space-y-1">
        <div className={`text-5xl font-black ${c.value}`}>{data.avg_reaktionszeit_sek}s</div>
        <div className="text-xs text-gray-400">Ø Reaktionszeit (letzte 30 Tage)</div>
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
          <span>Ich ({data.avg_reaktionszeit_sek}s)</span>
          <span>Ziel ≤{data.ziel_sek}s</span>
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
          <span>Team-Ø {data.team_avg_sek}s</span>
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
