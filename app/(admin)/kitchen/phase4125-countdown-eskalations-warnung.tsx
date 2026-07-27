'use client';

import { useState, useEffect, useCallback } from 'react';
import { Siren, Clock, ChevronRight, AlertTriangle } from 'lucide-react';

interface EskalationRow { order_id: string; order_number: string; ueberfaellig_min: number; stufe: 1 | 2 | 3; station: string; fahrer_wartet: boolean; }
interface ApiData { eskalationen: EskalationRow[]; stufe1_count: number; stufe2_count: number; stufe3_count: number; gesamt_count: number; älteste_min: number; }

const MOCK: ApiData = {
  eskalationen: [
    { order_id: 'e1', order_number: '#1047', ueberfaellig_min: 18, stufe: 3, station: 'Grill', fahrer_wartet: true },
    { order_id: 'e2', order_number: '#1051', ueberfaellig_min: 9, stufe: 2, station: 'Warm', fahrer_wartet: false },
    { order_id: 'e3', order_number: '#1054', ueberfaellig_min: 4, stufe: 1, station: 'Kalt', fahrer_wartet: false },
    { order_id: 'e4', order_number: '#1058', ueberfaellig_min: 12, stufe: 2, station: 'Pasta', fahrer_wartet: true },
  ],
  stufe1_count: 1,
  stufe2_count: 2,
  stufe3_count: 1,
  gesamt_count: 4,
  älteste_min: 18,
};

function useNow() {
  const [n, setN] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setN(Date.now()), 1000); return () => clearInterval(id); }, []);
  return n;
}

interface Props { locationId: string | null; }

export function KitchenPhase4125CountdownEskalationsWarnung({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);
  useNow();

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/kitchen-eskalationen?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 10_000); return () => clearInterval(id); }, [load]);

  const stufenConfig = {
    1: { label: 'Stufe 1', bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', dot: 'bg-yellow-400', threshold: '1–5 min' },
    2: { label: 'Stufe 2', bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-700', dot: 'bg-orange-500', threshold: '6–15 min' },
    3: { label: 'Stufe 3', bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', dot: 'bg-red-500', threshold: '>15 min' },
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Siren className="w-4 h-4 text-red-500" />
          <span className="text-xs font-bold text-gray-900">Countdown-Eskalation</span>
        </div>
        <div className="flex items-center gap-1.5">
          {loading && <span className="w-2.5 h-2.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          {data.gesamt_count > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-red-600 font-bold bg-red-50 px-1.5 py-0.5 rounded">
              <AlertTriangle className="w-3 h-3" /> {data.gesamt_count} überfällig
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {([1, 2, 3] as const).map(stufe => {
          const cfg = stufenConfig[stufe];
          const count = stufe === 1 ? data.stufe1_count : stufe === 2 ? data.stufe2_count : data.stufe3_count;
          return (
            <div key={stufe} className={`rounded-lg p-1.5 border ${cfg.bg} ${cfg.border} text-center`}>
              <div className={`text-[9px] ${cfg.text}`}>{cfg.label}</div>
              <div className={`text-sm font-bold ${cfg.text}`}>{count}</div>
              <div className="text-[8px] text-gray-400">{cfg.threshold}</div>
            </div>
          );
        })}
      </div>

      <div className="space-y-1.5">
        {data.eskalationen.map((e) => {
          const cfg = stufenConfig[e.stufe];
          return (
            <div key={e.order_id} className={`flex items-center gap-2 p-2 rounded-lg border ${cfg.bg} ${cfg.border}`}>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot} ${e.stufe === 3 ? 'animate-pulse' : ''}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-[11px] font-bold text-gray-800">{e.order_number}</span>
                  <span className="text-[9px] text-gray-400">{e.station}</span>
                  {e.fahrer_wartet && <span className="text-[8px] bg-blue-100 text-blue-600 px-1 rounded">🚴 wartet</span>}
                </div>
              </div>
              <div className={`flex items-center gap-0.5 ${cfg.text} text-xs font-bold`}>
                <Clock className="w-3 h-3" />
                +{e.ueberfaellig_min} min
              </div>
              <ChevronRight className={`w-3 h-3 ${cfg.text}`} />
            </div>
          );
        })}
      </div>

      {data.eskalationen.length === 0 && (
        <div className="text-center py-3 text-[11px] text-emerald-500 bg-emerald-50 rounded-lg">
          Keine Eskalationen — alles im Zeitplan ✓
        </div>
      )}

      <div className="text-[9px] text-gray-400 text-center border-t border-gray-100 pt-0.5">
        3-stufige Eskalation · 10-Sek-Polling · Fahrer-Sync
      </div>
    </div>
  );
}
