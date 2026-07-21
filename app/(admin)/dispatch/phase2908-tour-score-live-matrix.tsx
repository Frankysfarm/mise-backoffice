'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Target, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface DriverScore {
  driver_id: string;
  driver_name: string;
  score: number;
  stops_done: number;
  stops_total: number;
  eta_min: number | null;
  on_time_pct: number;
  trend: 'up' | 'down' | 'stable';
}

interface ApiData {
  drivers: DriverScore[];
  fleet_avg: number;
  alert_count: number;
}

const MOCK: ApiData = {
  fleet_avg: 74,
  alert_count: 1,
  drivers: [
    { driver_id: 'd1', driver_name: 'Max M.',   score: 91, stops_done: 5, stops_total: 7, eta_min: 12, on_time_pct: 95, trend: 'up'     },
    { driver_id: 'd4', driver_name: 'Julia F.', score: 83, stops_done: 3, stops_total: 5, eta_min: 18, on_time_pct: 88, trend: 'stable' },
    { driver_id: 'd2', driver_name: 'Sara K.',  score: 67, stops_done: 2, stops_total: 4, eta_min: 22, on_time_pct: 75, trend: 'down'   },
    { driver_id: 'd3', driver_name: 'Tim B.',   score: 54, stops_done: 1, stops_total: 3, eta_min: 35, on_time_pct: 60, trend: 'down'   },
  ],
};

const ZIEL = 75;
const WARN = 60;

function scoreCls(s: number) {
  if (s >= ZIEL) return { text: 'text-green-700', bar: 'bg-green-500', bg: 'bg-green-50 border-green-200',   ring: '#22c55e' };
  if (s >= WARN) return { text: 'text-amber-700', bar: 'bg-amber-400', bg: 'bg-amber-50 border-amber-200',   ring: '#f59e0b' };
  return               { text: 'text-red-700',   bar: 'bg-red-500',   bg: 'bg-red-50 border-red-200',       ring: '#ef4444' };
}

function ScoreRing({ score }: { score: number }) {
  const size = 44;
  const r = 17;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(score / 100, 1);
  const cls = scoreCls(score);
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute top-0 left-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={4} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={cls.ring} strokeWidth={4}
          strokeDasharray={`${pct * circ} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <span className={`text-[11px] font-black z-10 ${cls.text}`}>{score}</span>
    </div>
  );
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'up')   return <TrendingUp   size={11} className="text-green-600" />;
  if (trend === 'down') return <TrendingDown size={11} className="text-red-500"   />;
  return                       <Minus        size={11} className="text-gray-400"  />;
}

export function DispatchPhase2908TourScoreLiveMatrix({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData>(MOCK);

  useEffect(() => {
    if (!locationId) return;
    const load = () =>
      fetch(`/api/delivery/admin/driver-score?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => {});
    load();
    const t = setInterval(load, 25 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  const sorted   = [...data.drivers].sort((a, b) => b.score - a.score);
  const alerts   = sorted.filter(d => d.score < WARN);
  const hasAlert = alerts.length > 0;
  const fleetCls = scoreCls(data.fleet_avg);

  return (
    <div className={`rounded-xl border p-4 mb-4 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Target size={16} className="text-indigo-500" />
          <span className="font-semibold text-sm text-gray-800">Tour-Score Live-Matrix</span>
          {hasAlert && <AlertTriangle size={14} className="text-red-500" />}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 ${fleetCls.text}`}>
            Flotte Ø {data.fleet_avg}
          </span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {hasAlert && (
            <div className="bg-red-100 border border-red-300 rounded-lg p-2 space-y-1">
              {alerts.map(d => (
                <div key={d.driver_id} className="flex items-center gap-2 text-xs text-red-700">
                  <AlertTriangle size={11} />
                  <span className="font-medium">{d.driver_name}</span>
                  <span>— Score {d.score} / Ziel ≥{ZIEL}</span>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-2">
            {sorted.map(d => {
              const cls      = scoreCls(d.score);
              const stopsPct = d.stops_total > 0 ? (d.stops_done / d.stops_total) * 100 : 0;
              return (
                <div key={d.driver_id} className={`rounded-lg border p-2 flex items-center gap-3 ${cls.bg}`}>
                  <ScoreRing score={d.score} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-semibold text-gray-800 truncate">{d.driver_name}</span>
                        <TrendIcon trend={d.trend} />
                      </div>
                      <span className="text-[10px] text-gray-500">
                        {d.eta_min != null ? `ETA ${d.eta_min} Min` : '–'}
                      </span>
                    </div>
                    <div className="relative h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
                      <div className={`h-full rounded-full ${cls.bar}`} style={{ width: `${stopsPct}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
                      <span>{d.stops_done}/{d.stops_total} Stopps</span>
                      <span>⏱ {d.on_time_pct}% pünktlich</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> ≥{ZIEL}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> {WARN}–{ZIEL - 1}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"   /> &lt;{WARN}</span>
          </div>
        </div>
      )}
    </div>
  );
}
