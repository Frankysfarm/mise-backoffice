'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  trend_pct: number;
  aktuell_pct: number;
  vorher_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_negativ: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_trend_pct: number;
  verbessert_name: string;
  verschlechtert_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max S.',   rang: 1, trend_pct: 18, aktuell_pct: 94, vorher_pct: 76, rank_delta:  2, ampel: 'gruen', alert_negativ: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, trend_pct:  7, aktuell_pct: 95, vorher_pct: 88, rank_delta: -1, ampel: 'gruen', alert_negativ: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara M.',  rang: 3, trend_pct: -3, aktuell_pct: 73, vorher_pct: 76, rank_delta:  0, ampel: 'gelb',  alert_negativ: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, trend_pct:-12, aktuell_pct: 54, vorher_pct: 66, rank_delta: -1, ampel: 'rot',   alert_negativ: true  },
  ],
  team_trend_pct: 2.5,
  verbessert_name: 'Max S.',
  verschlechtert_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function DeltaIcon({ delta }: { delta: number }) {
  if (delta > 0) return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (delta < 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-500" />;
}

function TrendLabel({ value }: { value: number }) {
  const sign = value > 0 ? '+' : '';
  const color = value > 0 ? 'text-emerald-400' : value < 0 ? 'text-red-400' : 'text-gray-500';
  return <span className={`tabular-nums font-bold text-xs ${color}`}>{sign}{value}%</span>;
}

export function DispatchPhase5306SchichtPuenktlichkeitTrendBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    if (!locationId) { setData(MOCK); return; }
    const res = await fetch(
      `/api/delivery/admin/fahrer-schicht-puenktlichkeit-trend-ranking?location_id=${locationId}`
    ).catch(() => null);
    if (res?.ok) setData(await res.json());
    else setData(MOCK);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data) return null;

  const maxAbs = Math.max(...data.fahrer.map(f => Math.abs(f.trend_pct)), 1);

  return (
    <div className="rounded-xl border border-emerald-700 bg-emerald-900/30 p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-200">Schicht-Pünktlichkeits-Trend (30d vs. Vorperiode)</span>
        {data.alert_count > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle className="w-3 h-3" />
            {data.alert_count} Negativ-Trend
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg bg-emerald-900/50 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 truncate">Größte Verbesserung</div>
          <div className="text-xs font-bold text-emerald-300 truncate">{data.verbessert_name}</div>
        </div>
        <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500">Team-Trend</div>
          <div className="text-xs font-bold">
            <TrendLabel value={data.team_trend_pct} />
          </div>
        </div>
        <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 truncate">Größte Verschlechterung</div>
          <div className="text-xs font-bold text-red-400 truncate">{data.verschlechtert_name}</div>
        </div>
      </div>

      <div className="space-y-2">
        {data.fahrer.slice(0, 6).map(f => (
          <div key={f.fahrer_id} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-4 text-right">{f.rang}</span>
            <span className="text-xs text-gray-300 w-24 truncate">{f.fahrer_name}</span>
            <div className="flex-1 relative h-2 rounded-full bg-gray-800 overflow-hidden">
              {f.trend_pct >= 0 ? (
                <div
                  className={`absolute left-0 top-0 h-full rounded-full ${
                    f.ampel === 'gruen' ? 'bg-emerald-500' :
                    f.ampel === 'gelb'  ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${(f.trend_pct / maxAbs) * 50}%`, marginLeft: '50%' }}
                />
              ) : (
                <div
                  className="absolute top-0 h-full rounded-full bg-red-500"
                  style={{
                    width: `${(Math.abs(f.trend_pct) / maxAbs) * 50}%`,
                    right: '50%',
                  }}
                />
              )}
              <div className="absolute left-1/2 top-0 h-full w-px bg-gray-600" />
            </div>
            <TrendLabel value={f.trend_pct} />
            <span className="text-[10px] text-gray-600 w-8 text-right tabular-nums">{f.aktuell_pct}%</span>
            <DeltaIcon delta={f.rank_delta} />
            {f.alert_negativ && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
          </div>
        ))}
      </div>

      <div className="mt-2 text-[9px] text-gray-600 text-right">{data.gesamt} Fahrer · 30d vs. Vorperiode · 30-Min-Polling</div>
    </div>
  );
}
