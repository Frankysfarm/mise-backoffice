'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, ChevronDown, ChevronUp, AlertTriangle, MapPin, Clock, Zap, TrendingUp } from 'lucide-react';

interface TourStopp {
  stopp_nr: number;
  adresse: string;
  status: 'ausstehend' | 'abgeschlossen' | 'unterwegs';
  eta_min: number | null;
}

interface TourScore {
  tour_id: string;
  fahrer_name: string;
  score: number;
  sub_puenktlichkeit: number;
  sub_abschluss: number;
  sub_speed: number;
  stopps_gesamt: number;
  stopps_fertig: number;
  aktuelle_stopp_adresse: string | null;
  stopps: TourStopp[];
  alert_low: boolean;
}

interface ApiData {
  touren: TourScore[];
  flotte_avg_score: number;
  alert_count: number;
}

const MOCK: ApiData = {
  flotte_avg_score: 78,
  alert_count: 1,
  touren: [
    {
      tour_id: 't1', fahrer_name: 'Max M.', score: 91,
      sub_puenktlichkeit: 95, sub_abschluss: 90, sub_speed: 88,
      stopps_gesamt: 6, stopps_fertig: 4,
      aktuelle_stopp_adresse: 'Vaalser Str. 12',
      alert_low: false,
      stopps: [
        { stopp_nr: 1, adresse: 'Pontstraße 3',   status: 'abgeschlossen', eta_min: null },
        { stopp_nr: 2, adresse: 'Jülicher Str. 7', status: 'abgeschlossen', eta_min: null },
        { stopp_nr: 3, adresse: 'Kölner Str. 21',  status: 'abgeschlossen', eta_min: null },
        { stopp_nr: 4, adresse: 'Brand 45',         status: 'abgeschlossen', eta_min: null },
        { stopp_nr: 5, adresse: 'Vaalser Str. 12',  status: 'unterwegs',     eta_min: 4 },
        { stopp_nr: 6, adresse: 'Düppelstr. 8',     status: 'ausstehend',    eta_min: 12 },
      ],
    },
    {
      tour_id: 't2', fahrer_name: 'Sara K.', score: 63,
      sub_puenktlichkeit: 58, sub_abschluss: 70, sub_speed: 60,
      stopps_gesamt: 5, stopps_fertig: 1,
      aktuelle_stopp_adresse: 'Neuköllner Str. 5',
      alert_low: true,
      stopps: [
        { stopp_nr: 1, adresse: 'Burtscheid 2',       status: 'abgeschlossen', eta_min: null },
        { stopp_nr: 2, adresse: 'Neuköllner Str. 5',  status: 'unterwegs',     eta_min: 7  },
        { stopp_nr: 3, adresse: 'Eupenerstr. 42',     status: 'ausstehend',    eta_min: 18 },
        { stopp_nr: 4, adresse: 'Roermonder Str. 9',  status: 'ausstehend',    eta_min: 27 },
        { stopp_nr: 5, adresse: 'Forster Str. 14',    status: 'ausstehend',    eta_min: 35 },
      ],
    },
    {
      tour_id: 't3', fahrer_name: 'Julia F.', score: 85,
      sub_puenktlichkeit: 88, sub_abschluss: 85, sub_speed: 82,
      stopps_gesamt: 4, stopps_fertig: 3,
      aktuelle_stopp_adresse: 'Lindenplatz 1',
      alert_low: false,
      stopps: [
        { stopp_nr: 1, adresse: 'Augustastr. 11', status: 'abgeschlossen', eta_min: null },
        { stopp_nr: 2, adresse: 'Hartmannstr. 6', status: 'abgeschlossen', eta_min: null },
        { stopp_nr: 3, adresse: 'Prager Ring 3',  status: 'abgeschlossen', eta_min: null },
        { stopp_nr: 4, adresse: 'Lindenplatz 1',  status: 'unterwegs',     eta_min: 3  },
      ],
    },
  ],
};

function ScoreRing({ score }: { score: number }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const color = score >= 80 ? '#10b981' : score >= 65 ? '#f59e0b' : '#ef4444';

  return (
    <svg width="52" height="52" viewBox="0 0 52 52" className="shrink-0">
      <circle cx="26" cy="26" r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
      <circle
        cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${circ} ${circ}`}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 26 26)"
      />
      <text x="26" y="30" textAnchor="middle" className="text-[11px]" style={{ fontSize: 11, fontWeight: 700, fill: color }}>
        {score}
      </text>
    </svg>
  );
}

function SubScore({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? 'bg-emerald-500' : value >= 65 ? 'bg-yellow-400' : 'bg-red-500';
  return (
    <div className="flex items-center gap-1">
      <span className="text-[9px] text-gray-400 w-14 shrink-0 truncate">{label}</span>
      <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-1 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[9px] font-bold tabular-nums w-5 text-right">{value}</span>
    </div>
  );
}

function StoppDot({ status }: { status: TourStopp['status'] }) {
  if (status === 'abgeschlossen') return <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />;
  if (status === 'unterwegs')    return <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse inline-block" />;
  return <span className="w-3 h-3 rounded-full bg-gray-200 dark:bg-gray-600 inline-block" />;
}

export function DispatchPhase3482TourScoreVisualisierungMasterPro({
  locationId,
}: {
  locationId: string | null;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData>(MOCK);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/tour-score-visualisierung?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch {
      setData(MOCK);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 20 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const sorted = [...data.touren].sort((a, b) => b.score - a.score);

  return (
    <div className="border rounded-lg bg-white dark:bg-gray-900 shadow-sm mb-3">
      <button
        className="w-full flex items-center justify-between p-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2 font-semibold text-sm">
          <Trophy className="w-4 h-4 text-yellow-500" />
          Tour-Score & Visualisierung Master Pro
          {data.alert_count > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-bold">
              {data.alert_count} ⚠
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Flotte Ø {data.flotte_avg_score}</span>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          {/* Alert Banner */}
          {data.alert_count > 0 && (
            <div className="flex items-center gap-1.5 p-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              {data.alert_count} Tour{data.alert_count > 1 ? 'en' : ''} mit Score unter 65 — sofort unterstützen!
            </div>
          )}

          {sorted.map(tour => {
            const isExpanded = expanded === tour.tour_id;
            const progressPct = tour.stopps_gesamt > 0 ? Math.round((tour.stopps_fertig / tour.stopps_gesamt) * 100) : 0;
            return (
              <div
                key={tour.tour_id}
                className={`border rounded-lg overflow-hidden ${tour.alert_low ? 'border-red-300 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'}`}
              >
                {/* Tour Header */}
                <button
                  className="w-full flex items-center gap-2 p-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                  onClick={() => setExpanded(isExpanded ? null : tour.tour_id)}
                >
                  <ScoreRing score={tour.score} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-sm font-bold truncate">{tour.fahrer_name}</span>
                      {tour.alert_low && <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                    </div>
                    {/* Stopp Timeline Dots */}
                    <div className="flex items-center gap-0.5 mb-1">
                      {tour.stopps.map(s => (
                        <StoppDot key={s.stopp_nr} status={s.status} />
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                      <span>{tour.stopps_fertig}/{tour.stopps_gesamt} Stopps</span>
                      {tour.aktuelle_stopp_adresse && (
                        <>
                          <span>·</span>
                          <MapPin className="w-2.5 h-2.5" />
                          <span className="truncate max-w-[100px]">{tour.aktuelle_stopp_adresse}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                </button>

                {/* Sub-Scores & Stop Detail */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 border-t border-gray-100 dark:border-gray-700 space-y-2.5">
                    {/* Progress Bar */}
                    <div>
                      <div className="flex justify-between text-[9px] text-gray-400 mb-0.5">
                        <span>Fortschritt</span>
                        <span>{progressPct}%</span>
                      </div>
                      <div className="bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${progressPct}%` }} />
                      </div>
                    </div>

                    {/* Sub-Scores */}
                    <div className="space-y-1">
                      <SubScore label="Pünktlichkeit" value={tour.sub_puenktlichkeit} />
                      <SubScore label="Abschluss" value={tour.sub_abschluss} />
                      <SubScore label="Speed" value={tour.sub_speed} />
                    </div>

                    {/* Stop List */}
                    <div className="space-y-1">
                      <div className="text-[9px] text-gray-400 uppercase tracking-wide font-bold">Stopp-Timeline</div>
                      {tour.stopps.map(s => (
                        <div key={s.stopp_nr} className="flex items-center gap-2 text-[10px]">
                          <StoppDot status={s.status} />
                          <span className="flex-1 truncate text-gray-600 dark:text-gray-300">{s.stopp_nr}. {s.adresse}</span>
                          {s.eta_min !== null && (
                            <span className="flex items-center gap-0.5 text-blue-500 font-bold">
                              <Clock className="w-2.5 h-2.5" />
                              ~{s.eta_min} Min
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {sorted.length === 0 && (
            <div className="text-center text-xs text-gray-400 py-2">Keine aktiven Touren</div>
          )}
        </div>
      )}
    </div>
  );
}
