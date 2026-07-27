'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, Route, AlertTriangle, TrendingUp, TrendingDown, Minus, CheckCircle, Clock, MapPin } from 'lucide-react';

interface TourStop {
  stopp_nr: number;
  adresse: string;
  status: 'ausstehend' | 'unterwegs' | 'geliefert' | 'problem';
  eta_min: number | null;
}

interface TourRow {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  score_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  stopps: TourStop[];
  aktiver_stopp: number;
  puenktlichkeit: number;
  lieferzeit: number;
  bewertung: number;
  expanded: boolean;
}

interface ApiData {
  touren: TourRow[];
  flotte_avg_score: number;
  top_score: number;
  top_name: string;
  alert_count: number;
}

const MOCK: ApiData = {
  flotte_avg_score: 79,
  top_score: 94,
  top_name: 'Max M.',
  alert_count: 1,
  touren: [
    {
      fahrer_id: 'f1', fahrer_name: 'Max M.', score: 94, score_delta: 3, ampel: 'gruen',
      aktiver_stopp: 2, puenktlichkeit: 95, lieferzeit: 22, bewertung: 4.8, expanded: false,
      stopps: [
        { stopp_nr: 1, adresse: 'Hauptstr. 12', status: 'geliefert', eta_min: null },
        { stopp_nr: 2, adresse: 'Gartenweg 5', status: 'unterwegs', eta_min: 4 },
        { stopp_nr: 3, adresse: 'Am Berg 17', status: 'ausstehend', eta_min: 14 },
      ],
    },
    {
      fahrer_id: 'f2', fahrer_name: 'Julia F.', score: 71, score_delta: -2, ampel: 'gelb',
      aktiver_stopp: 1, puenktlichkeit: 72, lieferzeit: 31, bewertung: 4.2, expanded: false,
      stopps: [
        { stopp_nr: 1, adresse: 'Mühlenstr. 8', status: 'unterwegs', eta_min: 7 },
        { stopp_nr: 2, adresse: 'Parkweg 3', status: 'ausstehend', eta_min: 18 },
      ],
    },
    {
      fahrer_id: 'f3', fahrer_name: 'Tim B.', score: 58, score_delta: -5, ampel: 'rot',
      aktiver_stopp: 1, puenktlichkeit: 60, lieferzeit: 38, bewertung: 3.9, expanded: false,
      stopps: [
        { stopp_nr: 1, adresse: 'Feldstraße 22', status: 'unterwegs', eta_min: 12 },
        { stopp_nr: 2, adresse: 'Kirchplatz 1', status: 'ausstehend', eta_min: 25 },
        { stopp_nr: 3, adresse: 'Lindenweg 9', status: 'ausstehend', eta_min: 36 },
      ],
    },
  ],
};

function StoppDot({ status }: { status: TourStop['status'] }) {
  const cls = status === 'geliefert' ? 'bg-emerald-500' : status === 'unterwegs' ? 'bg-blue-500 animate-pulse' : status === 'problem' ? 'bg-red-500' : 'bg-gray-300';
  return <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cls}`} />;
}

interface Props { locationId: string | null; }

export function DispatchPhase4172TourScoreLiveVisualisierung({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/tour-score-visualisierung?location_id=${locationId}`);
      if (res.ok) { const j = await res.json(); if (!j.error) setData(j); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const iv = setInterval(load, 20_000); return () => clearInterval(iv); }, [load]);

  return (
    <div className="bg-white rounded-xl border border-amber-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-semibold text-gray-900">Tour-Score Live-Visualisierung</span>
          {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
        </div>
        {data.alert_count > 0 && (
          <span className="flex items-center gap-1 text-xs text-red-600 font-semibold bg-red-50 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3.5 h-3.5" /> {data.alert_count} Score &lt;70!
          </span>
        )}
      </div>

      {/* Flotten-KPIs */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-amber-50 rounded-lg p-2">
          <p className="text-[10px] text-amber-600 font-medium">Flotten-Avg</p>
          <p className="text-base font-black text-amber-700">{data.flotte_avg_score}</p>
        </div>
        <div className="bg-emerald-50 rounded-lg p-2">
          <p className="text-[10px] text-emerald-600 font-medium">Top-Score</p>
          <p className="text-base font-black text-emerald-700">{data.top_score}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-[10px] text-gray-500 font-medium">Top-Fahrer</p>
          <p className="text-sm font-black text-gray-700 truncate">{data.top_name}</p>
        </div>
      </div>

      {/* Tour-Karten */}
      <div className="space-y-2">
        {data.touren.map(t => {
          const isOpen = expanded[t.fahrer_id] ?? false;
          const barColor = t.ampel === 'gruen' ? 'bg-emerald-500' : t.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-500';
          const borderColor = t.ampel === 'gruen' ? 'border-emerald-200' : t.ampel === 'gelb' ? 'border-yellow-200' : 'border-red-200';
          const Delta = t.score_delta > 0 ? TrendingUp : t.score_delta < 0 ? TrendingDown : Minus;
          const dColor = t.score_delta > 0 ? 'text-emerald-500' : t.score_delta < 0 ? 'text-red-400' : 'text-gray-300';

          return (
            <div key={t.fahrer_id} className={`rounded-lg border ${borderColor} overflow-hidden`}>
              {/* Tour-Header */}
              <button
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition"
                onClick={() => setExpanded(e => ({ ...e, [t.fahrer_id]: !isOpen }))}
              >
                <span className="text-xs font-bold text-gray-800 flex-1 text-left truncate">{t.fahrer_name}</span>
                <Delta className={`w-3.5 h-3.5 ${dColor}`} />
                <span className="text-sm font-black text-gray-900 tabular-nums w-8 text-right">{t.score}</span>
                <Route className="w-3.5 h-3.5 text-gray-400" />
              </button>
              {/* Score-Balken */}
              <div className="h-1 bg-gray-100">
                <div className={`h-full ${barColor} transition-all duration-700`} style={{ width: `${t.score}%` }} />
              </div>
              {/* Sub-KPIs */}
              <div className="flex gap-3 px-3 py-1.5 text-[10px] text-gray-500 bg-gray-50">
                <span className="flex items-center gap-0.5"><CheckCircle className="w-2.5 h-2.5 text-emerald-500" />{t.puenktlichkeit}%</span>
                <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5 text-blue-500" />{t.lieferzeit}min</span>
                <span className="flex items-center gap-0.5">★{t.bewertung}</span>
                <span className="ml-auto text-gray-400">Stopp {t.aktiver_stopp}/{t.stopps.length}</span>
              </div>
              {/* Expandable Stopp-Sequenz */}
              {isOpen && (
                <div className="px-3 pb-2 pt-1 space-y-1 border-t border-gray-100">
                  {t.stopps.map(s => (
                    <div key={s.stopp_nr} className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 w-4 text-right">#{s.stopp_nr}</span>
                      <StoppDot status={s.status} />
                      <span className="text-[10px] text-gray-600 flex-1 truncate">{s.adresse}</span>
                      {s.eta_min !== null && (
                        <span className="text-[10px] text-blue-600 font-medium flex items-center gap-0.5">
                          <MapPin className="w-2.5 h-2.5" />{s.eta_min}min
                        </span>
                      )}
                      {s.status === 'geliefert' && <CheckCircle className="w-3 h-3 text-emerald-500" />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between text-[10px] text-gray-400 pt-1 border-t border-gray-100">
        <span>Score-Ziel: ≥70</span>
        <span>20-Sek-Polling</span>
      </div>
    </div>
  );
}
