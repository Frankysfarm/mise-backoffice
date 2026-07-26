'use client';

import { useState, useEffect, useCallback } from 'react';
import { Star, TrendingUp, TrendingDown } from 'lucide-react';

interface MeineKundenbewertungData {
  avg_bewertung: number;
  rang: number;
  gesamt: number;
  rank_delta: number;
  team_avg_bewertung: number;
  ziel_bewertung: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  coaching_tipp: string;
}

const MOCK: MeineKundenbewertungData = {
  avg_bewertung: 4.3,
  rang: 3,
  gesamt: 4,
  rank_delta: -1,
  team_avg_bewertung: 4.43,
  ziel_bewertung: 4.5,
  ampel: 'gelb',
  coaching_tipp: 'Noch 0.2★ zum Ziel! Freundlicher Umgang und pünktliche Lieferung steigern die Bewertung.',
};

function ampelClasses(ampel: MeineKundenbewertungData['ampel']) {
  if (ampel === 'gruen') return { value: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500' };
  if (ampel === 'gelb')  return { value: 'text-yellow-600',  badge: 'bg-yellow-100 text-yellow-700',  bar: 'bg-yellow-400' };
  return                        { value: 'text-red-600',     badge: 'bg-red-100 text-red-700',        bar: 'bg-red-500' };
}

export function FahrerPhase3770MeineKundenbewertung({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<MeineKundenbewertungData>(MOCK);

  const load = useCallback(async () => {
    if (!driverId || !locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-kundenbewertung-ranking?location_id=${locationId}`);
      if (!res.ok) return;
      const json = await res.json();
      const me = json.fahrer?.find((f: { fahrer_id: string }) => f.fahrer_id === driverId);
      if (!me) return;
      const ziel = json.ziel_bewertung ?? 4.5;
      setData({
        avg_bewertung: me.avg_bewertung,
        rang: me.rang,
        gesamt: json.gesamt,
        rank_delta: me.rank_delta,
        team_avg_bewertung: json.team_avg_bewertung,
        ziel_bewertung: ziel,
        ampel: me.ampel,
        coaching_tipp: me.ampel === 'rot'
          ? 'Deine Bewertung ist zu niedrig. Lächeln, Pünktlichkeit und Sorgfalt helfen!'
          : me.ampel === 'gelb'
          ? `Noch ${Math.max(0, Math.round((ziel - me.avg_bewertung) * 10) / 10)}★ zum Ziel. Gib Gas — fast da!`
          : 'Ausgezeichnet! Deine Kundenbewertung ist top — weiter so!',
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
  const barPct = Math.min((data.avg_bewertung / 5) * 100, 100);
  const teamBarPct = Math.min((data.team_avg_bewertung / 5) * 100, 100);
  const zielBarPct = Math.min((data.ziel_bewertung / 5) * 100, 100);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Star className="w-5 h-5 text-yellow-500" />
        <span className="font-semibold text-gray-900 text-sm">Meine Kundenbewertung</span>
      </div>

      {/* Haupt-Wert */}
      <div className="text-center space-y-1">
        <div className={`text-5xl font-black ${c.value}`}>★{data.avg_bewertung.toFixed(1)}</div>
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
          <span>Ich (★{data.avg_bewertung.toFixed(1)})</span>
          <span>Ziel ≥★{data.ziel_bewertung.toFixed(1)}</span>
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
          <span>Team-Ø ★{data.team_avg_bewertung.toFixed(1)}</span>
          <div className="h-2.5 w-16 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-yellow-300 rounded-full" style={{ width: `${teamBarPct}%` }} />
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
