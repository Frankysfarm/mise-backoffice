'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, MapPin, CheckCircle2, Clock, AlertTriangle, TrendingUp, Route } from 'lucide-react';

interface TourStop {
  id: string;
  reihenfolge: number;
  status: 'ausstehend' | 'unterwegs' | 'geliefert';
  kunde_name: string | null;
  eta_min: number | null;
}

interface TourRow {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  stops: TourStop[];
  puenktlichkeit_pct: number;
  liefer_min_avg: number;
  bewertung: number | null;
}

interface FleetKpi {
  fleet_avg: number;
  top_score: number;
  aktive_touren: number;
  alerts: number;
}

const MOCK_TOURS: TourRow[] = [
  {
    fahrer_id: 'd1', fahrer_name: 'Max M.', score: 88,
    stops: [
      { id: 's1', reihenfolge: 1, status: 'geliefert', kunde_name: 'Müller', eta_min: null },
      { id: 's2', reihenfolge: 2, status: 'unterwegs', kunde_name: 'Schmidt', eta_min: 4 },
      { id: 's3', reihenfolge: 3, status: 'ausstehend', kunde_name: 'Weber', eta_min: 12 },
    ],
    puenktlichkeit_pct: 91, liefer_min_avg: 23, bewertung: 4.8,
  },
  {
    fahrer_id: 'd2', fahrer_name: 'Anna K.', score: 65,
    stops: [
      { id: 's4', reihenfolge: 1, status: 'geliefert', kunde_name: 'Fischer', eta_min: null },
      { id: 's5', reihenfolge: 2, status: 'unterwegs', kunde_name: 'Wagner', eta_min: 9 },
    ],
    puenktlichkeit_pct: 72, liefer_min_avg: 31, bewertung: 4.1,
  },
  {
    fahrer_id: 'd3', fahrer_name: 'Tom R.', score: 79,
    stops: [
      { id: 's6', reihenfolge: 1, status: 'unterwegs', kunde_name: 'Becker', eta_min: 6 },
      { id: 's7', reihenfolge: 2, status: 'ausstehend', kunde_name: 'Braun', eta_min: 15 },
      { id: 's8', reihenfolge: 3, status: 'ausstehend', kunde_name: 'Schulz', eta_min: 22 },
    ],
    puenktlichkeit_pct: 83, liefer_min_avg: 27, bewertung: 4.5,
  },
];
const MOCK_KPI: FleetKpi = { fleet_avg: 77, top_score: 88, aktive_touren: 3, alerts: 1 };

function scoreColor(s: number) {
  if (s >= 80) return 'text-emerald-700';
  if (s >= 65) return 'text-yellow-600';
  return 'text-red-600';
}

function stopDot(status: TourStop['status']) {
  if (status === 'geliefert') return 'bg-emerald-500';
  if (status === 'unterwegs') return 'bg-blue-500 animate-pulse';
  return 'bg-slate-300';
}

export function DispatchPhase3929TourScoreVisualisierungLiveKommando({ locationId }: { locationId: string | null }) {
  const [tours, setTours] = useState<TourRow[]>(MOCK_TOURS);
  const [kpi, setKpi] = useState<FleetKpi>(MOCK_KPI);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/tour-score-live?location_id=${locationId}`);
      if (res.ok) {
        const d = await res.json();
        if (Array.isArray(d.tours)) setTours(d.tours);
        if (d.kpi) setKpi(d.kpi);
      }
    } catch { /* Mock-Fallback */ }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 20000); return () => clearInterval(id); }, [load]);

  const sorted = [...tours].sort((a, b) => b.score - a.score);

  return (
    <div className="rounded-xl border border-amber-100 bg-white p-4 space-y-3 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="font-semibold text-sm text-slate-800">Tour-Score & Visualisierung Live</span>
        {kpi.alerts > 0 && (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 animate-pulse">
            <AlertTriangle className="h-3 w-3" /> {kpi.alerts} Alert
          </span>
        )}
      </div>

      {/* Flotten-KPI */}
      <div className="grid grid-cols-4 gap-1.5">
        {[
          { label: 'Ø Score', value: kpi.fleet_avg, icon: <TrendingUp className="h-3 w-3" />, good: kpi.fleet_avg >= 75 },
          { label: 'Top', value: kpi.top_score, icon: <Trophy className="h-3 w-3" />, good: true },
          { label: 'Aktiv', value: kpi.aktive_touren, icon: <Route className="h-3 w-3" />, good: true },
          { label: 'Alerts', value: kpi.alerts, icon: <AlertTriangle className="h-3 w-3" />, good: kpi.alerts === 0 },
        ].map(k => (
          <div key={k.label} className="rounded-lg bg-slate-50 p-1.5 text-center">
            <div className={`flex items-center justify-center mb-0.5 ${k.good ? 'text-emerald-600' : 'text-red-500'}`}>{k.icon}</div>
            <div className={`text-xs font-bold tabular-nums ${k.good ? 'text-emerald-700' : 'text-red-600'}`}>{k.value}</div>
            <div className="text-[9px] text-slate-400">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tour-Karten */}
      <div className="space-y-2">
        {sorted.map(t => {
          const isOpen = expanded === t.fahrer_id;
          const low = t.score < 70;
          return (
            <div key={t.fahrer_id} className={`rounded-lg border p-3 cursor-pointer transition-all ${low ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}`}
              onClick={() => setExpanded(isOpen ? null : t.fahrer_id)}>
              {/* Score-Zeile */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-700">{t.fahrer_name}</span>
                  {low && <span className="text-[9px] rounded bg-red-100 px-1 py-0.5 font-bold text-red-600">Score &lt; 70</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold tabular-nums ${scoreColor(t.score)}`}>{t.score}</span>
                  <span className="text-[10px] text-slate-400">/ 100</span>
                </div>
              </div>

              {/* Score-Balken */}
              <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${t.score >= 80 ? 'bg-emerald-500' : t.score >= 65 ? 'bg-yellow-400' : 'bg-red-500'}`}
                  style={{ width: `${t.score}%` }}
                />
              </div>

              {/* Stopp-Dot-Timeline */}
              <div className="flex items-center gap-1.5">
                {t.stops.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-1">
                    {i > 0 && <div className="h-px w-3 bg-slate-300" />}
                    <div className="flex flex-col items-center gap-0.5">
                      <div className={`h-3 w-3 rounded-full ${stopDot(s.status)}`} title={s.kunde_name ?? `Stopp ${s.reihenfolge}`} />
                      {s.eta_min !== null && (
                        <span className="text-[8px] text-blue-600 tabular-nums">{s.eta_min}m</span>
                      )}
                    </div>
                  </div>
                ))}
                <div className="ml-auto text-[9px] text-slate-400">
                  {t.stops.filter(s => s.status === 'geliefert').length}/{t.stops.length} geliefert
                </div>
              </div>

              {/* Aufklappbare Sub-KPIs */}
              {isOpen && (
                <div className="mt-2 pt-2 border-t border-slate-200 grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <div className={`text-xs font-bold ${t.puenktlichkeit_pct >= 85 ? 'text-emerald-700' : 'text-red-600'}`}>{t.puenktlichkeit_pct}%</div>
                    <div className="text-[9px] text-slate-400">Pünktlichkeit</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-xs font-bold ${t.liefer_min_avg <= 28 ? 'text-emerald-700' : 'text-red-600'}`}>{t.liefer_min_avg} Min</div>
                    <div className="text-[9px] text-slate-400">Ø Lieferzeit</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-xs font-bold ${(t.bewertung ?? 0) >= 4.4 ? 'text-emerald-700' : 'text-yellow-600'}`}>{t.bewertung?.toFixed(1) ?? '–'} ★</div>
                    <div className="text-[9px] text-slate-400">Bewertung</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-[10px] text-slate-400 flex items-center gap-1">
        <Clock className="h-3 w-3" />
        <span>Tour-Score Live · Stopp-Timeline farbkodiert · 20-Sek-Polling</span>
      </div>
    </div>
  );
}
