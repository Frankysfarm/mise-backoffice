'use client';

import { useState, useEffect, useCallback } from 'react';
import { Timer, Flame, TrendingUp, AlertTriangle, ChefHat } from 'lucide-react';

interface OrderCountdown {
  order_id: string;
  bestellnummer: string;
  elapsed_sec: number;
  target_prep_sec: number;
  remaining_sec: number;
  ampel: 'gruen' | 'gelb' | 'orange' | 'rot';
  kochstart_empfehlung: boolean;
}

interface ForecastWave {
  slot_label: string;
  expected_orders: number;
  ampel: 'niedrig' | 'mittel' | 'hoch' | 'kritisch';
}

interface ApiData {
  orders: OrderCountdown[];
  kochstart_score_pct: number;
  avg_prep_min: number;
  overdue_count: number;
  forecast_waves: ForecastWave[];
  bester_kochstart: string | null;
}

const MOCK: ApiData = {
  orders: [
    { order_id: 'o1', bestellnummer: '#1042', elapsed_sec: 420, target_prep_sec: 900, remaining_sec: 480, ampel: 'gruen', kochstart_empfehlung: false },
    { order_id: 'o2', bestellnummer: '#1043', elapsed_sec: 650, target_prep_sec: 900, remaining_sec: 250, ampel: 'gelb',  kochstart_empfehlung: false },
    { order_id: 'o3', bestellnummer: '#1044', elapsed_sec: 780, target_prep_sec: 900, remaining_sec: 120, ampel: 'orange', kochstart_empfehlung: true },
    { order_id: 'o4', bestellnummer: '#1045', elapsed_sec: 950, target_prep_sec: 900, remaining_sec: -50, ampel: 'rot',   kochstart_empfehlung: true },
  ],
  kochstart_score_pct: 76,
  avg_prep_min: 14.2,
  overdue_count: 1,
  forecast_waves: [
    { slot_label: '+30min', expected_orders: 4, ampel: 'niedrig' },
    { slot_label: '+60min', expected_orders: 9, ampel: 'hoch' },
    { slot_label: '+90min', expected_orders: 6, ampel: 'mittel' },
  ],
  bester_kochstart: 'Max M.',
};

const AMPEL_BG: Record<string, string> = {
  gruen:  'bg-emerald-50 border-emerald-200',
  gelb:   'bg-yellow-50 border-yellow-200',
  orange: 'bg-orange-50 border-orange-200',
  rot:    'bg-red-50 border-red-200',
};
const AMPEL_TEXT: Record<string, string> = {
  gruen:  'text-emerald-700',
  gelb:   'text-yellow-700',
  orange: 'text-orange-700',
  rot:    'text-red-700',
};
const WAVE_DOT: Record<string, string> = {
  niedrig:  'bg-emerald-400',
  mittel:   'bg-yellow-400',
  hoch:     'bg-orange-400',
  kritisch: 'bg-red-400',
};

function fmtSec(s: number): string {
  const abs = Math.abs(s);
  const mm = Math.floor(abs / 60).toString().padStart(2, '0');
  const ss = (abs % 60).toString().padStart(2, '0');
  return (s < 0 ? '-' : '') + `${mm}:${ss}`;
}

interface Props {
  locationId: string | null;
}

export function KitchenPhase4041SmartTimingKochstartForecast({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(false);

  // 1-sec countdown tick
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/kitchen/smart-timing-forecast?location_id=${locationId}`);
      if (res.ok) {
        const json = await res.json();
        if (!json.error) setData(json);
      }
    } catch {
      // Mock-Fallback
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  const scoreColor =
    data.kochstart_score_pct >= 80 ? 'text-emerald-600' :
    data.kochstart_score_pct >= 60 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Timer className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-xs font-semibold text-gray-900">Smart-Timing Kochstart</span>
        </div>
        <div className="flex items-center gap-2">
          {loading && <span className="w-2.5 h-2.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          {data.overdue_count > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-red-600 font-bold">
              <AlertTriangle className="w-3 h-3" /> {data.overdue_count} überfällig
            </span>
          )}
          <span className={`text-[10px] font-bold ${scoreColor}`}>{data.kochstart_score_pct}% on-time</span>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className="bg-gray-50 rounded-lg p-1.5">
          <p className={`text-sm font-bold ${scoreColor}`}>{data.kochstart_score_pct}%</p>
          <p className="text-[9px] text-gray-400">Score</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-1.5">
          <p className="text-sm font-bold text-gray-700">{data.avg_prep_min.toFixed(1)}min</p>
          <p className="text-[9px] text-gray-400">Ø Prep</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-1.5">
          <p className={`text-sm font-bold ${data.overdue_count > 0 ? 'text-red-600' : 'text-gray-700'}`}>{data.overdue_count}</p>
          <p className="text-[9px] text-gray-400">Überfällig</p>
        </div>
      </div>

      {/* Score-Balken */}
      <div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${data.kochstart_score_pct >= 80 ? 'bg-emerald-400' : data.kochstart_score_pct >= 60 ? 'bg-yellow-400' : 'bg-red-400'}`}
            style={{ width: `${data.kochstart_score_pct}%` }}
          />
        </div>
      </div>

      {/* Active Order Countdown Tiles */}
      {data.orders.length > 0 && (
        <div className="space-y-1">
          {data.orders.map((o) => {
            // Simulate live countdown
            const liveRemaining = o.remaining_sec - tick;
            return (
              <div
                key={o.order_id}
                className={`flex items-center gap-2 rounded-lg border px-2 py-1 ${AMPEL_BG[o.ampel]}`}
              >
                {o.kochstart_empfehlung && (
                  <Flame className="w-3 h-3 text-orange-500 flex-shrink-0" />
                )}
                {!o.kochstart_empfehlung && (
                  <ChefHat className="w-3 h-3 text-gray-400 flex-shrink-0" />
                )}
                <span className="text-[10px] font-semibold text-gray-700 flex-1">{o.bestellnummer}</span>
                <span className={`text-[11px] font-bold font-mono ${AMPEL_TEXT[o.ampel]}`}>
                  {fmtSec(liveRemaining)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Prognose-Wellen */}
      <div>
        <p className="text-[9px] text-gray-400 font-medium mb-1 flex items-center gap-1">
          <TrendingUp className="w-3 h-3" /> Prognose nächste Wellen
        </p>
        <div className="flex gap-2">
          {data.forecast_waves.map((w) => (
            <div key={w.slot_label} className="flex-1 text-center">
              <div className={`w-2 h-2 rounded-full mx-auto mb-0.5 ${WAVE_DOT[w.ampel]}`} />
              <p className="text-[9px] font-bold text-gray-700">{w.expected_orders}</p>
              <p className="text-[8px] text-gray-400">{w.slot_label}</p>
            </div>
          ))}
        </div>
      </div>

      {data.bester_kochstart && (
        <p className="text-[9px] text-gray-400 border-t border-gray-100 pt-1">
          Bester Kochstart heute: <span className="text-emerald-600 font-semibold">{data.bester_kochstart}</span>
          {/* API: /api/delivery/kitchen/smart-timing-forecast */}
        </p>
      )}
    </div>
  );
}
