'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, MapPin, Route as RouteIcon, Trophy } from 'lucide-react';

interface StopDot {
  stop_id: string;
  sequence: number;
  done: boolean;
  lat?: number;
  lng?: number;
}

interface TourRow {
  batch_id: string;
  fahrer_name: string;
  score: number;
  sub_puenktlichkeit: number;
  sub_effizienz: number;
  sub_bewertung: number;
  stops_total: number;
  stops_done: number;
  eta_min: number | null;
  stop_dots: StopDot[];
  trend: 'steigend' | 'fallend' | 'gleich';
  alert: boolean;
}

interface ApiData {
  touren: TourRow[];
  flotte_durchschnitt: number;
}

const MOCK: ApiData = {
  flotte_durchschnitt: 74,
  touren: [
    {
      batch_id: 'b1', fahrer_name: 'Max M.', score: 88, sub_puenktlichkeit: 90, sub_effizienz: 85, sub_bewertung: 92,
      stops_total: 4, stops_done: 2, eta_min: 8, trend: 'steigend', alert: false,
      stop_dots: [
        { stop_id: 's1', sequence: 1, done: true  },
        { stop_id: 's2', sequence: 2, done: true  },
        { stop_id: 's3', sequence: 3, done: false },
        { stop_id: 's4', sequence: 4, done: false },
      ],
    },
    {
      batch_id: 'b2', fahrer_name: 'Anna B.', score: 62, sub_puenktlichkeit: 55, sub_effizienz: 68, sub_bewertung: 70,
      stops_total: 3, stops_done: 1, eta_min: 22, trend: 'fallend', alert: true,
      stop_dots: [
        { stop_id: 's5', sequence: 1, done: true  },
        { stop_id: 's6', sequence: 2, done: false },
        { stop_id: 's7', sequence: 3, done: false },
      ],
    },
    {
      batch_id: 'b3', fahrer_name: 'Tim W.', score: 79, sub_puenktlichkeit: 82, sub_effizienz: 75, sub_bewertung: 81,
      stops_total: 5, stops_done: 4, eta_min: 3, trend: 'gleich', alert: false,
      stop_dots: [
        { stop_id: 's8',  sequence: 1, done: true  },
        { stop_id: 's9',  sequence: 2, done: true  },
        { stop_id: 's10', sequence: 3, done: true  },
        { stop_id: 's11', sequence: 4, done: true  },
        { stop_id: 's12', sequence: 5, done: false },
      ],
    },
  ],
};

function scoreColor(score: number) {
  if (score >= 80) return { ring: '#16a34a', text: 'text-green-700', bg: 'bg-green-50 border-green-200' };
  if (score >= 60) return { ring: '#d97706', text: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' };
  return               { ring: '#dc2626', text: 'text-red-700',   bg: 'bg-red-50 border-red-200'   };
}

function ScoreRing({ score }: { score: number }) {
  const { ring } = scoreColor(score);
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width={44} height={44} viewBox="0 0 44 44" className="shrink-0">
      <circle cx={22} cy={22} r={r} fill="none" stroke="#e5e7eb" strokeWidth={4} />
      <circle
        cx={22} cy={22} r={r} fill="none"
        stroke={ring} strokeWidth={4}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform="rotate(-90 22 22)"
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={700} fill={ring}>
        {score}
      </text>
    </svg>
  );
}

export function DispatchPhase2887TourScoreVisualisierungLiveKommando({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const load = () => {
      if (!locationId) { setData(MOCK); return; }
      fetch(`/api/delivery/dispatch/tour-score-live?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    };
    load();
    const t = setInterval(load, 20 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const alerts  = data.touren.filter(t => t.alert);
  const hasAlert = alerts.length > 0;
  const sorted  = [...data.touren].sort((a, b) => b.score - a.score);

  return (
    <div className={`rounded-xl border p-3 mb-3 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <button onClick={() => setOpen(o => !o)} className="flex w-full items-center justify-between text-left">
        <div className="flex items-center gap-2">
          <RouteIcon size={14} className="text-blue-600" />
          <span className="text-xs font-bold text-gray-800">Tour-Score · Live-Visualisierung</span>
          {hasAlert && <AlertTriangle size={12} className="text-red-500" />}
          <span className="text-[10px] text-gray-500">Flotte Ø {data.flotte_durchschnitt}</span>
        </div>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {hasAlert && (
            <div className="rounded-lg border border-red-300 bg-red-100 px-2 py-1">
              {alerts.map(t => (
                <div key={t.batch_id} className="flex items-center gap-1 text-[10px] text-red-700">
                  <AlertTriangle size={10} />
                  <span className="font-medium">{t.fahrer_name}</span>
                  <span>— Score {t.score} (unter Ziel)</span>
                </div>
              ))}
            </div>
          )}

          {sorted.map((tour, idx) => {
            const { text, bg } = scoreColor(tour.score);
            const pct = (tour.stops_done / Math.max(1, tour.stops_total)) * 100;
            return (
              <div key={tour.batch_id} className={`rounded-lg border ${bg} p-2`}>
                <div className="flex items-center gap-2">
                  {idx === 0 && <Trophy size={12} className="text-amber-500 shrink-0" />}
                  <ScoreRing score={tour.score} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[11px] font-bold text-gray-800 truncate">{tour.fahrer_name}</span>
                      {tour.eta_min !== null && (
                        <span className="text-[9px] bg-white border border-gray-200 rounded-full px-1.5 py-0.5 text-gray-600">
                          ETA {tour.eta_min} Min
                        </span>
                      )}
                    </div>
                    {/* Sub-Scores */}
                    <div className="mt-0.5 flex gap-2 text-[9px] text-gray-500">
                      <span>Pünktl. <span className={`font-semibold ${text}`}>{tour.sub_puenktlichkeit}</span></span>
                      <span>Effiz. <span className={`font-semibold ${text}`}>{tour.sub_effizienz}</span></span>
                      <span>Bew. <span className={`font-semibold ${text}`}>{tour.sub_bewertung}</span></span>
                    </div>
                    {/* Stop-Dots */}
                    <div className="mt-1 flex items-center gap-1">
                      {tour.stop_dots.map(dot => (
                        <span
                          key={dot.stop_id}
                          className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[7px] font-bold ${
                            dot.done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                          }`}
                        >
                          {dot.sequence}
                        </span>
                      ))}
                      <MapPin size={10} className="ml-auto text-gray-400" />
                    </div>
                    {/* Fortschrittsbalken */}
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-blue-400 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-0.5 text-[9px] text-gray-400">
                      {tour.stops_done}/{tour.stops_total} Stopps
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="text-[9px] text-gray-400 text-right">Ziel ≥80 Pkt · 20-Sek-Polling</div>
        </div>
      )}
    </div>
  );
}
