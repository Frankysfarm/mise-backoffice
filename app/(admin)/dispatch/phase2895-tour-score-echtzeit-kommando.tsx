'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, MapPin, Target, TrendingUp, Trophy } from 'lucide-react';

interface StopDot {
  done: boolean;
  overdue: boolean;
}

interface DriverTour {
  driver_id: string;
  name: string;
  score: number;
  stops_total: number;
  stops_done: number;
  eta_min: number | null;
  on_time_rate: number;
  dots: StopDot[];
  trend: 'up' | 'stable' | 'down';
  alert: boolean;
}

interface ApiData {
  drivers: DriverTour[];
  fleet_score: number;
  alert_count: number;
}

const SCORE_WARN = 70;
const SCORE_CRIT = 50;

function scoreColor(s: number): string {
  if (s >= SCORE_WARN) return 'text-green-600';
  if (s >= SCORE_CRIT) return 'text-amber-600';
  return 'text-red-600';
}

function scoreBg(s: number): string {
  if (s >= SCORE_WARN) return 'bg-green-50 border-green-200';
  if (s >= SCORE_CRIT) return 'bg-amber-50 border-amber-200';
  return 'bg-red-50 border-red-200';
}

function ScoreRing({ score, size = 52 }: { score: number; size?: number }) {
  const r = size / 2 - 5;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const offset = circ * (1 - pct);
  const color = score >= SCORE_WARN ? '#22c55e' : score >= SCORE_CRIT ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={5} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={5}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
    </svg>
  );
}

const MOCK: ApiData = {
  fleet_score: 74,
  alert_count: 1,
  drivers: [
    {
      driver_id: 'd1', name: 'Max M.', score: 88, stops_total: 5, stops_done: 3,
      eta_min: 12, on_time_rate: 92, trend: 'up', alert: false,
      dots: [
        { done: true, overdue: false }, { done: true, overdue: false }, { done: true, overdue: false },
        { done: false, overdue: false }, { done: false, overdue: false },
      ],
    },
    {
      driver_id: 'd2', name: 'Sarah K.', score: 65, stops_total: 4, stops_done: 2,
      eta_min: 8, on_time_rate: 75, trend: 'stable', alert: false,
      dots: [
        { done: true, overdue: false }, { done: true, overdue: true },
        { done: false, overdue: false }, { done: false, overdue: false },
      ],
    },
    {
      driver_id: 'd3', name: 'Tom B.', score: 44, stops_total: 6, stops_done: 1,
      eta_min: 24, on_time_rate: 50, trend: 'down', alert: true,
      dots: [
        { done: true, overdue: true }, { done: false, overdue: true },
        { done: false, overdue: false }, { done: false, overdue: false },
        { done: false, overdue: false }, { done: false, overdue: false },
      ],
    },
  ],
};

export function DispatchPhase2895TourScoreEchtzeitKommando({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/tour-score-live?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 25_000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const sorted = [...data.drivers].sort((a, b) => b.score - a.score);
  const hasAlert = data.alert_count > 0;

  return (
    <div className={`rounded-xl border p-4 mb-4 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Target size={16} className="text-indigo-500" />
          <span className="font-semibold text-sm text-gray-800">Tour-Score Echtzeit-Kommando</span>
          {hasAlert && <AlertTriangle size={14} className="text-red-500" />}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${data.fleet_score >= SCORE_WARN ? 'bg-green-100 text-green-700' : data.fleet_score >= SCORE_CRIT ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
            Flotte Ø {data.fleet_score}
          </span>
        </div>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {hasAlert && (
            <div className="bg-red-100 border border-red-300 rounded-lg p-2 text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle size={12} />
              {data.alert_count} Fahrer mit Score &lt;{SCORE_CRIT} — sofort handeln!
            </div>
          )}

          {/* Fleet KPI */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Flotte-Ø', val: data.fleet_score, icon: <Trophy size={10} /> },
              { label: 'Fahrer', val: data.drivers.length, icon: <MapPin size={10} /> },
              { label: 'Alerts', val: data.alert_count, icon: <AlertTriangle size={10} /> },
            ].map(k => (
              <div key={k.label} className="bg-gray-50 rounded-lg p-2 text-center">
                <div className="flex items-center justify-center gap-0.5 text-gray-400 mb-0.5">{k.icon}<span className="text-[9px]">{k.label}</span></div>
                <div className="text-sm font-black text-gray-800">{k.val}</div>
              </div>
            ))}
          </div>

          {/* Driver Cards */}
          <div className="space-y-2">
            {sorted.map((d, idx) => (
              <div key={d.driver_id} className={`rounded-xl border p-3 ${scoreBg(d.score)}`}>
                <div className="flex items-start gap-3">
                  {/* Score Ring */}
                  <div className="relative shrink-0">
                    <ScoreRing score={d.score} size={52} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={`text-xs font-black ${scoreColor(d.score)}`}>{d.score}</span>
                      <span className="text-[8px] text-gray-400">#{idx + 1}</span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-gray-800">{d.name}</span>
                      <div className="flex items-center gap-1">
                        {d.trend === 'up' && <TrendingUp size={12} className="text-green-600" />}
                        {d.trend === 'down' && <TrendingUp size={12} className="text-red-500 rotate-180" />}
                        {d.alert && <AlertTriangle size={12} className="text-red-500" />}
                      </div>
                    </div>

                    {/* Stop Dots */}
                    <div className="flex items-center gap-1 mb-1.5">
                      {d.dots.map((dot, i) => (
                        <div
                          key={i}
                          className={`w-3 h-3 rounded-full border ${
                            dot.done
                              ? dot.overdue ? 'bg-red-400 border-red-500' : 'bg-green-500 border-green-600'
                              : dot.overdue ? 'bg-amber-300 border-amber-400' : 'bg-gray-200 border-gray-300'
                          }`}
                        />
                      ))}
                      <span className="text-[10px] text-gray-500 ml-1">{d.stops_done}/{d.stops_total}</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mb-1">
                      <div
                        className={`h-full rounded-full ${d.score >= SCORE_WARN ? 'bg-green-500' : d.score >= SCORE_CRIT ? 'bg-amber-400' : 'bg-red-500'}`}
                        style={{ width: `${(d.stops_done / Math.max(d.stops_total, 1)) * 100}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-[10px] text-gray-500">
                      <span>On-Time: {d.on_time_rate}%</span>
                      {d.eta_min !== null && <span>ETA: {d.eta_min} Min</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex gap-3 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Erledigt pünktlich</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> Erledigt verspätet</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-200" /> Ausstehend</span>
          </div>
        </div>
      )}
    </div>
  );
}
