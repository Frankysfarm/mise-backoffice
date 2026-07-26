'use client';

import { useState, useEffect, useCallback } from 'react';
import { XCircle, TrendingUp, TrendingDown } from 'lucide-react';

interface MeineStornoquoteData {
  stornoquote_pct: number;
  rang: number;
  gesamt: number;
  rank_delta: number;
  team_avg_pct: number;
  ziel_pct: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  coaching_tipp: string;
}

const MOCK: MeineStornoquoteData = {
  stornoquote_pct: 4.5,
  rang: 3,
  gesamt: 4,
  rank_delta: -1,
  team_avg_pct: 3.95,
  ziel_pct: 3,
  ampel: 'gelb',
  coaching_tipp: 'Noch 1.5% über dem Ziel! Kläre Stornogründe mit Kunden frühzeitig.',
};

function ampelClasses(ampel: MeineStornoquoteData['ampel']) {
  if (ampel === 'gruen') return { value: 'text-red-700', badge: 'bg-red-100 text-red-800', bar: 'bg-red-500' };
  if (ampel === 'gelb')  return { value: 'text-yellow-600', badge: 'bg-yellow-100 text-yellow-700', bar: 'bg-yellow-400' };
  return                        { value: 'text-gray-500',  badge: 'bg-gray-100 text-gray-700',    bar: 'bg-gray-400' };
}

export function FahrerPhase3790MeineStornoquote({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<MeineStornoquoteData>(MOCK);

  const load = useCallback(async () => {
    if (!driverId || !locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-stornoquote-ranking?location_id=${locationId}`);
      if (!res.ok) return;
      const json = await res.json();
      const me = json.fahrer?.find((f: { fahrer_id: string }) => f.fahrer_id === driverId);
      if (!me) return;
      const ziel = json.ziel_pct ?? 3;
      const diff = Math.max(0, Math.round((me.stornoquote_pct - ziel) * 10) / 10);
      setData({
        stornoquote_pct: me.stornoquote_pct,
        rang: me.rang,
        gesamt: json.gesamt,
        rank_delta: me.rank_delta,
        team_avg_pct: json.team_avg_pct,
        ziel_pct: ziel,
        ampel: me.ampel,
        coaching_tipp: me.ampel === 'rot'
          ? 'Deine Stornoquote ist zu hoch. Kläre Probleme mit Kunden frühzeitig und optimiere deine Routen!'
          : me.ampel === 'gelb'
          ? `Noch ${diff}% über dem Ziel. Bleib dran — du schaffst das!`
          : 'Ausgezeichnet! Deine Stornoquote ist sehr niedrig — weiter so!',
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
  const barPct = Math.min(data.stornoquote_pct * 5, 100);
  const zielBarPct = Math.min(data.ziel_pct * 5, 100);
  const teamBarPct = Math.min(data.team_avg_pct * 5, 100);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <XCircle className="w-5 h-5 text-red-500" />
        <span className="font-semibold text-gray-900 text-sm">Meine Stornoquote</span>
      </div>

      {/* Haupt-Wert */}
      <div className="text-center space-y-1">
        <div className={`text-5xl font-black ${c.value}`}>{data.stornoquote_pct}%</div>
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
          <span>Ich ({data.stornoquote_pct}%)</span>
          <span>Ziel ≤{data.ziel_pct}%</span>
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
          <span>Team-Ø {data.team_avg_pct}%</span>
          <div className="h-2.5 w-16 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-red-300 rounded-full" style={{ width: `${teamBarPct}%` }} />
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
