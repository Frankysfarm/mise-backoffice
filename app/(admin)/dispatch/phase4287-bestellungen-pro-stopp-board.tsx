'use client';

import { useState, useEffect, useCallback } from 'react';
import { Package, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  bestellungen_pro_stopp: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg: number;
  bester_name: string;
  letzter_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, bestellungen_pro_stopp: 1.8, rank_delta:  1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 2, bestellungen_pro_stopp: 1.5, rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 3, bestellungen_pro_stopp: 1.2, rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, bestellungen_pro_stopp: 1.0, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg: 1.375,
  bester_name: 'Julia F.',
  letzter_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

interface Props { locationId: string | null; }

export function DispatchPhase4287BestellungenProStoppBoard({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-bestellungen-pro-stopp?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 30 * 60 * 1000); return () => clearInterval(id); }, [load]);

  const maxVal = Math.max(...data.fahrer.map(f => f.bestellungen_pro_stopp), 1);
  const bester = data.fahrer[0];
  const letzter = data.fahrer[data.fahrer.length - 1];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-bold text-gray-900">Bestellungen/Stopp-Ranking</span>
        </div>
        <div className="flex items-center gap-2">
          {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          {!loading && data.alert_count > 0 && (
            <span className="flex items-center gap-1 text-xs text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded-full">
              <AlertTriangle className="w-3 h-3" /> {data.alert_count} Niedrig
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-blue-50 rounded-xl p-2">
          <div className="text-xs text-blue-600 font-semibold truncate">{bester?.fahrer_name ?? '—'}</div>
          <div className="text-lg font-extrabold text-blue-700">{bester?.bestellungen_pro_stopp.toFixed(1) ?? '—'}</div>
          <div className="text-[10px] text-blue-400">Best. / Stopp</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-2">
          <div className="text-xs text-gray-500 font-semibold">Team-Ø</div>
          <div className="text-lg font-extrabold text-gray-700">{data.team_avg.toFixed(1)}</div>
          <div className="text-[10px] text-gray-400">Bestellungen</div>
        </div>
        <div className="bg-red-50 rounded-xl p-2">
          <div className="text-xs text-red-500 font-semibold truncate">{letzter?.fahrer_name ?? '—'}</div>
          <div className="text-lg font-extrabold text-red-600">{letzter?.bestellungen_pro_stopp.toFixed(1) ?? '—'}</div>
          <div className="text-[10px] text-red-400">Best. / Stopp</div>
        </div>
      </div>

      <div className="space-y-2">
        {data.fahrer.map((f) => {
          const barPct = (f.bestellungen_pro_stopp / maxVal) * 100;
          const barColor = f.ampel === 'gruen' ? 'bg-blue-400' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
          const rankColor = f.ampel === 'gruen' ? 'text-blue-600' : f.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-600';
          // INVERTED POSITION-BASED: rank_delta > 0 = prevRang > rang = improved = TrendingUp emerald
          const Delta = f.rank_delta > 0 ? TrendingUp : f.rank_delta < 0 ? TrendingDown : Minus;
          const dColor = f.rank_delta > 0 ? 'text-emerald-500' : f.rank_delta < 0 ? 'text-red-400' : 'text-gray-400';
          return (
            <div key={f.fahrer_id} className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold w-5 ${rankColor}`}>#{f.rang}</span>
                <span className="text-xs text-gray-700 flex-1 truncate">{f.fahrer_name}</span>
                <div className="flex items-center gap-0.5">
                  <Delta className={`w-3 h-3 ${dColor}`} />
                  <span className="text-xs font-bold text-gray-900">{f.bestellungen_pro_stopp.toFixed(1)}</span>
                </div>
                {f.alert_bottom && <AlertTriangle className="w-3 h-3 text-blue-400 flex-shrink-0" />}
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${barPct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1 border-t border-gray-100">
        <span>{data.gesamt} Fahrer</span>
        <span>#1 = meiste Bestellungen pro Stopp</span>
      </div>
    </div>
  );
}
