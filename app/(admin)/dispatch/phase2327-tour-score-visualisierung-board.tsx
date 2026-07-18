'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, MapPin, Star, Target, Trophy } from 'lucide-react';

type TourStop = {
  id: string;
  reihenfolge: number;
  adresse: string;
  status: 'pending' | 'active' | 'completed';
  eta_min: number | null;
};

type TourScore = {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  score_label: string;
  aktuelle_tour_id: string | null;
  tour_stops_gesamt: number;
  tour_stops_erledigt: number;
  stops: TourStop[];
  score_delta: number;
  rank: number;
};

type ApiData = {
  touren: TourScore[];
  team_avg_score: number;
};

function scoreColor(s: number): string {
  if (s >= 80) return 'text-green-700 dark:text-green-400';
  if (s >= 60) return 'text-yellow-700 dark:text-yellow-300';
  return 'text-red-600 dark:text-red-400';
}

function scoreBg(s: number): string {
  if (s >= 80) return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
  if (s >= 60) return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
  return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
}

function stopStatusColor(s: TourStop['status']): string {
  if (s === 'completed') return 'bg-green-500';
  if (s === 'active') return 'bg-blue-500 animate-pulse';
  return 'bg-gray-300 dark:bg-gray-600';
}

function scoreRing(score: number): string {
  const pct = Math.min(100, score);
  return `conic-gradient(${score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444'} ${pct}%, #e5e7eb ${pct}%)`;
}

function podium(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

export function DispatchPhase2327TourScoreVisualisierungBoard({
  locationId,
}: {
  locationId: string | null;
}) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(
        `/api/delivery/admin/tour-score-visualisierung?location_id=${locationId}`,
      );
      if (res.ok) setData(await res.json());
    } catch {
      // ignore — Mock-Daten bei fehlendem Endpunkt
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 25 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const touren: TourScore[] = useMemo(() => {
    if (data?.touren?.length) return data.touren;
    return [
      {
        fahrer_id: 'f1', fahrer_name: 'Max M.', score: 88, score_label: 'Sehr gut', score_delta: +3,
        aktuelle_tour_id: 't1', tour_stops_gesamt: 4, tour_stops_erledigt: 2, rank: 1,
        stops: [
          { id: 's1', reihenfolge: 1, adresse: 'Musterstr. 1', status: 'completed', eta_min: null },
          { id: 's2', reihenfolge: 2, adresse: 'Bahnhofstr. 7', status: 'completed', eta_min: null },
          { id: 's3', reihenfolge: 3, adresse: 'Hauptstr. 12', status: 'active', eta_min: 4 },
          { id: 's4', reihenfolge: 4, adresse: 'Parkweg 3', status: 'pending', eta_min: 12 },
        ],
      },
      {
        fahrer_id: 'f2', fahrer_name: 'Anna K.', score: 72, score_label: 'Gut', score_delta: -2,
        aktuelle_tour_id: 't2', tour_stops_gesamt: 3, tour_stops_erledigt: 1, rank: 2,
        stops: [
          { id: 's5', reihenfolge: 1, adresse: 'Lindenweg 5', status: 'completed', eta_min: null },
          { id: 's6', reihenfolge: 2, adresse: 'Rosenstr. 9', status: 'active', eta_min: 7 },
          { id: 's7', reihenfolge: 3, adresse: 'Gartenstr. 2', status: 'pending', eta_min: 18 },
        ],
      },
      {
        fahrer_id: 'f3', fahrer_name: 'Tom S.', score: 54, score_label: 'Verbesserungsbedarf', score_delta: -5,
        aktuelle_tour_id: 't3', tour_stops_gesamt: 2, tour_stops_erledigt: 0, rank: 3,
        stops: [
          { id: 's8', reihenfolge: 1, adresse: 'Kirchplatz 4', status: 'active', eta_min: 15 },
          { id: 's9', reihenfolge: 2, adresse: 'Bergstr. 11', status: 'pending', eta_min: 28 },
        ],
      },
    ];
  }, [data]);

  const teamAvg = data?.team_avg_score ?? Math.round(touren.reduce((a, t) => a + t.score, 0) / Math.max(1, touren.length));
  const alertCount = touren.filter((t) => t.score < 60).length;

  if (!locationId) return null;

  return (
    <div className={`rounded-xl border p-4 mb-3 ${alertCount > 0 ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30' : 'border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30'}`}>
      <button
        className="w-full flex items-center justify-between gap-2"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <span className="font-semibold text-indigo-800 dark:text-indigo-200 text-sm">
            Tour Score &amp; Visualisierung Board
          </span>
          <span className="inline-flex items-center rounded-full bg-indigo-100 dark:bg-indigo-900/40 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-300">
            Team-Ø {teamAvg} Pkt
          </span>
          {alertCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300">
              <AlertTriangle className="h-3 w-3" />
              {alertCount} niedrig
            </span>
          )}
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-indigo-500 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-indigo-500 shrink-0" />
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {touren.map((t) => (
            <div key={t.fahrer_id} className={`rounded-lg border ${scoreBg(t.score)} overflow-hidden`}>
              {/* Fahrer-Zeile */}
              <button
                className="w-full flex items-center gap-3 p-3 text-left"
                onClick={() => setExpanded(expanded === t.fahrer_id ? null : t.fahrer_id)}
              >
                {/* Score-Ring (mini) */}
                <div className="relative h-10 w-10 shrink-0 flex items-center justify-center">
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{ background: scoreRing(t.score) }}
                  />
                  <div className="absolute inset-1 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center">
                    <span className={`text-[10px] font-extrabold ${scoreColor(t.score)}`}>{t.score}</span>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{podium(t.rank)}</span>
                    <span className="font-bold text-sm text-gray-800 dark:text-gray-100">{t.fahrer_name}</span>
                    <span className={`text-[10px] font-semibold ${t.score_delta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                      {t.score_delta >= 0 ? '+' : ''}{t.score_delta}
                    </span>
                  </div>
                  {/* Tour-Fortschrittsbalken */}
                  <div className="mt-1 flex items-center gap-1.5">
                    <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-500 transition-all"
                        style={{ width: `${Math.round((t.tour_stops_erledigt / Math.max(1, t.tour_stops_gesamt)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 tabular-nums shrink-0">
                      {t.tour_stops_erledigt}/{t.tour_stops_gesamt} Stopps
                    </span>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-1 text-xs text-gray-400">
                  <Target className="h-3 w-3" />
                  <span>{t.score_label}</span>
                </div>
              </button>

              {/* Stopp-Visualisierung (expandiert) */}
              {expanded === t.fahrer_id && (
                <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-2.5 bg-white/60 dark:bg-gray-800/40">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Tour-Stopps
                  </div>
                  <div className="flex items-start gap-0">
                    {t.stops.map((s, idx) => (
                      <div key={s.id} className="flex flex-col items-center flex-1 min-w-0">
                        {/* Verbindungslinie */}
                        <div className="flex items-center w-full">
                          {idx > 0 && (
                            <div className={`h-0.5 flex-1 ${s.status === 'completed' ? 'bg-green-400' : 'bg-gray-300 dark:bg-gray-600'}`} />
                          )}
                          <div className={`h-4 w-4 rounded-full shrink-0 flex items-center justify-center text-white text-[9px] font-bold ${stopStatusColor(s.status)}`}>
                            {s.status === 'completed' ? '✓' : s.reihenfolge}
                          </div>
                          {idx < t.stops.length - 1 && (
                            <div className="h-0.5 flex-1 bg-gray-300 dark:bg-gray-600" />
                          )}
                        </div>
                        <div className="text-center mt-1 px-0.5">
                          <div className="text-[9px] text-gray-500 dark:text-gray-400 truncate max-w-[60px]">{s.adresse}</div>
                          {s.eta_min !== null && s.status !== 'completed' && (
                            <div className="text-[9px] font-bold text-blue-600 dark:text-blue-400">{s.eta_min} Min</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {touren.length === 0 && (
            <div className="text-center py-4 text-sm text-gray-400">
              <Star className="h-6 w-6 mx-auto mb-1 opacity-40" />
              Keine aktiven Touren
            </div>
          )}

          <p className="text-xs text-gray-400 dark:text-gray-500 text-right">
            Score: grün ≥80 · gelb 60–79 · rot &lt;60 · 25-Sek-Update
          </p>
        </div>
      )}
    </div>
  );
}
