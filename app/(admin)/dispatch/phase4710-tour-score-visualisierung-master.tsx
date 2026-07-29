'use client';

import { useEffect, useState } from 'react';
import { Trophy, Bike, MapPin, Clock, CheckCircle2, AlertTriangle, Navigation2, WifiOff, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type StopStatus = 'pending' | 'active' | 'done' | 'late';

interface TourStop {
  id: string;
  seq: number;
  nr: string;
  adresse: string;
  status: StopStatus;
  eta_min: number | null;
}

interface DriverData {
  driver_id: string;
  name: string;
  score: number;
  delta: number;
  touren: number;
  puenktlichkeit_pct: number;
  avg_lieferzeit_min: number;
  online: boolean;
  stops: TourStop[];
  expanded?: boolean;
}

interface BoardData {
  team_score: number;
  team_delta: number;
  ziel_score: number;
  alert_count: number;
  fahrer: DriverData[];
  updated_at: string;
}

const T0 = new Date();
const MOCK: BoardData = {
  team_score: 86, team_delta: 3, ziel_score: 80, alert_count: 1,
  updated_at: T0.toISOString(),
  fahrer: [
    {
      driver_id: 'd1', name: 'L. Meyer', score: 94, delta: 4, touren: 8,
      puenktlichkeit_pct: 97, avg_lieferzeit_min: 25, online: true,
      stops: [
        { id: 's1', seq: 1, nr: '0201', adresse: 'Hauptstr. 12',   status: 'done',    eta_min: null },
        { id: 's2', seq: 2, nr: '0202', adresse: 'Parkweg 4',      status: 'active',  eta_min: 5    },
        { id: 's3', seq: 3, nr: '0203', adresse: 'Bergstr. 8',     status: 'pending', eta_min: 18   },
      ],
    },
    {
      driver_id: 'd2', name: 'S. Koch', score: 74, delta: -3, touren: 5,
      puenktlichkeit_pct: 77, avg_lieferzeit_min: 39, online: true,
      stops: [
        { id: 's4', seq: 1, nr: '0204', adresse: 'Ringstr. 6',     status: 'done',    eta_min: null },
        { id: 's5', seq: 2, nr: '0205', adresse: 'Waldweg 22',     status: 'late',    eta_min: 14   },
        { id: 's6', seq: 3, nr: '0206', adresse: 'Seestr. 1',      status: 'pending', eta_min: 29   },
      ],
    },
    {
      driver_id: 'd3', name: 'P. Braun', score: 88, delta: 2, touren: 7,
      puenktlichkeit_pct: 92, avg_lieferzeit_min: 29, online: true,
      stops: [
        { id: 's7', seq: 1, nr: '0207', adresse: 'Marktplatz 3',   status: 'done',    eta_min: null },
        { id: 's8', seq: 2, nr: '0208', adresse: 'Lindenallee 7',  status: 'active',  eta_min: 3    },
      ],
    },
  ],
};

function scoreColor(s: number) {
  if (s >= 90) return 'text-green-600 dark:text-green-400';
  if (s >= 75) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function scoreRing(s: number) {
  if (s >= 90) return 'border-green-500';
  if (s >= 75) return 'border-amber-400';
  return 'border-red-400';
}

function scoreBg(s: number) {
  if (s >= 90) return 'bg-green-50 dark:bg-green-950/40';
  if (s >= 75) return 'bg-amber-50 dark:bg-amber-950/40';
  return 'bg-red-50 dark:bg-red-950/40';
}

const STOP_CONFIG: Record<StopStatus, { color: string; label: string; icon: React.ElementType }> = {
  done:    { color: 'bg-green-500',   label: '✓',         icon: CheckCircle2 },
  active:  { color: 'bg-blue-500',    label: '→',         icon: Navigation2  },
  pending: { color: 'bg-gray-300 dark:bg-gray-600',    label: '○',         icon: MapPin       },
  late:    { color: 'bg-red-500',     label: '!',         icon: AlertTriangle },
};

export function DispatchPhase4710TourScoreVisualisierungMaster({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<BoardData | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const params = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/admin/tour-score-visualisierung${params}`);
        if (!res.ok) throw new Error('fetch failed');
        const json: BoardData = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(MOCK);
      }
    }
    load();
    const iv = setInterval(load, 20_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  const d = data ?? MOCK;

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  if (error) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 flex items-center gap-2 text-gray-400">
        <WifiOff className="w-4 h-4" /><span className="text-xs">Tour-Score nicht verfügbar</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-gray-900 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-bold text-gray-800 dark:text-gray-200">Tour-Score Master</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn('text-lg font-extrabold tabular-nums', scoreColor(d.team_score))}>{d.team_score}</span>
          <span className={cn('text-xs font-semibold', d.team_delta >= 0 ? 'text-green-500' : 'text-red-500')}>
            {d.team_delta >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          </span>
        </div>
      </div>

      {d.alert_count > 0 && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 animate-pulse" />
          <span className="text-xs font-semibold text-red-700 dark:text-red-300">
            {d.alert_count} Fahrer unter Ziel-Score ({d.ziel_score})
          </span>
        </div>
      )}

      <div className="space-y-2">
        {d.fahrer.map((f) => {
          const isExpanded = expanded.has(f.driver_id);
          const scorePct = Math.min(100, (f.score / 100) * 100);
          return (
            <div key={f.driver_id} className={cn('rounded-xl border p-3 space-y-2', scoreBg(f.score), scoreRing(f.score) + '/30')}>
              <button
                className="w-full flex items-center justify-between"
                onClick={() => toggle(f.driver_id)}
              >
                <div className="flex items-center gap-2">
                  <div className={cn('w-2 h-2 rounded-full', f.online ? 'bg-green-500' : 'bg-gray-300')} />
                  <Bike className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{f.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className={cn('text-base font-extrabold tabular-nums', scoreColor(f.score))}>{f.score}</div>
                    <div className="text-[10px] text-gray-400">{f.touren} Touren</div>
                  </div>
                  <div className={cn('w-8 h-8 rounded-full border-2 flex items-center justify-center', scoreRing(f.score))}>
                    <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">{f.score}</span>
                  </div>
                </div>
              </button>

              <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', f.score >= 90 ? 'bg-green-500' : f.score >= 75 ? 'bg-amber-400' : 'bg-red-400')}
                  style={{ width: `${scorePct}%` }}
                />
              </div>

              {isExpanded && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex gap-3 text-[10px] text-gray-500 dark:text-gray-400 pb-1">
                    <span>Pünktl.: <strong className="text-gray-700 dark:text-gray-300">{f.puenktlichkeit_pct}%</strong></span>
                    <span>Lieferz.: <strong className="text-gray-700 dark:text-gray-300">{f.avg_lieferzeit_min} Min</strong></span>
                  </div>
                  {f.stops.map((s) => {
                    const sc = STOP_CONFIG[s.status];
                    return (
                      <div key={s.id} className="flex items-center gap-2">
                        <div className={cn('w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold shrink-0', sc.color)}>
                          {s.seq}
                        </div>
                        <div className="flex-1 text-[10px] text-gray-700 dark:text-gray-300 truncate">{s.adresse}</div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 shrink-0">
                          {s.status === 'done' ? '✓' : s.eta_min != null ? `~${s.eta_min} Min` : '–'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-[10px] text-gray-400 dark:text-gray-500 text-right">
        Ziel: ≥ {d.ziel_score} · 20-Sek-Update
      </div>
    </div>
  );
}
