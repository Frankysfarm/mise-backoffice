'use client';

import { useState, useEffect, useCallback } from 'react';
import { Star, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerBewertungRow {
  fahrer_id: string;
  fahrer_name: string;
  avg_bewertung: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  rang: number;
}

interface ApiResponse {
  fahrer: FahrerBewertungRow[];
  team_avg_bewertung: number;
}

const COACHING: Record<string, string> = {
  gruen: 'Hervorragende Kundenbewertungen! Du bist der Favorit unserer Kunden — weiter so!',
  gelb: 'Solide Bewertung. Pünktlichkeit, Freundlichkeit und saubere Übergabe bringen dich nach vorne.',
  rot: 'Niedrige Bewertung! Fokussiere auf Freundlichkeit bei der Übergabe und Pünktlichkeit.',
};

export function FahrerPhase3645MeineKundenbewertung({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<ApiResponse | null>(null);

  const load = useCallback(async () => {
    if (!isOnline || !locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-kundenbewertung-avg?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch {}
  }, [locationId, isOnline]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline || !data) return null;

  const sorted = [...data.fahrer].sort((a, b) => b.avg_bewertung - a.avg_bewertung);
  const me = sorted.find(f => f.fahrer_id === driverId) ?? sorted[0];
  if (!me) return null;

  const myRang = sorted.findIndex(f => f.fahrer_id === me.fahrer_id) + 1;
  const total = sorted.length;
  const pct = total > 0 ? ((total - myRang + 1) / total) * 100 : 50;

  const starColor = me.ampel === 'gruen' ? 'text-yellow-500' : me.ampel === 'gelb' ? 'text-orange-500' : 'text-red-500';
  const barColor = me.ampel === 'gruen' ? 'bg-yellow-400' : me.ampel === 'gelb' ? 'bg-orange-400' : 'bg-red-500';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Star className="w-5 h-5 text-yellow-500" />
        <h3 className="font-semibold text-gray-900">Meine Kundenbewertung</h3>
      </div>

      <div className="text-center space-y-1">
        <div className={`text-5xl font-black ${starColor}`}>
          ★ {me.avg_bewertung.toFixed(1)}
        </div>
        <div className="text-sm text-gray-500">Ø Kundenbewertung</div>
        <div className={`text-3xl font-bold ${starColor}`}>
          Rang #{myRang}
        </div>
        <div className="flex items-center justify-center gap-1 text-sm text-gray-500">
          {me.rank_delta > 0 ? (
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          ) : me.rank_delta < 0 ? (
            <TrendingDown className="w-4 h-4 text-red-500" />
          ) : (
            <Minus className="w-4 h-4 text-gray-400" />
          )}
          <span>Team-Ø: ★ {data.team_avg_bewertung.toFixed(1)}</span>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Rang-Position</span>
          <span>#{myRang} von {total}</span>
        </div>
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-3 rounded-full ${barColor}`}
            style={{ width: `${Math.max(pct, 5)}%` }}
          />
        </div>
      </div>

      <div className="text-xs text-gray-400 text-center">Ziel ≥4.5 ★ · Letzte 30 Tage</div>

      <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{COACHING[me.ampel]}</p>
    </div>
  );
}
