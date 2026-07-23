'use client';

import { useState, useEffect, useCallback } from 'react';
import { Zap, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerData {
  rang: number;
  lieferungen_pro_km: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
  gesamt: number;
  team_avg: number;
}

interface ApiResponse {
  fahrer: Array<{
    fahrer_id: string;
    fahrer_name: string;
    rang: number;
    lieferungen_pro_km: number;
    rank_delta: number;
    ampel: 'gruen' | 'gelb' | 'rot';
    alert_bottom: boolean;
  }>;
  team_avg: number;
  gesamt: number;
}

const AMPEL_TEXT: Record<string, string> = {
  gruen: 'text-emerald-600 dark:text-emerald-400',
  gelb: 'text-yellow-600 dark:text-yellow-400',
  rot: 'text-red-600 dark:text-red-400',
};

const AMPEL_BG: Record<string, string> = {
  gruen: 'bg-emerald-50 dark:bg-emerald-900/20',
  gelb: 'bg-yellow-50 dark:bg-yellow-900/20',
  rot: 'bg-red-50 dark:bg-red-900/20',
};

const COACHING_TIP: Record<string, string> = {
  gruen: 'Top! Du nutzt kurze Wege optimal für mehr Lieferungen.',
  gelb: 'Gut — optimiere deine Routenplanung für mehr Stopps je km.',
  rot: 'Tipp: Kürzere Routen mit mehr Stopps steigern deine Dichte.',
};

const RANK_BADGE: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function FahrerPhase3528MeineLieferungenProKm({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<FahrerData | null>(null);

  const load = useCallback(async () => {
    if (!locationId || !driverId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-lieferungen-pro-km?location_id=${locationId}`, { cache: 'no-store' });
      if (!r.ok) return;
      const json: ApiResponse = await r.json();
      const me = json.fahrer.find(f => f.fahrer_id === driverId);
      if (!me) return;
      setData({
        rang: me.rang,
        lieferungen_pro_km: me.lieferungen_pro_km,
        rank_delta: me.rank_delta,
        ampel: me.ampel,
        alert_bottom: me.alert_bottom,
        gesamt: json.gesamt,
        team_avg: json.team_avg,
      });
    } catch {}
  }, [driverId, locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline || !data) return null;

  const barWidth = data.gesamt > 1 ? ((data.rang - 1) / (data.gesamt - 1)) * 100 : 0;
  // Descending: rang=1 is best → bar full; rang=gesamt is worst → bar empty
  const barFill = data.gesamt > 1 ? 100 - barWidth : 100;

  return (
    <div className={`rounded-xl p-4 mb-3 ${AMPEL_BG[data.ampel]}`}>
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-4 h-4 text-emerald-500" />
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Lieferungen/km</span>
        {data.alert_bottom && (
          <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
            Niedrig ⚠
          </span>
        )}
      </div>

      <div className="flex items-end gap-4 mb-3">
        <div>
          <span className={`text-5xl font-black ${AMPEL_TEXT[data.ampel]}`}>
            {data.lieferungen_pro_km.toFixed(2)}
          </span>
          <span className="text-base text-gray-500 ml-1">/km</span>
        </div>
        <div className="flex flex-col items-center mb-1">
          <span className={`text-3xl font-bold ${AMPEL_TEXT[data.ampel]}`}>
            {RANK_BADGE[data.rang] ?? `#${data.rang}`}
          </span>
          <span className="text-[10px] text-gray-400">von {data.gesamt}</span>
        </div>
        <div className="ml-auto flex flex-col items-center">
          {data.rank_delta > 0 ? (
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          ) : data.rank_delta < 0 ? (
            <TrendingDown className="w-5 h-5 text-red-500" />
          ) : (
            <Minus className="w-5 h-5 text-gray-400" />
          )}
          <span className="text-[10px] text-gray-400">
            {data.rank_delta > 0 ? `+${data.rank_delta}` : data.rank_delta < 0 ? `${data.rank_delta}` : '='}
          </span>
        </div>
      </div>

      {/* Rang-Balken */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] text-gray-400 mb-1">
          <span>Niedrig</span>
          <span>Hoch</span>
        </div>
        <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              data.ampel === 'gruen' ? 'bg-emerald-500' :
              data.ampel === 'gelb' ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${barFill}%` }}
          />
        </div>
      </div>

      <div className="flex items-start gap-2 p-2 rounded-lg bg-white/60 dark:bg-gray-800/40">
        <Zap className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-gray-600 dark:text-gray-400">{COACHING_TIP[data.ampel]}</p>
      </div>

      <div className="mt-2 text-[10px] text-gray-400 text-right">
        Team-Ø: {data.team_avg.toFixed(2)}/km · Ziel: ≥0.8/km
      </div>
    </div>
  );
}
