'use client';

import { useState, useEffect, useCallback } from 'react';
import { Gauge, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  auslastung_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_pct: number;
  bester_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'd1', fahrer_name: 'Max M.',   rang: 1, auslastung_pct: 72.4, rank_delta: -1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'd2', fahrer_name: 'Julia F.', rang: 2, auslastung_pct: 65.8, rank_delta:  1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'd3', fahrer_name: 'Sara K.',  rang: 3, auslastung_pct: 58.2, rank_delta:  0, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'd4', fahrer_name: 'Tim B.',   rang: 4, auslastung_pct: 41.5, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_pct: 59.5,
  bester_name: 'Max M.',
  alert_count: 1,
  gesamt: 4,
};

interface Props { locationId: string | null; }

export function KitchenPhase4265AuslastungsTicker({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-auslastungs-ranking?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 30 * 60 * 1000); return () => clearInterval(id); }, [load]);

  const bester = data.fahrer[0];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Gauge className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-xs font-bold text-emerald-600">
            Bester: {data.bester_name} — {bester?.auslastung_pct}%
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {loading && <span className="w-2.5 h-2.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          {!loading && data.alert_count > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-amber-600 font-semibold bg-amber-50 px-1.5 py-0.5 rounded-full">
              <AlertTriangle className="w-2.5 h-2.5" /> {data.alert_count}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1">
        {data.fahrer.map((f) => {
          const dotColor = f.ampel === 'gruen' ? 'bg-emerald-400' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
          return (
            <div key={f.fahrer_id} className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
              <span className="text-[11px] text-gray-500 w-4 text-right">#{f.rang}</span>
              <span className="text-[11px] text-gray-700 flex-1 truncate">{f.fahrer_name}</span>
              <span className="text-[11px] font-bold text-gray-900">{f.auslastung_pct}%</span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[10px] text-gray-400 pt-0.5 border-t border-gray-100">
        <span>Team-Ø: {data.team_avg_pct}%</span>
        <span>#1 = höchste Auslastung</span>
      </div>
    </div>
  );
}
