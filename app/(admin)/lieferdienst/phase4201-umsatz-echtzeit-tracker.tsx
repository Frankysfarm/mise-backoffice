'use client';

import { useState, useEffect, useCallback } from 'react';
import { Euro, TrendingUp, TrendingDown, Clock, AlertTriangle } from 'lucide-react';

interface StundeRow { stunde: string; umsatz_eur: number; }

interface ApiData {
  umsatz_heute_eur: number;
  umsatz_gestern_eur: number;
  delta_pct: number;
  eur_pro_stunde_aktuell: number;
  eur_pro_stunde_ziel: number;
  verlauf: StundeRow[];
  top_zone: string;
  alert_count: number;
}

const MOCK: ApiData = {
  umsatz_heute_eur: 1842.50,
  umsatz_gestern_eur: 1620.00,
  delta_pct: 13.7,
  eur_pro_stunde_aktuell: 245.80,
  eur_pro_stunde_ziel: 280.00,
  verlauf: [
    { stunde: '11:00', umsatz_eur: 182 },
    { stunde: '12:00', umsatz_eur: 320 },
    { stunde: '13:00', umsatz_eur: 415 },
    { stunde: '14:00', umsatz_eur: 280 },
    { stunde: '15:00', umsatz_eur: 248 },
    { stunde: '16:00', umsatz_eur: 398 },
  ],
  top_zone: 'Innenstadt',
  alert_count: 0,
};

const fmt = (n: number) => n.toFixed(2).replace('.', ',') + ' €';
const barMax = (rows: StundeRow[]) => Math.max(...rows.map((r) => r.umsatz_eur), 1);

interface Props { locationId: string | null; }

export function LieferdienstPhase4201UmsatzEchtzeitTracker({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/umsatz-echtzeit?location_id=${locationId}`);
      if (res.ok) { const j = await res.json(); if (!j.error) setData(j); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 60_000); return () => clearInterval(id); }, [load]);

  const pos = data.delta_pct >= 0;
  const maxBar = barMax(data.verlauf);
  const targetPct = Math.min((data.eur_pro_stunde_aktuell / data.eur_pro_stunde_ziel) * 100, 100);
  const barFill = targetPct >= 90 ? 'bg-green-500' : targetPct >= 70 ? 'bg-yellow-400' : 'bg-red-400';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Euro className="w-3.5 h-3.5 text-green-500" />
          <span className="text-xs font-semibold text-gray-900">Umsatz Echtzeit</span>
        </div>
        <div className="flex items-center gap-1.5">
          {loading && <span className="w-2 h-2 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          {data.alert_count > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-red-600 font-semibold">
              <AlertTriangle className="w-3 h-3" /> {data.alert_count}
            </span>
          )}
          <span className={`flex items-center gap-0.5 text-[10px] font-semibold ${pos ? 'text-green-600' : 'text-red-500'}`}>
            {pos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {pos ? '+' : ''}{data.delta_pct.toFixed(1)}%
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div className="bg-green-50 rounded-lg p-2">
          <div className="text-[10px] text-green-600 mb-0.5">Heute gesamt</div>
          <div className="text-sm font-bold text-green-700">{fmt(data.umsatz_heute_eur)}</div>
          <div className="text-[10px] text-gray-400">vs. {fmt(data.umsatz_gestern_eur)} gestern</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-2">
          <div className="flex items-center gap-1 mb-0.5">
            <Clock className="w-2.5 h-2.5 text-blue-500" />
            <span className="text-[10px] text-blue-600">Aktuell/h</span>
          </div>
          <div className="text-sm font-bold text-blue-700">{fmt(data.eur_pro_stunde_aktuell)}</div>
          <div className="h-1 bg-gray-200 rounded-full mt-1 overflow-hidden">
            <div className={`h-full rounded-full ${barFill}`} style={{ width: `${targetPct}%` }} />
          </div>
        </div>
      </div>
      <div>
        <div className="text-[10px] text-gray-500 mb-1.5">Stundenverlauf heute</div>
        <div className="flex items-end gap-1 h-12">
          {data.verlauf.map((s) => {
            const h = Math.max(Math.round((s.umsatz_eur / maxBar) * 100), 8);
            const c = s.umsatz_eur >= data.eur_pro_stunde_ziel ? 'bg-green-400' : 'bg-blue-300';
            return (
              <div key={s.stunde} className="flex-1 flex flex-col items-center gap-0.5">
                <div className={`w-full rounded-t ${c}`} style={{ height: `${h}%` }} />
                <span className="text-[8px] text-gray-400">{s.stunde.slice(0, 2)}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 px-0.5 pt-0.5 border-t border-gray-100">
        <span>Top Zone: {data.top_zone}</span>
        <span>Ziel: {fmt(data.eur_pro_stunde_ziel)}/h</span>
      </div>
    </div>
  );
}
