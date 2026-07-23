'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, TrendingUp, TrendingDown, Minus, Star, Route, Clock, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Stopp {
  reihenfolge: number;
  status: 'offen' | 'unterwegs' | 'geliefert' | 'fehlgeschlagen';
  eta_min: number | null;
}

interface FahrerScore {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  rang: number;
  rang_delta: number;
  touren_heute: number;
  avg_lieferzeit_min: number | null;
  puenktlichkeit_pct: number | null;
  bewertung: number | null;
  aktiv: boolean;
  stopps: Stopp[];
}

interface ApiResponse {
  fahrer: FahrerScore[];
  team_avg_score: number;
  top_performer: string | null;
  alert_niedrig: string[];
}

const MOCK: ApiResponse = {
  fahrer: [
    {
      fahrer_id: '1', fahrer_name: 'Leon S.', score: 96, rang: 1, rang_delta: 1,
      touren_heute: 8, avg_lieferzeit_min: 21, puenktlichkeit_pct: 97, bewertung: 4.9, aktiv: true,
      stopps: [
        { reihenfolge: 1, status: 'geliefert', eta_min: null },
        { reihenfolge: 2, status: 'geliefert', eta_min: null },
        { reihenfolge: 3, status: 'unterwegs', eta_min: 4 },
        { reihenfolge: 4, status: 'offen', eta_min: 14 },
      ],
    },
    {
      fahrer_id: '2', fahrer_name: 'Kai M.', score: 87, rang: 2, rang_delta: 0,
      touren_heute: 6, avg_lieferzeit_min: 26, puenktlichkeit_pct: 88, bewertung: 4.7, aktiv: true,
      stopps: [
        { reihenfolge: 1, status: 'geliefert', eta_min: null },
        { reihenfolge: 2, status: 'unterwegs', eta_min: 7 },
        { reihenfolge: 3, status: 'offen', eta_min: 18 },
      ],
    },
    {
      fahrer_id: '3', fahrer_name: 'Ria W.', score: 74, rang: 3, rang_delta: -1,
      touren_heute: 5, avg_lieferzeit_min: 30, puenktlichkeit_pct: 76, bewertung: 4.5, aktiv: false,
      stopps: [],
    },
    {
      fahrer_id: '4', fahrer_name: 'Tom B.', score: 61, rang: 4, rang_delta: 0,
      touren_heute: 4, avg_lieferzeit_min: 35, puenktlichkeit_pct: 63, bewertung: 4.3, aktiv: true,
      stopps: [
        { reihenfolge: 1, status: 'unterwegs', eta_min: 12 },
        { reihenfolge: 2, status: 'offen', eta_min: 24 },
      ],
    },
  ],
  team_avg_score: 80,
  top_performer: 'Leon S.',
  alert_niedrig: ['Tom B.'],
};

function scoreColor(s: number) {
  if (s >= 90) return { text: 'text-green-700', bar: 'bg-green-500', bg: 'bg-green-50', border: 'border-green-200' };
  if (s >= 75) return { text: 'text-amber-700', bar: 'bg-amber-400', bg: 'bg-amber-50', border: 'border-amber-200' };
  return { text: 'text-red-700', bar: 'bg-red-500', bg: 'bg-red-50', border: 'border-red-200' };
}

function stoppDot(status: Stopp['status']) {
  if (status === 'geliefert') return 'bg-green-500';
  if (status === 'unterwegs') return 'bg-blue-500 animate-pulse';
  if (status === 'fehlgeschlagen') return 'bg-red-500';
  return 'bg-gray-300';
}

const RANK_ICON = ['🥇', '🥈', '🥉'];

export function DispatchPhase3562TourScoreVisualisierungUltra({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/dispatch-tour-score-ultra?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        if (d?.fahrer?.length) setData(d);
      }
    } catch {}
  }, [locationId]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 20_000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const maxScore = 100;

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-indigo-600" />
          <span className="text-sm font-semibold text-indigo-800">Tour-Score & Visualisierung Ultra</span>
        </div>
        <div className="text-xs text-indigo-600 font-medium">Team-Ø {data.team_avg_score}</div>
      </div>

      {/* Alert: Niedrige Scores */}
      {data.alert_niedrig.length > 0 && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
          ⚠️ Niedriger Score: {data.alert_niedrig.join(', ')}
        </div>
      )}

      {/* Fahrer-Liste */}
      <div className="space-y-2">
        {data.fahrer.map(f => {
          const c = scoreColor(f.score);
          const pct = (f.score / maxScore) * 100;
          const delta = f.rang_delta;
          const isExpanded = expanded === f.fahrer_id;

          return (
            <div key={f.fahrer_id} className={cn('rounded-lg border p-2.5 cursor-pointer', c.bg, c.border)} onClick={() => setExpanded(isExpanded ? null : f.fahrer_id)}>
              <div className="flex items-center gap-2 mb-1.5">
                {/* Rang */}
                <span className="text-base">{RANK_ICON[f.rang - 1] ?? `#${f.rang}`}</span>
                {/* Name + Status */}
                <span className="text-xs font-semibold flex-1">{f.fahrer_name}</span>
                {!f.aktiv && <span className="text-xs text-gray-400">offline</span>}
                {/* Score */}
                <span className={cn('text-sm font-bold tabular-nums', c.text)}>{f.score}</span>
                {/* Delta */}
                {delta > 0 && <TrendingUp className="h-3.5 w-3.5 text-green-500" />}
                {delta < 0 && <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
                {delta === 0 && <Minus className="h-3.5 w-3.5 text-gray-400" />}
              </div>

              {/* Score-Balken */}
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full transition-all', c.bar)} style={{ width: `${pct}%` }} />
              </div>

              {/* Stopp-Dots */}
              {f.stopps.length > 0 && (
                <div className="flex items-center gap-1 mt-2">
                  {f.stopps.map(s => (
                    <div key={s.reihenfolge} className={cn('h-2 w-2 rounded-full', stoppDot(s.status))} title={`Stopp ${s.reihenfolge}: ${s.status}`} />
                  ))}
                  <span className="text-xs text-gray-400 ml-1">{f.stopps.filter(s => s.status === 'geliefert').length}/{f.stopps.length} geliefert</span>
                </div>
              )}

              {/* Expanded: Sub-KPIs */}
              {isExpanded && (
                <div className="mt-2 pt-2 border-t border-gray-200 grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Pünktlichkeit</p>
                    <p className="text-sm font-bold">{f.puenktlichkeit_pct ?? '–'}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Ø Lieferzeit</p>
                    <p className="text-sm font-bold">{f.avg_lieferzeit_min ?? '–'} min</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Bewertung</p>
                    <p className="text-sm font-bold">{f.bewertung ? `${f.bewertung} ★` : '–'}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {data.top_performer && (
        <div className="flex items-center gap-1.5 text-xs text-indigo-600 pt-1 border-t border-indigo-200">
          <Star className="h-3.5 w-3.5 text-amber-500" />
          <span>Top-Performer: <strong>{data.top_performer}</strong></span>
        </div>
      )}
    </div>
  );
}
