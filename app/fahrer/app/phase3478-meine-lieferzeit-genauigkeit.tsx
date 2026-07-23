'use client';

import { useState, useEffect, useCallback } from 'react';
import { Target, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerLieferzeitGenauigkeit {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  genauigkeit_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiResponse {
  fahrer: FahrerLieferzeitGenauigkeit[];
  team_avg: number;
  gesamt: number;
}

const AMPEL_COLOR: Record<string, string> = {
  gruen: 'text-emerald-500',
  gelb: 'text-yellow-500',
  rot: 'text-red-500',
};

const COACHING_TIP: Record<string, string> = {
  gruen: 'Exzellent! Du lieferst fast immer pünktlich innerhalb der ETA — das macht Kunden glücklich.',
  gelb: 'Gut — versuche deine Route zu optimieren, um öfter innerhalb der ETA zu liefern.',
  rot: 'Bitte plane mehr Pufferzeit ein oder stimme dich mit dem Dispatch über realistische ETAs ab.',
};

export function FahrerPhase3478MeineLieferzeitGenauigkeit({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<{ ich: FahrerLieferzeitGenauigkeit; team_avg: number; gesamt: number } | null>(null);

  const load = useCallback(async () => {
    if (!locationId || !isOnline) return;
    try {
      const r = await fetch(
        `/api/delivery/admin/fahrer-lieferzeit-genauigkeit?location_id=${locationId}&driver_id=${driverId}`,
        { cache: 'no-store' }
      );
      if (!r.ok) return;
      const json: ApiResponse = await r.json();
      const ich = json.fahrer.find(f => f.fahrer_id === driverId) ?? json.fahrer[0];
      if (ich) setData({ ich, team_avg: json.team_avg, gesamt: json.gesamt });
    } catch {}
  }, [driverId, locationId, isOnline]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline || !data) return null;

  const { ich, team_avg, gesamt } = data;
  const barW = gesamt > 1 ? Math.round(((gesamt - ich.rang) / (gesamt - 1)) * 100) : 100;

  return (
    <div className="border rounded-lg bg-white dark:bg-gray-900 shadow-sm mb-3">
      <button
        className="w-full flex items-center justify-between p-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2 font-semibold text-sm">
          <Target className="w-4 h-4 text-emerald-500" />
          Meine Lieferzeit-Genauigkeit
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="text-center">
            <div className={`text-5xl font-extrabold ${AMPEL_COLOR[ich.ampel]}`}>
              {ich.genauigkeit_pct}
            </div>
            <div className="text-sm text-gray-500 mt-0.5">% ETA-Genauigkeit</div>
            <div className={`text-3xl font-bold mt-1 ${AMPEL_COLOR[ich.ampel]}`}>
              Rang {ich.rang}
            </div>
            <div className="text-xs text-gray-400">von {gesamt} Fahrern</div>
          </div>

          <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full ${ich.ampel === 'gruen' ? 'bg-emerald-500' : ich.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-500'}`}
              style={{ width: `${barW}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Team-Ø: {team_avg}%</span>
            <span className="flex items-center gap-1">
              {ich.rank_delta < 0 ? (
                <><TrendingUp className="w-3 h-3 text-emerald-500" /><span className="text-emerald-600">{Math.abs(ich.rank_delta)} besser</span></>
              ) : ich.rank_delta > 0 ? (
                <><TrendingDown className="w-3 h-3 text-red-500" /><span className="text-red-600">{ich.rank_delta} schlechter</span></>
              ) : (
                <><Minus className="w-3 h-3 text-gray-400" /><span>unverändert</span></>
              )}
            </span>
          </div>

          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
            {COACHING_TIP[ich.ampel]}
          </div>
        </div>
      )}
    </div>
  );
}
