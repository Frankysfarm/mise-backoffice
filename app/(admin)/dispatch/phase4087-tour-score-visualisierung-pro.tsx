'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, MapPin, Clock, Star, TrendingUp, AlertTriangle, Navigation2, CheckCircle2, Circle } from 'lucide-react';

type StopStatus = 'ausstehend' | 'unterwegs' | 'geliefert' | 'problem';

interface TourStop {
  stop_id: string;
  order_number: string;
  adresse_kurz: string;
  eta_min: number | null;
  status: StopStatus;
  lieferzeit_min: number | null;
}

interface FahrerTour {
  fahrer_id: string;
  fahrer_name: string;
  tour_score: number;
  score_delta: number;
  stops: TourStop[];
  puenktlichkeit_pct: number;
  avg_lieferzeit_min: number;
  bewertung: number;
  aktiv: boolean;
}

interface ApiData {
  fahrer: FahrerTour[];
  flotten_avg_score: number;
  flotten_top_score: number;
  aktive_touren: number;
  score_alert_count: number;
}

const MOCK: ApiData = {
  flotten_avg_score: 76,
  flotten_top_score: 94,
  aktive_touren: 3,
  score_alert_count: 1,
  fahrer: [
    {
      fahrer_id: 'f1', fahrer_name: 'Maria S.', tour_score: 94, score_delta: +3, aktiv: true,
      puenktlichkeit_pct: 96, avg_lieferzeit_min: 22, bewertung: 4.8,
      stops: [
        { stop_id: 's1', order_number: '#1041', adresse_kurz: 'Pontstr. 42', eta_min: null, status: 'geliefert', lieferzeit_min: 21 },
        { stop_id: 's2', order_number: '#1042', adresse_kurz: 'Ludwigstr. 7', eta_min: 4, status: 'unterwegs', lieferzeit_min: null },
        { stop_id: 's3', order_number: '#1044', adresse_kurz: 'Kaiserpl. 3', eta_min: 12, status: 'ausstehend', lieferzeit_min: null },
      ],
    },
    {
      fahrer_id: 'f2', fahrer_name: 'Ben K.', tour_score: 68, score_delta: -5, aktiv: true,
      puenktlichkeit_pct: 71, avg_lieferzeit_min: 28, bewertung: 4.1,
      stops: [
        { stop_id: 's4', order_number: '#1043', adresse_kurz: 'Elisenbr. 1', eta_min: null, status: 'geliefert', lieferzeit_min: 29 },
        { stop_id: 's5', order_number: '#1045', adresse_kurz: 'Römerstr. 15', eta_min: 8, status: 'unterwegs', lieferzeit_min: null },
      ],
    },
    {
      fahrer_id: 'f3', fahrer_name: 'Lara M.', tour_score: 88, score_delta: +1, aktiv: true,
      puenktlichkeit_pct: 91, avg_lieferzeit_min: 24, bewertung: 4.6,
      stops: [
        { stop_id: 's6', order_number: '#1046', adresse_kurz: 'Theaterstr. 5', eta_min: 2, status: 'unterwegs', lieferzeit_min: null },
        { stop_id: 's7', order_number: '#1047', adresse_kurz: 'Templergraben', eta_min: 16, status: 'ausstehend', lieferzeit_min: null },
      ],
    },
  ],
};

const stopDot: Record<StopStatus, { bg: string; icon: React.ReactNode }> = {
  geliefert: { bg: 'bg-emerald-400', icon: <CheckCircle2 className="w-2.5 h-2.5 text-white" /> },
  unterwegs: { bg: 'bg-blue-500', icon: <Navigation2 className="w-2.5 h-2.5 text-white" /> },
  ausstehend: { bg: 'bg-gray-300', icon: <Circle className="w-2.5 h-2.5 text-gray-400" /> },
  problem: { bg: 'bg-red-500', icon: <AlertTriangle className="w-2.5 h-2.5 text-white" /> },
};

interface Props { locationId: string | null; }

export function DispatchPhase4087TourScoreVisualisierungPro({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/tour-score-visualisierung?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Trophy className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-bold text-gray-900">Tour-Score Visualisierung Pro</span>
        </div>
        <div className="flex items-center gap-2">
          {loading && <span className="w-2.5 h-2.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          {data.score_alert_count > 0 && (
            <span className="text-[10px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded font-semibold flex items-center gap-0.5">
              <AlertTriangle className="w-3 h-3" /> {data.score_alert_count}
            </span>
          )}
        </div>
      </div>

      {/* Flotten-KPI */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Flotten-Avg', value: data.flotten_avg_score, suffix: '/100', color: data.flotten_avg_score >= 80 ? 'text-emerald-600' : data.flotten_avg_score >= 65 ? 'text-yellow-500' : 'text-red-500' },
          { label: 'Top-Score', value: data.flotten_top_score, suffix: '/100', color: 'text-amber-500' },
          { label: 'Aktive Touren', value: data.aktive_touren, suffix: '', color: 'text-blue-600' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-gray-50 rounded-lg p-2 text-center">
            <div className={`text-base font-bold ${kpi.color}`}>{kpi.value}<span className="text-[10px] font-normal">{kpi.suffix}</span></div>
            <div className="text-[9px] text-gray-400">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Fahrer-Karten */}
      <div className="space-y-2">
        {data.fahrer.map((f) => {
          const scoreColor = f.tour_score >= 85 ? 'text-emerald-600' : f.tour_score >= 70 ? 'text-yellow-500' : 'text-red-500';
          const barColor = f.tour_score >= 85 ? 'bg-emerald-500' : f.tour_score >= 70 ? 'bg-yellow-400' : 'bg-red-500';
          const deltaColor = f.score_delta > 0 ? 'text-emerald-500' : f.score_delta < 0 ? 'text-red-500' : 'text-gray-400';
          const isExpanded = expanded === f.fahrer_id;

          return (
            <div key={f.fahrer_id} className={`border rounded-lg overflow-hidden ${f.tour_score < 70 ? 'border-red-200 bg-red-50/40' : 'border-gray-200 bg-white'}`}>
              <button
                className="w-full text-left p-2.5 flex items-center gap-2"
                onClick={() => setExpanded(isExpanded ? null : f.fahrer_id)}
              >
                {/* Score Ring */}
                <div className="relative w-9 h-9 flex-shrink-0">
                  <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="#f3f4f6" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="15" fill="none"
                      stroke={f.tour_score >= 85 ? '#10b981' : f.tour_score >= 70 ? '#f59e0b' : '#ef4444'}
                      strokeWidth="3"
                      strokeDasharray={`${(f.tour_score / 100) * 94.2} 94.2`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold ${scoreColor}`}>
                    {f.tour_score}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-gray-900 truncate">{f.fahrer_name}</span>
                    <span className={`text-[10px] font-medium ${deltaColor}`}>
                      {f.score_delta > 0 ? '+' : ''}{f.score_delta}
                    </span>
                  </div>
                  {/* Stop-Dot-Timeline */}
                  <div className="flex items-center gap-1 mt-1">
                    {f.stops.map((s) => (
                      <div key={s.stop_id} className={`w-4 h-4 rounded-full flex items-center justify-center ${stopDot[s.status].bg}`} title={`${s.order_number} – ${s.adresse_kurz}`}>
                        {stopDot[s.status].icon}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-[10px] text-gray-400 flex-shrink-0">
                  {isExpanded ? '▲' : '▼'}
                </div>
              </button>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="px-2.5 pb-2.5 space-y-1.5 border-t border-gray-100">
                  {/* Sub-KPIs */}
                  <div className="grid grid-cols-3 gap-1 pt-1.5">
                    {[
                      { label: 'Pünktlich', value: `${f.puenktlichkeit_pct}%`, icon: <Clock className="w-3 h-3" /> },
                      { label: 'Ø Lieferzeit', value: `${f.avg_lieferzeit_min} min`, icon: <TrendingUp className="w-3 h-3" /> },
                      { label: 'Bewertung', value: `${f.bewertung}★`, icon: <Star className="w-3 h-3" /> },
                    ].map((k) => (
                      <div key={k.label} className="bg-gray-50 rounded p-1 text-center">
                        <div className="flex justify-center text-gray-500 mb-0.5">{k.icon}</div>
                        <div className="text-[11px] font-bold text-gray-800">{k.value}</div>
                        <div className="text-[9px] text-gray-400">{k.label}</div>
                      </div>
                    ))}
                  </div>
                  {/* Stop details */}
                  {f.stops.map((s) => (
                    <div key={s.stop_id} className="flex items-center gap-2 text-[10px]">
                      <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 ${stopDot[s.status].bg}`} />
                      <span className="font-medium text-gray-700">{s.order_number}</span>
                      <span className="text-gray-500 flex-1 truncate">{s.adresse_kurz}</span>
                      {s.eta_min !== null && <span className="text-blue-500 flex items-center gap-0.5"><Navigation2 className="w-2.5 h-2.5" /> {s.eta_min} min</span>}
                      {s.lieferzeit_min !== null && <span className="text-emerald-500">{s.lieferzeit_min} min</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-[9px] text-gray-400 text-center border-t border-gray-100 pt-1">
        20-Sek-Polling · Score-Balken 0–100 · Stopp-Timeline farbkodiert
      </div>
    </div>
  );
}
