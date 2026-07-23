'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Euro, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  rang: number;
  umsatz_pro_schicht: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiResponse {
  fahrer: FahrerEntry[];
  team_avg: number;
  gesamt: number;
}

const AMPEL_COLOR: Record<string, string> = {
  gruen: 'text-emerald-500',
  gelb: 'text-yellow-500',
  rot: 'text-red-500',
};

const AMPEL_BAR: Record<string, string> = {
  gruen: 'bg-emerald-500',
  gelb: 'bg-yellow-400',
  rot: 'bg-red-500',
};

const COACHING: Record<string, string> = {
  gruen: 'Hervorragender Umsatz! Du bist unter den Besten.',
  gelb: 'Gut — versuche mehr Bestellungen pro Schicht zu fahren.',
  rot: 'Umsatz optimieren: mehr aktive Stunden und Touren anstreben.',
};

export function FahrerPhase3388MeinUmsatzProSchicht({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiResponse | null>(null);

  const load = useCallback(async () => {
    if (!driverId || !locationId || !isOnline) return;
    try {
      const r = await fetch(
        `/api/delivery/admin/fahrer-umsatz-pro-schicht?location_id=${locationId}&driver_id=${driverId}`,
        { cache: 'no-store' }
      );
      if (r.ok) setData(await r.json());
    } catch {}
  }, [driverId, locationId, isOnline]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline || !data || data.fahrer.length === 0) return null;

  const me = data.fahrer[0];

  return (
    <div className="border rounded-lg bg-white dark:bg-gray-900 shadow-sm mb-3">
      <button
        className="w-full flex items-center justify-between p-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2 font-semibold text-sm">
          <Euro className="w-4 h-4 text-green-500" />
          Mein Umsatz/Schicht
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          <div className="flex justify-around items-center py-2">
            <div className="text-center">
              <div className={`text-5xl font-black ${AMPEL_COLOR[me.ampel]}`}>
                {me.umsatz_pro_schicht}€
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">Ø pro Schicht</div>
            </div>
            <div className="text-center">
              <div className={`text-3xl font-bold ${AMPEL_COLOR[me.ampel]}`}>
                #{me.rang}
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">von {data.gesamt}</div>
            </div>
          </div>

          <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full ${AMPEL_BAR[me.ampel]}`}
              style={{ width: `${Math.max(5, ((data.gesamt - me.rang + 1) / data.gesamt) * 100)}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 dark:bg-gray-800 rounded p-2 text-center">
              <div className="text-[10px] text-gray-500 uppercase">Rang-Δ</div>
              <div className={`text-sm font-semibold flex items-center justify-center gap-1 ${me.rank_delta > 0 ? 'text-emerald-600' : me.rank_delta < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                {me.rank_delta > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : me.rank_delta < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                {me.rank_delta > 0 ? `+${me.rank_delta}` : me.rank_delta}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded p-2 text-center">
              <div className="text-[10px] text-gray-500 uppercase">Team-Ø</div>
              <div className="text-sm font-semibold">{data.team_avg}€</div>
            </div>
          </div>

          <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded p-2">
            {COACHING[me.ampel]}
          </div>
        </div>
      )}
    </div>
  );
}
