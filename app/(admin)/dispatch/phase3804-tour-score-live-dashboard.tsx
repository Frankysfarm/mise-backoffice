'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, TrendingUp, TrendingDown, AlertTriangle, MapPin, Clock, Star } from 'lucide-react';

interface TourStopp {
  stopp_nr: number;
  adresse: string;
  status: 'ausstehend' | 'unterwegs' | 'geliefert';
  eta_min: number | null;
}

interface FahrerScore {
  fahrer_id: string;
  fahrer_name: string;
  gesamt_score: number;          // 0–100
  puenktlichkeit_pct: number;
  lieferzeit_pct: number;
  bewertung_avg: number;
  aktive_tour: boolean;
  stopps: TourStopp[];
  expanded: boolean;
}

interface ApiData {
  fahrer: FahrerScore[];
  flotten_avg: number;
  alert_count: number;
}

const MOCK: ApiData = {
  flotten_avg: 82,
  alert_count: 1,
  fahrer: [
    {
      fahrer_id: 'f1', fahrer_name: 'Julia F.', gesamt_score: 94,
      puenktlichkeit_pct: 97, lieferzeit_pct: 91, bewertung_avg: 4.9,
      aktive_tour: true, expanded: false,
      stopps: [
        { stopp_nr: 1, adresse: 'Hauptstr. 12', status: 'geliefert', eta_min: null },
        { stopp_nr: 2, adresse: 'Bahnhofsplatz 5', status: 'unterwegs', eta_min: 4 },
        { stopp_nr: 3, adresse: 'Kirchgasse 8',  status: 'ausstehend', eta_min: 12 },
      ],
    },
    {
      fahrer_id: 'f2', fahrer_name: 'Max M.', gesamt_score: 81,
      puenktlichkeit_pct: 82, lieferzeit_pct: 78, bewertung_avg: 4.5,
      aktive_tour: true, expanded: false,
      stopps: [
        { stopp_nr: 1, adresse: 'Ringstraße 3',  status: 'geliefert', eta_min: null },
        { stopp_nr: 2, adresse: 'Marktplatz 1',  status: 'ausstehend', eta_min: 8 },
      ],
    },
    {
      fahrer_id: 'f3', fahrer_name: 'Tim B.', gesamt_score: 63,
      puenktlichkeit_pct: 61, lieferzeit_pct: 65, bewertung_avg: 3.9,
      aktive_tour: false, expanded: false,
      stopps: [],
    },
  ],
};

function scoreBarColor(score: number): string {
  if (score >= 85) return 'bg-emerald-500';
  if (score >= 70) return 'bg-yellow-400';
  return 'bg-red-400';
}

function scoreTextColor(score: number): string {
  if (score >= 85) return 'text-emerald-700';
  if (score >= 70) return 'text-yellow-600';
  return 'text-red-600';
}

function stoppDot(status: TourStopp['status']): string {
  if (status === 'geliefert')  return 'bg-emerald-500';
  if (status === 'unterwegs')  return 'bg-indigo-500 animate-pulse';
  return 'bg-gray-300';
}

export function DispatchPhase3804TourScoreLiveDashboard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/dispatch/tour-score?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch {
      // Mock-Fallback
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 20_000); return () => clearInterval(id); }, [load]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-semibold text-gray-900">Tour-Score</span>
          {loading && <span className="w-2.5 h-2.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />}
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-gray-500">Flotte Ø</span>
          <span className={`font-bold ${scoreTextColor(data.flotten_avg)}`}>{data.flotten_avg}</span>
        </div>
      </div>

      {/* Alert */}
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-800">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span>{data.alert_count} Fahrer mit Score &lt; 70</span>
        </div>
      )}

      {/* Fahrer-Liste */}
      <div className="space-y-2">
        {data.fahrer.map(f => {
          const isExp = expanded[f.fahrer_id] ?? false;
          return (
            <div key={f.fahrer_id} className="border border-gray-100 rounded-lg overflow-hidden">
              {/* Fahrer-Zeile */}
              <button
                className="w-full flex items-center gap-2 p-2 text-left hover:bg-gray-50 transition-colors"
                onClick={() => setExpanded(e => ({ ...e, [f.fahrer_id]: !isExp }))}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="font-medium text-gray-800 truncate">{f.fahrer_name}</span>
                    {!f.aktive_tour && <span className="text-[10px] text-gray-400 bg-gray-100 px-1 rounded">offline</span>}
                  </div>
                  <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${scoreBarColor(f.gesamt_score)}`}
                      style={{ width: `${f.gesamt_score}%` }}
                    />
                  </div>
                </div>
                <span className={`text-sm font-bold ml-2 shrink-0 ${scoreTextColor(f.gesamt_score)}`}>
                  {f.gesamt_score}
                </span>
              </button>

              {/* Aufgeklappte Sub-KPIs + Stopp-Timeline */}
              {isExp && (
                <div className="border-t border-gray-100 p-2 bg-gray-50 space-y-2">
                  {/* Sub-Scores */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> Pünktl.</span>
                      <span className={`text-xs font-bold ${f.puenktlichkeit_pct >= 85 ? 'text-emerald-700' : 'text-yellow-600'}`}>
                        {f.puenktlichkeit_pct}%
                      </span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" /> Lieferz.</span>
                      <span className={`text-xs font-bold ${f.lieferzeit_pct >= 85 ? 'text-emerald-700' : 'text-yellow-600'}`}>
                        {f.lieferzeit_pct}%
                      </span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><Star className="w-2.5 h-2.5" /> Bewert.</span>
                      <span className={`text-xs font-bold ${f.bewertung_avg >= 4.5 ? 'text-emerald-700' : f.bewertung_avg >= 4.0 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {f.bewertung_avg.toFixed(1)}★
                      </span>
                    </div>
                  </div>

                  {/* Stopp-Dot-Timeline */}
                  {f.stopps.length > 0 && (
                    <div>
                      <span className="text-[10px] text-gray-400 mb-1 block">Tour-Stopps</span>
                      <div className="flex items-center gap-2">
                        {f.stopps.map((s, i) => (
                          <div key={s.stopp_nr} className="flex items-center gap-1">
                            <div className="flex flex-col items-center gap-0.5">
                              <div className={`w-3 h-3 rounded-full ${stoppDot(s.status)}`} />
                              {s.eta_min !== null && (
                                <span className="text-[9px] text-gray-500">{s.eta_min}m</span>
                              )}
                            </div>
                            {i < f.stopps.length - 1 && <div className="w-4 h-px bg-gray-300" />}
                          </div>
                        ))}
                        <span className="text-[10px] text-gray-400 ml-1">
                          {f.stopps.filter(s => s.status === 'geliefert').length}/{f.stopps.length}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-gray-400 border-t border-gray-100 pt-1.5">
        <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Flotten-Ø {data.flotten_avg}/100</span>
        <span>Live · 20-Sek-Polling</span>
      </div>
    </div>
  );
}
