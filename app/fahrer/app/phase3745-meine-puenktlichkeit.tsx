'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, TrendingUp, TrendingDown } from 'lucide-react';

interface MeinePuenktlichkeitData {
  puenktlichkeit_rate: number;
  rang: number;
  gesamt: number;
  rank_delta: number;
  team_avg_rate: number;
  ziel_rate: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  coaching_tipp: string;
}

const MOCK: MeinePuenktlichkeitData = {
  puenktlichkeit_rate: 76,
  rang: 3,
  gesamt: 4,
  rank_delta: -1,
  team_avg_rate: 80,
  ziel_rate: 90,
  ampel: 'gelb',
  coaching_tipp: 'Plane deine Routen realistischer — vermeide zu enge Zeitfenster bei mehreren Stopps.',
};

function ampelClasses(ampel: MeinePuenktlichkeitData['ampel']) {
  if (ampel === 'gruen') return { value: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500' };
  if (ampel === 'gelb')  return { value: 'text-yellow-600',  badge: 'bg-yellow-100 text-yellow-700',  bar: 'bg-yellow-400' };
  return                        { value: 'text-red-600',     badge: 'bg-red-100 text-red-700',        bar: 'bg-red-500' };
}

export function FahrerPhase3745MeinePuenktlichkeit({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<MeinePuenktlichkeitData>(MOCK);

  const load = useCallback(async () => {
    if (!driverId || !locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-puenktlichkeit-ranking-v2?location_id=${locationId}`);
      if (!res.ok) return;
      const json = await res.json();
      const me = json.fahrer?.find((f: { fahrer_id: string }) => f.fahrer_id === driverId);
      if (!me) return;
      setData({
        puenktlichkeit_rate: me.puenktlichkeit_rate,
        rang: me.rang,
        gesamt: json.gesamt,
        rank_delta: me.rank_delta,
        team_avg_rate: json.team_avg_rate,
        ziel_rate: json.ziel_rate ?? 90,
        ampel: me.ampel,
        coaching_tipp: me.ampel === 'rot'
          ? 'Deine Pünktlichkeit liegt unter dem Ziel. Plane mehr Puffer ein und informiere Kunden bei Verzögerungen.'
          : me.ampel === 'gelb'
          ? 'Gute Leistung! Etwas mehr Zeitpuffer pro Stopp bringt dich ins grüne Segment.'
          : 'Top-Pünktlichkeit! Du lieferst zuverlässig und machst Kunden glücklich. Weiter so!',
      });
    } catch {
      // Mock-Fallback
    }
  }, [driverId, locationId]);

  useEffect(() => {
    if (!isOnline) return;
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load, isOnline]);

  if (!isOnline) return null;

  const c = ampelClasses(data.ampel);
  const zielPct = Math.min((data.puenktlichkeit_rate / data.ziel_rate) * 100, 100);
  const rangPct = data.gesamt > 1 ? ((data.gesamt - data.rang) / (data.gesamt - 1)) * 100 : 100;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Clock className={`w-5 h-5 ${c.value}`} />
        <span className="font-bold text-gray-900 text-sm">Meine Pünktlichkeit</span>
      </div>

      {/* Haupt-Wert */}
      <div className="flex items-end justify-between">
        <div>
          <div className={`text-5xl font-black leading-none ${c.value}`}>
            {data.puenktlichkeit_rate}
            <span className="text-2xl font-bold ml-1">%</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">Pünktliche Lieferungen</div>
        </div>
        <div className="text-right space-y-1">
          <div className={`text-3xl font-black ${c.value}`}>#{data.rang}</div>
          <div className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${c.badge}`}>
            von {data.gesamt} Fahrern
          </div>
          {data.rank_delta !== 0 && (
            <div className={`flex items-center justify-end gap-1 text-xs font-medium ${data.rank_delta > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {data.rank_delta > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {Math.abs(data.rank_delta)} Plätze
            </div>
          )}
        </div>
      </div>

      {/* Rang-Balken */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-gray-500">
          <span>Rang im Team</span>
          <span>#{data.rang} / {data.gesamt}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full ${c.bar} rounded-full transition-all duration-700`} style={{ width: `${rangPct}%` }} />
        </div>
      </div>

      {/* Ziel-Balken */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-gray-500">
          <span>Ziel ≥{data.ziel_rate}% Pünktlichkeit</span>
          <span>{zielPct.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full ${c.bar} rounded-full transition-all duration-700`} style={{ width: `${zielPct}%` }} />
        </div>
      </div>

      {/* Team-Ø */}
      <div className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2 text-xs">
        <span className="text-gray-500">Team-Ø</span>
        <span className="font-bold text-gray-800">{data.team_avg_rate}%</span>
        <span className={`font-bold ${data.puenktlichkeit_rate >= data.team_avg_rate ? 'text-emerald-600' : 'text-red-500'}`}>
          {data.puenktlichkeit_rate >= data.team_avg_rate ? '+' : ''}
          {data.puenktlichkeit_rate - data.team_avg_rate}%
        </span>
      </div>

      {/* Coaching-Tipp */}
      <div className={`rounded-xl px-3 py-2.5 text-xs ${c.badge}`}>
        💡 {data.coaching_tipp}
      </div>
    </div>
  );
}
