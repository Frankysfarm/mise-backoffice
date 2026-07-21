'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, Star, TrendingUp, Trophy } from 'lucide-react';

interface StopDot {
  stop_num: number;
  status: 'delivered' | 'active' | 'pending';
  delay_min: number | null;
}

interface FahrerTour {
  driver_id: string;
  driver_name: string;
  score: number;
  sub_scores: { puenktlichkeit: number; effizienz: number; kundenbewertung: number };
  stops_total: number;
  stops_done: number;
  eta_return_min: number | null;
  stop_dots: StopDot[];
  trend: 'up' | 'down' | 'stable';
  on_time_pct: number;
}

interface ApiData {
  touren: FahrerTour[];
  flotten_score: number;
  alert: boolean;
}

const MOCK: ApiData = {
  flotten_score: 74,
  alert: false,
  touren: [
    {
      driver_id: 'd1', driver_name: 'Marco R.', score: 88, sub_scores: { puenktlichkeit: 90, effizienz: 85, kundenbewertung: 89 },
      stops_total: 5, stops_done: 3, eta_return_min: 18, trend: 'up', on_time_pct: 92,
      stop_dots: [
        { stop_num: 1, status: 'delivered', delay_min: 0 },
        { stop_num: 2, status: 'delivered', delay_min: 2 },
        { stop_num: 3, status: 'active',    delay_min: null },
        { stop_num: 4, status: 'pending',   delay_min: null },
        { stop_num: 5, status: 'pending',   delay_min: null },
      ],
    },
    {
      driver_id: 'd2', driver_name: 'Sandra K.', score: 62, sub_scores: { puenktlichkeit: 55, effizienz: 70, kundenbewertung: 61 },
      stops_total: 4, stops_done: 1, eta_return_min: 35, trend: 'down', on_time_pct: 68,
      stop_dots: [
        { stop_num: 1, status: 'delivered', delay_min: 8 },
        { stop_num: 2, status: 'active',    delay_min: null },
        { stop_num: 3, status: 'pending',   delay_min: null },
        { stop_num: 4, status: 'pending',   delay_min: null },
      ],
    },
    {
      driver_id: 'd3', driver_name: 'Ali M.', score: 79, sub_scores: { puenktlichkeit: 80, effizienz: 78, kundenbewertung: 79 },
      stops_total: 3, stops_done: 2, eta_return_min: 12, trend: 'stable', on_time_pct: 80,
      stop_dots: [
        { stop_num: 1, status: 'delivered', delay_min: 1 },
        { stop_num: 2, status: 'delivered', delay_min: 0 },
        { stop_num: 3, status: 'active',    delay_min: null },
      ],
    },
  ],
};

function scoreColor(s: number): string {
  if (s >= 80) return '#22c55e';
  if (s >= 65) return '#f59e0b';
  return '#ef4444';
}

function ScoreRing({ score, size = 44 }: { score: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = scoreColor(score);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        className="text-[11px] font-bold" fill={color} style={{ fontSize: 11, fontWeight: 700 }}>
        {score}
      </text>
    </svg>
  );
}

function StopDots({ dots }: { dots: StopDot[] }) {
  return (
    <div className="flex items-center gap-1">
      {dots.map(d => {
        const cls = d.status === 'delivered' ? (d.delay_min && d.delay_min > 5 ? 'bg-amber-400' : 'bg-green-500')
          : d.status === 'active' ? 'bg-blue-500 animate-pulse'
          : 'bg-gray-200';
        return <span key={d.stop_num} className={`inline-block w-2 h-2 rounded-full ${cls}`} title={`Stop ${d.stop_num}`} />;
      })}
    </div>
  );
}

export function DispatchPhase2830TourScoreLiveVisualisierungMaster({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const load = () => {
      if (!locationId) { setData(MOCK); return; }
      fetch(`/api/delivery/admin/tour-score-live?location_id=${locationId}`)
        .then(r => r.ok ? r.json() : null)
        .then((d: ApiData | null) => setData(d ?? MOCK))
        .catch(() => setData(MOCK));
    };
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!data) return null;

  const sorted = [...data.touren].sort((a, b) => b.score - a.score);
  const fleetColor = scoreColor(data.flotten_score);

  return (
    <div className={`rounded-xl border p-3 mb-3 ${data.alert ? 'border-red-300 bg-red-50/40' : 'border-blue-200 bg-white'}`}>
      <button onClick={() => setOpen(o => !o)} className="flex items-center justify-between w-full text-left">
        <div className="flex items-center gap-2">
          <Trophy size={14} className="text-blue-600" />
          <span className="font-semibold text-xs text-gray-800">Tour-Score Live</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ color: fleetColor, background: '#f3f4f6' }}>
            Flotte Ø {data.flotten_score}
          </span>
          {data.alert && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-red-100 text-red-700">Alert &lt;65</span>
          )}
        </div>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {sorted.map((t, idx) => {
            const isExp = expanded === t.driver_id;
            const trendIcon = t.trend === 'up' ? '↑' : t.trend === 'down' ? '↓' : '→';
            const trendCls = t.trend === 'up' ? 'text-green-600' : t.trend === 'down' ? 'text-red-500' : 'text-gray-400';
            const progressPct = t.stops_total > 0 ? Math.round((t.stops_done / t.stops_total) * 100) : 0;

            return (
              <div key={t.driver_id} className="rounded-lg border border-gray-100 bg-gray-50/60 p-2.5">
                <button onClick={() => setExpanded(isExp ? null : t.driver_id)} className="w-full text-left">
                  <div className="flex items-center gap-2">
                    {/* Rang */}
                    <span className="text-[9px] font-bold text-gray-400 w-4 shrink-0">#{idx + 1}</span>
                    {/* Score-Ring */}
                    <ScoreRing score={t.score} size={40} />
                    {/* Name + Dots */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-gray-800 truncate">{t.driver_name}</span>
                        <span className={`text-[10px] font-bold ${trendCls}`}>{trendIcon}</span>
                      </div>
                      <StopDots dots={t.stop_dots} />
                    </div>
                    {/* ETA + On-Time */}
                    <div className="text-right shrink-0">
                      {t.eta_return_min !== null && (
                        <div className="flex items-center gap-1 text-[10px] text-gray-500">
                          <MapPin size={9} />
                          <span>Rückkehr ~{t.eta_return_min} Min</span>
                        </div>
                      )}
                      <div className="text-[10px] font-semibold" style={{ color: scoreColor(t.on_time_pct) }}>
                        On-Time {t.on_time_pct}%
                      </div>
                    </div>
                  </div>

                  {/* Fortschrittsbalken */}
                  <div className="mt-2 h-1 rounded-full bg-gray-200 overflow-hidden">
                    <div className="h-full rounded-full bg-blue-400 transition-all" style={{ width: `${progressPct}%` }} />
                  </div>
                  <div className="text-[9px] text-gray-400 mt-0.5">{t.stops_done}/{t.stops_total} Stopps</div>
                </button>

                {/* Aufklappbare Sub-Scores */}
                {isExp && (
                  <div className="mt-2 grid grid-cols-3 gap-1 pt-2 border-t border-gray-100">
                    {[
                      { label: 'Pünktl.', val: t.sub_scores.puenktlichkeit },
                      { label: 'Effizienz', val: t.sub_scores.effizienz },
                      { label: 'Bewertung', val: t.sub_scores.kundenbewertung },
                    ].map(s => (
                      <div key={s.label} className="text-center">
                        <div className="text-[11px] font-bold" style={{ color: scoreColor(s.val) }}>{s.val}</div>
                        <div className="text-[9px] text-gray-400">{s.label}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {sorted.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-2">Keine aktiven Touren</p>
          )}
        </div>
      )}
    </div>
  );
}
