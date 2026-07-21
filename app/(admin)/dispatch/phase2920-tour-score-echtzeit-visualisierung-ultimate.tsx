'use client';
import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle, RefreshCw, TrendingUp, TrendingDown, Minus, Trophy, Target,
} from 'lucide-react';

/**
 * Phase 2920 — Tour-Score Echtzeit-Visualisierung Ultimate
 *
 * Umfassendes Score-Board: Score-Ring (SVG) je Fahrer 0–100 +
 * Sub-Scores Pünktlichkeit/Abschlussrate/Wartezeit/Bewertung +
 * Fortschrittsbalken je Dimension + Team-Ø + Alert <60.
 * 20-Sek-Polling.
 */

interface SubScore {
  label: string;
  value: number;
  ziel: number;
  gewicht: number;
}

interface FahrerScore {
  fahrer_id: string;
  name: string;
  score: number;
  sub_scores: SubScore[];
  trend: 'steigend' | 'fallend' | 'gleich';
  rang: number;
  aktive_tour: boolean;
}

interface ApiData {
  fahrer: FahrerScore[];
  team_avg: number;
  alerts: string[];
  letzte_aktualisierung: string;
}

const MOCK: ApiData = {
  fahrer: [
    {
      fahrer_id: '1', name: 'Mehmet K.', score: 89, rang: 1, trend: 'steigend', aktive_tour: true,
      sub_scores: [
        { label: 'Pünktlichkeit',  value: 92, ziel: 90, gewicht: 30 },
        { label: 'Abschlussrate',  value: 96, ziel: 95, gewicht: 30 },
        { label: 'Wartezeit',      value: 85, ziel: 80, gewicht: 20 },
        { label: 'Kundenbewertung',value: 88, ziel: 85, gewicht: 20 },
      ],
    },
    {
      fahrer_id: '2', name: 'Jonas W.', score: 76, rang: 2, trend: 'gleich', aktive_tour: true,
      sub_scores: [
        { label: 'Pünktlichkeit',  value: 78, ziel: 90, gewicht: 30 },
        { label: 'Abschlussrate',  value: 94, ziel: 95, gewicht: 30 },
        { label: 'Wartezeit',      value: 72, ziel: 80, gewicht: 20 },
        { label: 'Kundenbewertung',value: 82, ziel: 85, gewicht: 20 },
      ],
    },
    {
      fahrer_id: '3', name: 'Ali R.', score: 62, rang: 3, trend: 'fallend', aktive_tour: true,
      sub_scores: [
        { label: 'Pünktlichkeit',  value: 65, ziel: 90, gewicht: 30 },
        { label: 'Abschlussrate',  value: 88, ziel: 95, gewicht: 30 },
        { label: 'Wartezeit',      value: 58, ziel: 80, gewicht: 20 },
        { label: 'Kundenbewertung',value: 75, ziel: 85, gewicht: 20 },
      ],
    },
    {
      fahrer_id: '4', name: 'Tom B.', score: 55, rang: 4, trend: 'fallend', aktive_tour: false,
      sub_scores: [
        { label: 'Pünktlichkeit',  value: 53, ziel: 90, gewicht: 30 },
        { label: 'Abschlussrate',  value: 82, ziel: 95, gewicht: 30 },
        { label: 'Wartezeit',      value: 50, ziel: 80, gewicht: 20 },
        { label: 'Kundenbewertung',value: 68, ziel: 85, gewicht: 20 },
      ],
    },
  ],
  team_avg: 70.5,
  alerts: ['Tom B.: Score unter 60 — Coaching empfohlen'],
  letzte_aktualisierung: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
};

function scoreColor(s: number): string {
  if (s >= 80) return '#22c55e';
  if (s >= 65) return '#f59e0b';
  return '#ef4444';
}

function scoreBg(s: number): string {
  if (s >= 80) return 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800';
  if (s >= 65) return 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-700';
  return 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-700';
}

function TrendIcon({ t }: { t: string }) {
  if (t === 'steigend') return <TrendingUp size={11} className="text-green-600" />;
  if (t === 'fallend')  return <TrendingDown size={11} className="text-red-500" />;
  return <Minus size={11} className="text-gray-400" />;
}

function ScoreRing({ score }: { score: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  const col = scoreColor(score);
  return (
    <svg width="52" height="52" className="shrink-0">
      <circle cx="26" cy="26" r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
      <circle
        cx="26" cy="26" r={r} fill="none" stroke={col} strokeWidth="4"
        strokeDasharray={`${dash} ${c - dash}`}
        strokeLinecap="round"
        transform="rotate(-90 26 26)"
      />
      <text x="26" y="30" textAnchor="middle" fontSize="10" fontWeight="700" fill={col}>{score}</text>
    </svg>
  );
}

const POLL_MS = 20_000;

export function DispatchPhase2920TourScoreEchtzeitVisualisierungUltimate({ locationId }: { locationId?: string | null }) {
  const [data,    setData]    = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = () => {
    if (!locationId) { setData(MOCK); return; }
    setLoading(true);
    fetch(`/api/delivery/dispatch/tour-score-echtzeit?location_id=${locationId}`)
      .then(r => r.json())
      .then((d: ApiData) => setData(d))
      .catch(() => setData(MOCK))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, POLL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data) return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center text-sm text-gray-400">
      <RefreshCw size={18} className="animate-spin mx-auto mb-2" />Tour-Score wird geladen…
    </div>
  );

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900 overflow-hidden mb-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
        <div className="flex items-center gap-2">
          <Trophy size={15} />
          <span className="font-semibold text-sm">Tour-Score Echtzeit</span>
          {loading && <RefreshCw size={11} className="animate-spin opacity-70" />}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="opacity-75">Team-Ø: <strong>{data.team_avg.toFixed(0)}</strong></span>
          <span className="opacity-60">Stand: {data.letzte_aktualisierung}</span>
        </div>
      </div>

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-950/20 border-b border-red-200 dark:border-red-800 space-y-1">
          {data.alerts.map((a, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-400">
              <AlertCircle size={12} />
              {a}
            </div>
          ))}
        </div>
      )}

      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {data.fahrer.map(f => (
          <div key={f.fahrer_id}>
            {/* Row */}
            <button
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
              onClick={() => setOpen(o => o === f.fahrer_id ? null : f.fahrer_id)}
            >
              <ScoreRing score={f.score} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400">#{f.rang}</span>
                  <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">{f.name}</span>
                  {f.aktive_tour && (
                    <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full">
                      aktiv
                    </span>
                  )}
                </div>
                {/* Mini sub-score bars */}
                <div className="flex gap-1 mt-1.5">
                  {f.sub_scores.map(s => (
                    <div key={s.label} className="flex-1 h-1 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, s.value)}%`, backgroundColor: scoreColor(s.value) }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <TrendIcon t={f.trend} />
                <span className="text-gray-400 text-xs">{open === f.fahrer_id ? '▲' : '▼'}</span>
              </div>
            </button>

            {/* Expanded sub-scores */}
            {open === f.fahrer_id && (
              <div className={`mx-4 mb-3 rounded-lg border p-3 ${scoreBg(f.score)}`}>
                <div className="grid grid-cols-2 gap-2">
                  {f.sub_scores.map(s => (
                    <div key={s.label}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-gray-600 dark:text-gray-400">{s.label}</span>
                        <span style={{ color: scoreColor(s.value) }} className="font-bold">{s.value}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${Math.min(100, s.value)}%`, backgroundColor: scoreColor(s.value) }}
                        />
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">Ziel: {s.ziel}%</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
