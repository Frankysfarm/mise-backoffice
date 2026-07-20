'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, MapPin, Star, TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface StoppDot {
  idx: number;
  abgeschlossen: boolean;
  verspaetet: boolean;
}

interface FahrerTour {
  fahrer_id: string;
  fahrer_name: string;
  tour_score: number;
  on_time_pct: number;
  effizienz_pct: number;
  stopps_gesamt: number;
  stopps_abgeschlossen: number;
  stopp_dots: StoppDot[];
  eta_rueckkehr_min: number | null;
  trend: string;
  ampel: string;
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerTour[];
  flotten_score: number;
  on_time_rate_fleet: number;
  alert_count: number;
}

const MOCK: ApiData = {
  fahrer: [
    {
      fahrer_id: 'f1', fahrer_name: 'Max M.', tour_score: 92, on_time_pct: 94, effizienz_pct: 91,
      stopps_gesamt: 5, stopps_abgeschlossen: 5, eta_rueckkehr_min: 8,
      stopp_dots: [
        { idx: 0, abgeschlossen: true, verspaetet: false }, { idx: 1, abgeschlossen: true, verspaetet: false },
        { idx: 2, abgeschlossen: true, verspaetet: false }, { idx: 3, abgeschlossen: true, verspaetet: false },
        { idx: 4, abgeschlossen: true, verspaetet: false },
      ],
      trend: 'steigend', ampel: 'gruen', alert: false,
    },
    {
      fahrer_id: 'f2', fahrer_name: 'Sarah K.', tour_score: 74, on_time_pct: 71, effizienz_pct: 78,
      stopps_gesamt: 4, stopps_abgeschlossen: 3, eta_rueckkehr_min: 22,
      stopp_dots: [
        { idx: 0, abgeschlossen: true, verspaetet: false }, { idx: 1, abgeschlossen: true, verspaetet: true },
        { idx: 2, abgeschlossen: true, verspaetet: false }, { idx: 3, abgeschlossen: false, verspaetet: false },
      ],
      trend: 'stabil', ampel: 'gelb', alert: false,
    },
    {
      fahrer_id: 'f3', fahrer_name: 'Tom B.', tour_score: 55, on_time_pct: 58, effizienz_pct: 62,
      stopps_gesamt: 3, stopps_abgeschlossen: 1, eta_rueckkehr_min: 35,
      stopp_dots: [
        { idx: 0, abgeschlossen: true, verspaetet: true }, { idx: 1, abgeschlossen: false, verspaetet: false },
        { idx: 2, abgeschlossen: false, verspaetet: false },
      ],
      trend: 'fallend', ampel: 'rot', alert: true,
    },
    {
      fahrer_id: 'f4', fahrer_name: 'Jana F.', tour_score: 88, on_time_pct: 90, effizienz_pct: 86,
      stopps_gesamt: 6, stopps_abgeschlossen: 4, eta_rueckkehr_min: 18,
      stopp_dots: [
        { idx: 0, abgeschlossen: true, verspaetet: false }, { idx: 1, abgeschlossen: true, verspaetet: false },
        { idx: 2, abgeschlossen: true, verspaetet: false }, { idx: 3, abgeschlossen: true, verspaetet: false },
        { idx: 4, abgeschlossen: false, verspaetet: false }, { idx: 5, abgeschlossen: false, verspaetet: false },
      ],
      trend: 'steigend', ampel: 'gruen', alert: false,
    },
  ],
  flotten_score: 77,
  on_time_rate_fleet: 78,
  alert_count: 1,
};

function ScoreRing({ score, size = 40 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 80 ? '#22c55e' : score >= 65 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={5} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="54%" dominantBaseline="middle" textAnchor="middle" fontSize={size * 0.26} fontWeight="700" fill={color}>
        {score}
      </text>
    </svg>
  );
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp  size={11} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={11} className="text-red-500"  />;
  return <Minus size={11} className="text-gray-400" />;
}

export function DispatchPhase2813TourScoreVisualisierungKommando({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    const load = () => {
      if (!locationId) { setData(MOCK); return; }
      fetch(`/api/delivery/admin/tour-score-visualisierung?location_id=${locationId}`)
        .then(r => r.ok ? r.json() : null)
        .then((d: ApiData | null) => setData(d ?? MOCK))
        .catch(() => setData(MOCK));
    };
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!data) return null;

  const sorted = [...data.fahrer].sort((a, b) => b.tour_score - a.tour_score);
  const hasAlert = data.alert_count > 0;

  return (
    <div className={`rounded-xl border p-3 mb-3 ${hasAlert ? 'border-red-300 bg-red-50' : 'border-indigo-200 bg-white'}`}>
      <button onClick={() => setOpen(o => !o)} className="flex items-center justify-between w-full text-left">
        <div className="flex items-center gap-2">
          <Star size={14} className="text-indigo-600" />
          <span className="font-semibold text-xs text-gray-800">Tour-Score Echtzeit-Visualisierung</span>
          {hasAlert && <AlertTriangle size={12} className="text-red-500" />}
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${data.flotten_score >= 80 ? 'bg-green-100 text-green-700' : data.flotten_score >= 65 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
            Flotte Ø {data.flotten_score}
          </span>
        </div>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {sorted.map(f => {
            const isExpanded = expanded === f.fahrer_id;
            const ampelCls = f.ampel === 'gruen' ? 'border-green-200' : f.ampel === 'gelb' ? 'border-amber-200' : 'border-red-200';
            return (
              <div key={f.fahrer_id} className={`rounded-lg border ${ampelCls} bg-white px-3 py-2`}>
                <button onClick={() => setExpanded(isExpanded ? null : f.fahrer_id)} className="w-full">
                  <div className="flex items-center gap-3">
                    <ScoreRing score={f.tour_score} size={44} />
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-semibold text-gray-800">{f.fahrer_name}</span>
                        <TrendIcon trend={f.trend} />
                        {f.alert && <AlertTriangle size={11} className="text-red-500" />}
                      </div>
                      {/* Stopp-Dots */}
                      <div className="flex gap-1 mt-1">
                        {f.stopp_dots.map(d => (
                          <span
                            key={d.idx}
                            className={`w-3 h-3 rounded-full ${d.abgeschlossen ? (d.verspaetet ? 'bg-amber-400' : 'bg-green-500') : 'bg-gray-200'}`}
                            title={d.abgeschlossen ? (d.verspaetet ? 'Verspätet' : 'Pünktlich') : 'Ausstehend'}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      {f.eta_rueckkehr_min !== null && (
                        <span className="text-[10px] text-gray-500">ETA {f.eta_rueckkehr_min} Min.</span>
                      )}
                      <div className="flex items-center justify-end gap-1 mt-0.5">
                        <MapPin size={9} className="text-gray-400" />
                        <span className="text-[10px] text-gray-400">{f.stopps_abgeschlossen}/{f.stopps_gesamt}</span>
                      </div>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="mt-2 pt-2 border-t border-gray-100 grid grid-cols-2 gap-2">
                    <div className="text-center">
                      <div className="text-xs font-bold text-gray-700">{f.on_time_pct}%</div>
                      <div className="text-[10px] text-gray-400">Pünktlichkeit</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-bold text-gray-700">{f.effizienz_pct}%</div>
                      <div className="text-[10px] text-gray-400">Effizienz</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-bold text-gray-700">{f.stopps_abgeschlossen}</div>
                      <div className="text-[10px] text-gray-400">Stopps erledigt</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-bold text-gray-700">{f.stopps_gesamt - f.stopps_abgeschlossen}</div>
                      <div className="text-[10px] text-gray-400">Noch ausstehend</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <div className="text-[10px] text-gray-400 text-center pt-1">
            Flotten-On-Time-Rate: <strong className={data.on_time_rate_fleet >= 85 ? 'text-green-700' : 'text-amber-700'}>{data.on_time_rate_fleet}%</strong>
            {hasAlert && <span className="ml-2 text-red-600">— {data.alert_count} Fahrer: Score &lt;60 !</span>}
          </div>
        </div>
      )}
    </div>
  );
}
