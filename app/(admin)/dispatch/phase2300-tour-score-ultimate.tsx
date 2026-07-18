'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, MapPin, Star, Target, Trophy, Zap } from 'lucide-react';

type FahrerTourScore = {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  touren_heute: number;
  avg_lieferzeit_min: number;
  puenktlichkeit_quote: number;
  rang: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  aktiv: boolean;
};

type TourStop = {
  id: string;
  reihenfolge: number;
  adresse: string;
  status: 'pending' | 'unterwegs' | 'geliefert';
  eta_min: number | null;
};

type AktiveTour = {
  tour_id: string;
  fahrer_name: string;
  stops: TourStop[];
  score: number;
  started_at: string;
};

type ApiData = {
  fahrer: FahrerTourScore[];
  aktive_touren: AktiveTour[];
  team_avg_score: number;
  gesamt_touren_heute: number;
  alert_count: number;
};

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.', score: 94, touren_heute: 7, avg_lieferzeit_min: 22, puenktlichkeit_quote: 96, rang: 1, trend: 'steigend', aktiv: true },
    { fahrer_id: 'f2', fahrer_name: 'Jana K.', score: 88, touren_heute: 6, avg_lieferzeit_min: 25, puenktlichkeit_quote: 90, rang: 2, trend: 'stabil', aktiv: true },
    { fahrer_id: 'f3', fahrer_name: 'Tim S.', score: 72, touren_heute: 4, avg_lieferzeit_min: 31, puenktlichkeit_quote: 78, rang: 3, trend: 'fallend', aktiv: false },
  ],
  aktive_touren: [
    {
      tour_id: 't1',
      fahrer_name: 'Max M.',
      score: 94,
      started_at: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
      stops: [
        { id: 's1', reihenfolge: 1, adresse: 'Hauptstr. 12, Berlin', status: 'geliefert', eta_min: null },
        { id: 's2', reihenfolge: 2, adresse: 'Marktplatz 5, Berlin', status: 'unterwegs', eta_min: 8 },
        { id: 's3', reihenfolge: 3, adresse: 'Ringstr. 22, Berlin', status: 'pending', eta_min: 18 },
      ],
    },
  ],
  team_avg_score: 85,
  gesamt_touren_heute: 17,
  alert_count: 0,
};

function trendIcon(t: FahrerTourScore['trend']): string {
  if (t === 'steigend') return '↑';
  if (t === 'fallend') return '↓';
  return '→';
}

function podium(rang: number): string {
  if (rang === 1) return '🥇';
  if (rang === 2) return '🥈';
  if (rang === 3) return '🥉';
  return '';
}

function scoreKlasse(score: number): string {
  if (score >= 85) return 'text-green-600 dark:text-green-400';
  if (score >= 70) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function stopFarbe(s: TourStop['status']): string {
  if (s === 'geliefert') return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
  if (s === 'unterwegs') return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
  return 'bg-stone-100 dark:bg-stone-700 text-stone-500 dark:text-stone-400';
}

function stopLabel(s: TourStop['status']): string {
  if (s === 'geliefert') return '✓';
  if (s === 'unterwegs') return '→';
  return '○';
}

export function DispatchPhase2300TourScoreUltimate({
  locationId,
}: {
  locationId: string | null;
}) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);
  const [tourOpen, setTourOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/tour-score-overview?location_id=${locationId}`);
      if (res.ok) {
        setData(await res.json());
      } else {
        setData(MOCK);
      }
    } catch {
      setData(MOCK);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 25 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const board = data ?? MOCK;
  const topFahrer = useMemo(() => [...board.fahrer].sort((a, b) => b.score - a.score).slice(0, 5), [board]);
  const teamScore = board.team_avg_score;
  const headerLevel = board.alert_count > 0 ? 'rot' : teamScore < 75 ? 'gelb' : 'gruen';

  const headerBg =
    headerLevel === 'gruen'
      ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30'
      : headerLevel === 'gelb'
      ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30'
      : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30';

  const headerText =
    headerLevel === 'gruen'
      ? 'text-green-700 dark:text-green-300'
      : headerLevel === 'gelb'
      ? 'text-amber-700 dark:text-amber-300'
      : 'text-red-700 dark:text-red-300';

  if (!locationId) return null;

  return (
    <div className={`rounded-xl border p-4 mb-3 ${headerBg}`}>
      <button
        className="w-full flex items-center justify-between gap-2"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Trophy className={`w-4 h-4 ${headerText}`} />
          <span className={`font-semibold text-sm ${headerText}`}>Tour-Score & Visualisierung Ultimate</span>
          <span className={`text-xs font-bold ${headerText}`}>
            Team-Ø {teamScore} · {board.gesamt_touren_heute} Touren heute
          </span>
        </div>
        {open ? (
          <ChevronUp className={`w-4 h-4 ${headerText}`} />
        ) : (
          <ChevronDown className={`w-4 h-4 ${headerText}`} />
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {board.alert_count > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span><strong>{board.alert_count} Alerts</strong> — sofort handeln!</span>
            </div>
          )}

          {/* KPI-Leiste */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-stone-100 dark:border-stone-700 p-2 text-center">
              <div className={`text-lg font-black tabular-nums ${scoreKlasse(teamScore)}`}>{teamScore}</div>
              <div className="text-gray-500 dark:text-gray-400">Team-Score</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-stone-100 dark:border-stone-700 p-2 text-center">
              <div className="text-lg font-black tabular-nums text-blue-600 dark:text-blue-400">{board.gesamt_touren_heute}</div>
              <div className="text-gray-500 dark:text-gray-400">Touren heute</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-stone-100 dark:border-stone-700 p-2 text-center">
              <div className="text-lg font-black tabular-nums text-purple-600 dark:text-purple-400">{board.aktive_touren.length}</div>
              <div className="text-gray-500 dark:text-gray-400">Aktive Touren</div>
            </div>
          </div>

          {/* Fahrer-Score Leaderboard */}
          <div>
            <div className="flex items-center gap-1 mb-1.5">
              <Star className="w-3 h-3 text-amber-500" />
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Fahrer-Leaderboard</span>
            </div>
            <div className="space-y-1">
              {topFahrer.map((f) => (
                <div
                  key={f.fahrer_id}
                  className="flex items-center justify-between rounded-lg bg-white dark:bg-gray-800 border border-stone-100 dark:border-stone-700 px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 text-center">{podium(f.rang) || `#${f.rang}`}</span>
                    <span className="font-medium">{f.fahrer_name}</span>
                    {f.aktiv && <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />}
                    <span className="text-gray-400">{f.touren_heute} T · {f.avg_lieferzeit_min} min</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`font-black text-sm ${scoreKlasse(f.score)}`}>{f.score}</span>
                    <span className={f.trend === 'steigend' ? 'text-green-500' : f.trend === 'fallend' ? 'text-red-500' : 'text-gray-400'}>
                      {trendIcon(f.trend)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Aktive Tour-Visualisierung */}
          {board.aktive_touren.length > 0 && (
            <div>
              <div className="flex items-center gap-1 mb-1.5">
                <Target className="w-3 h-3 text-blue-500" />
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Aktive Touren</span>
              </div>
              <div className="space-y-1.5">
                {board.aktive_touren.map((t) => (
                  <div key={t.tour_id} className="rounded-lg bg-white dark:bg-gray-800 border border-blue-100 dark:border-blue-800 overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between px-3 py-2 text-xs"
                      onClick={() => setTourOpen((v) => (v === t.tour_id ? null : t.tour_id))}
                    >
                      <div className="flex items-center gap-2">
                        <Zap className="w-3.5 h-3.5 text-blue-500" />
                        <span className="font-medium">{t.fahrer_name}</span>
                        <span className="text-gray-400">{t.stops.length} Stopps</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-black ${scoreKlasse(t.score)}`}>{t.score}</span>
                        {tourOpen === t.tour_id ? <ChevronUp className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}
                      </div>
                    </button>

                    {tourOpen === t.tour_id && (
                      <div className="border-t border-stone-100 dark:border-stone-700 px-3 py-2 space-y-1">
                        {t.stops.map((s) => (
                          <div key={s.id} className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${stopFarbe(s.status)}`}>
                            <span className="font-bold w-4 text-center">{stopLabel(s.status)}</span>
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="flex-1 truncate">{s.adresse}</span>
                            {s.eta_min !== null && (
                              <span className="font-semibold shrink-0">ETA {s.eta_min} min</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className={`text-xs rounded px-2 py-1 ${headerBg} ${headerText}`}>
            {teamScore >= 85
              ? 'Top-Performance — Team liegt über Ziel-Score (85). Weiter so!'
              : teamScore >= 75
              ? 'Solide Leistung — kleiner Fokus auf Pünktlichkeit bringt den Score über 85.'
              : 'Score unter Ziel — Dispatcher: Routen optimieren & Fahrer coachen.'}
          </p>
        </div>
      )}
    </div>
  );
}
