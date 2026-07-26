'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertOctagon, TrendingUp, TrendingDown } from 'lucide-react';

interface MeineLeerfahrtenData {
  leerfahrten_quote: number;
  rang: number;
  gesamt: number;
  rank_delta: number;
  team_avg_quote: number;
  ziel_quote: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  coaching_tipp: string;
}

const MOCK: MeineLeerfahrtenData = {
  leerfahrten_quote: 9,
  rang: 3,
  gesamt: 4,
  rank_delta: -1,
  team_avg_quote: 7.75,
  ziel_quote: 5,
  ampel: 'gelb',
  coaching_tipp: 'Noch 4% zum Ziel! Bessere Routen-Planung reduziert Leerfahrten.',
};

function ampelClasses(ampel: MeineLeerfahrtenData['ampel']) {
  if (ampel === 'gruen') return { value: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500' };
  if (ampel === 'gelb')  return { value: 'text-yellow-600',  badge: 'bg-yellow-100 text-yellow-700',  bar: 'bg-yellow-400' };
  return                        { value: 'text-red-600',     badge: 'bg-red-100 text-red-700',        bar: 'bg-red-500' };
}

export function FahrerPhase3765MeineLeerfahrtenquote({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<MeineLeerfahrtenData>(MOCK);

  const load = useCallback(async () => {
    if (!driverId || !locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-leerfahrtenquote?location_id=${locationId}`);
      if (!res.ok) return;
      const json = await res.json();
      const me = json.fahrer?.find((f: { fahrer_id: string }) => f.fahrer_id === driverId);
      if (!me) return;
      const ziel = json.ziel_quote ?? 5;
      setData({
        leerfahrten_quote: me.leerfahrten_quote,
        rang: me.rang,
        gesamt: json.gesamt,
        rank_delta: me.rank_delta,
        team_avg_quote: json.team_avg_quote,
        ziel_quote: ziel,
        ampel: me.ampel,
        coaching_tipp: me.ampel === 'rot'
          ? 'Deine Leerfahrtenquote ist zu hoch. Überprüfe deine Routen und Zeiten!'
          : me.ampel === 'gelb'
          ? `Noch ${Math.max(0, me.leerfahrten_quote - ziel)}% über dem Ziel. Bessere Planung hilft!`
          : 'Super! Deine Leerfahrtenquote ist sehr gering — weiter so!',
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
  // For "lower is better", invert the bar: ziel at 100%, higher quote = fuller (worse) bar
  const barPct = Math.min((data.leerfahrten_quote / Math.max(data.ziel_quote * 3, 1)) * 100, 100);
  const teamBarPct = Math.min((data.team_avg_quote / Math.max(data.ziel_quote * 3, 1)) * 100, 100);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <AlertOctagon className="w-5 h-5 text-orange-500" />
        <span className="font-semibold text-gray-900 text-sm">Meine Leerfahrtenquote</span>
      </div>

      {/* Haupt-Wert */}
      <div className="text-center space-y-1">
        <div className={`text-5xl font-black ${c.value}`}>{data.leerfahrten_quote}%</div>
        <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${c.badge}`}>
          Rang #{data.rang} von {data.gesamt}
          {data.rank_delta !== 0 && (
            data.rank_delta > 0
              ? <TrendingDown className="w-3 h-3" />
              : <TrendingUp className="w-3 h-3" />
          )}
        </div>
      </div>

      {/* Ziel-Balken */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[11px] text-gray-500">
          <span>Ich ({data.leerfahrten_quote}%)</span>
          <span>Ziel ≤{data.ziel_quote}%</span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${c.bar} rounded-full transition-all duration-700`}
            style={{ width: `${barPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-gray-400">
          <span>Team-Ø {data.team_avg_quote}%</span>
          <div className="h-2.5 w-16 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-orange-300 rounded-full" style={{ width: `${teamBarPct}%` }} />
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
