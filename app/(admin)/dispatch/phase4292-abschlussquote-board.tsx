'use client';

import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  quote_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_pct: number;
  bester_name: string;
  letzter_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 1, quote_pct: 97, rank_delta:  2, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, quote_pct: 89, rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, quote_pct: 76, rank_delta:  1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, quote_pct: 52, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_pct: 78,
  bester_name: 'Max M.',
  letzter_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

interface Props { locationId: string | null; }

export function DispatchPhase4292AbschlussquoteBoard({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-abschlussquoten-ranking?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 30 * 60 * 1000); return () => clearInterval(id); }, [load]);

  const bester = data.fahrer[0];
  const letzter = data.fahrer[data.fahrer.length - 1];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-sm font-bold text-gray-900">Abschlussquoten-Ranking</span>
        </div>
        <div className="flex items-center gap-2">
          {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          {!loading && data.alert_count > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-700 font-semibold bg-red-50 px-2 py-0.5 rounded-full">
              <AlertTriangle className="w-3 h-3" /> {data.alert_count} Niedrig
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-green-50 rounded-xl p-2">
          <div className="text-xs text-green-600 font-semibold truncate">{bester?.fahrer_name ?? '—'}</div>
          <div className="text-lg font-extrabold text-green-700">{bester?.quote_pct ?? '—'}%</div>
          <div className="text-[10px] text-green-400">Beste Quote</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-2">
          <div className="text-xs text-gray-500 font-semibold">Team-Ø</div>
          <div className="text-lg font-extrabold text-gray-700">{data.team_avg_pct}%</div>
          <div className="text-[10px] text-gray-400">Abschluss</div>
        </div>
        <div className="bg-red-50 rounded-xl p-2">
          <div className="text-xs text-red-500 font-semibold truncate">{letzter?.fahrer_name ?? '—'}</div>
          <div className="text-lg font-extrabold text-red-600">{letzter?.quote_pct ?? '—'}%</div>
          <div className="text-[10px] text-red-400">Niedrigste</div>
        </div>
      </div>

      <div className="space-y-2">
        {data.fahrer.map((f) => {
          const barPct = f.quote_pct;
          const barColor = f.ampel === 'gruen' ? 'bg-green-400' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
          const rankColor = f.ampel === 'gruen' ? 'text-green-600' : f.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-600';
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
                  <span className="text-xs font-bold text-gray-900">{f.quote_pct}%</span>
                </div>
                {f.alert_bottom && <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />}
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
        <span>#1 = höchste Abschlussquote</span>
      </div>
    </div>
  );
}
