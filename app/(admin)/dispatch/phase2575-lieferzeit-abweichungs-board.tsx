'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Timer } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  abweichung_min: number;
  abweichung_min_vw: number | null;
  lieferungen_count: number;
  trend: 'besser' | 'schlechter' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_min: number;
  team_avg_min_vw: number | null;
  alert_count: number;
}

function ampelClass(min: number) {
  if (min <= 0)  return { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-700', bar: 'bg-green-500' };
  if (min <= 10) return { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700', bar: 'bg-amber-400' };
  return { bg: 'bg-red-50 border-red-200', dot: 'bg-red-500', text: 'text-red-700', bar: 'bg-red-500' };
}

function formatMin(min: number): string {
  return `${min > 0 ? '+' : ''}${min.toFixed(1)} Min`;
}

/** Maps abweichung_min (-10…+30) to bar position 0–100% (null = 25%) */
function barWidth(min: number): number {
  const RANGE_NEG = 10;
  const RANGE_POS = 30;
  const total = RANGE_NEG + RANGE_POS;
  const clamped = Math.max(-RANGE_NEG, Math.min(RANGE_POS, min));
  return Math.round(((clamped + RANGE_NEG) / total) * 100);
}

function AbweichungsBar({ min }: { min: number }) {
  const cls = ampelClass(min);
  const w   = barWidth(min);
  const nullPos = Math.round((10 / 40) * 100); // 10/(10+30) = 25%
  return (
    <div className="relative h-1.5 rounded-full bg-gray-200 w-24">
      <div
        className={`absolute top-0 h-full rounded-full ${cls.bar}`}
        style={{ left: `${nullPos}%`, width: `${Math.abs(w - nullPos)}%`, ...(min < 0 ? { left: `${w}%` } : {}) }}
      />
      {/* Nulllinie */}
      <div className="absolute top-0 h-full border-l-2 border-gray-500" style={{ left: `${nullPos}%` }} title="Ziel ≤0 Min" />
      {/* Alert-Linie +10 Min */}
      <div className="absolute top-0 h-full border-l-2 border-dashed border-red-500" style={{ left: `${barWidth(10)}%` }} title="Alert >10 Min" />
    </div>
  );
}

function TrendIcon({ trend }: { trend: 'besser' | 'schlechter' | 'stabil' }) {
  if (trend === 'besser')      return <TrendingDown size={12} className="text-green-600" />;
  if (trend === 'schlechter')  return <TrendingUp size={12} className="text-red-500" />;
  return <Minus size={12} className="text-gray-400" />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f5', fahrer_name: 'Jana F.',   abweichung_min: 18.7, abweichung_min_vw: 14.2, lieferungen_count:  7, trend: 'schlechter', trend_delta:  4.5, ampel: 'rot',   alert: true  },
    { fahrer_id: 'f2', fahrer_name: 'Sarah K.',  abweichung_min: 14.3, abweichung_min_vw: 11.8, lieferungen_count: 12, trend: 'schlechter', trend_delta:  2.5, ampel: 'rot',   alert: true  },
    { fahrer_id: 'f4', fahrer_name: 'Tom B.',    abweichung_min:  2.4, abweichung_min_vw:  2.1, lieferungen_count: 13, trend: 'stabil',     trend_delta:  0.3, ampel: 'gelb',  alert: false },
    { fahrer_id: 'f3', fahrer_name: 'Lena S.',   abweichung_min:  6.1, abweichung_min_vw:  7.4, lieferungen_count: 11, trend: 'besser',     trend_delta: -1.3, ampel: 'gelb',  alert: false },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',    abweichung_min: -1.2, abweichung_min_vw:  0.5, lieferungen_count: 18, trend: 'besser',     trend_delta: -1.7, ampel: 'gruen', alert: false },
  ],
  team_avg_min: 8.1,
  team_avg_min_vw: 7.2,
  alert_count: 2,
};

export function DispatchPhase2575LieferzeitAbweichungsBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-lieferzeit-abweichung?location_id=${locationId}`)
        .then(r => r.json()).then(setData).catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const sorted = [...data.fahrer].sort((a, b) => b.abweichung_min - a.abweichung_min);
  const hasAlert    = data.alert_count > 0;
  const teamCls     = ampelClass(data.team_avg_min);
  const alertFahrer = data.fahrer.filter(f => f.alert).map(f => f.fahrer_name);

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Timer size={16} className={hasAlert ? 'text-red-500' : 'text-green-600'} />
          <span className="font-semibold text-sm text-gray-800">Lieferzeit-Abweichungs-Board</span>
          {hasAlert && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
              {data.alert_count} Alert{data.alert_count > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-bold ${teamCls.text}`}>
            Ø {formatMin(data.team_avg_min)}
          </span>
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className={`text-lg font-bold ${teamCls.text}`}>{formatMin(data.team_avg_min)}</div>
              <div className="text-xs text-gray-500">Team Ø heute</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-lg font-bold text-gray-700">
                {data.team_avg_min_vw !== null ? formatMin(data.team_avg_min_vw) : '—'}
              </div>
              <div className="text-xs text-gray-500">Vorwoche</div>
            </div>
            <div className="bg-white rounded-lg border border-gray-100 p-2 text-center">
              <div className="text-lg font-bold text-green-600">≤0 Min</div>
              <div className="text-xs text-gray-500">Ziel</div>
            </div>
          </div>

          {/* Alert-Banner */}
          {hasAlert && (
            <div className="flex items-center gap-2 bg-red-100 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle size={14} className="text-red-600 flex-shrink-0" />
              <p className="text-xs text-red-700 font-medium">
                Lieferzeit überschritten (&gt;10 Min): {alertFahrer.join(', ')}
              </p>
            </div>
          )}

          {/* Fahrerliste */}
          <div className="space-y-1.5">
            {sorted.map(f => {
              const cls = ampelClass(f.abweichung_min);
              return (
                <div key={f.fahrer_id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${cls.bg}`}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cls.dot}`} />
                  <span className="text-xs font-medium text-gray-700 w-20 truncate">{f.fahrer_name}</span>
                  <AbweichungsBar min={f.abweichung_min} />
                  <span className={`text-xs font-bold w-14 text-right ${cls.text}`}>{formatMin(f.abweichung_min)}</span>
                  <TrendIcon trend={f.trend} />
                  <span className="text-xs text-gray-400 w-8 text-right">{f.lieferungen_count}×</span>
                </div>
              );
            })}
          </div>

          {/* Legende */}
          <div className="flex gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />≤0 Min</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />1–10 Min</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />&gt;10 Min</span>
          </div>
        </div>
      )}
    </div>
  );
}
