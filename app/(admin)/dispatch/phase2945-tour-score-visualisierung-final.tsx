'use client';
import { useEffect, useRef, useState } from 'react';
import { Bike, RefreshCw, TrendingUp, TrendingDown, Minus, AlertTriangle, Trophy } from 'lucide-react';

/**
 * Phase 2945 — Tour-Score Visualisierung Final
 *
 * Score-Ring SVG (0–100) je aktiver Tour/Fahrer.
 * Farbkodierte Stop-Dots mit Statusanzeige.
 * Sub-Scores Pünktlichkeit/Abschlussrate/Bewertung.
 * Flotten-Ø + Alert Score <60. 20-Sek-Polling.
 */

interface StopDot {
  nr: number;
  done: boolean;
  late?: boolean;
}

interface TourEntry {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  score_puenktlichkeit: number;
  score_abschluss: number;
  score_bewertung: number;
  stopp_dots: StopDot[];
  eta_rueckkehr_min: number | null;
  trend: 'steigend' | 'fallend' | 'gleich';
}

interface ApiData {
  tours: TourEntry[];
  flotten_avg: number;
  letzte_aktualisierung: string;
}

const MOCK: ApiData = {
  flotten_avg: 74,
  letzte_aktualisierung: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
  tours: [
    {
      fahrer_id: 'f1', fahrer_name: 'Max K.', score: 88,
      score_puenktlichkeit: 90, score_abschluss: 100, score_bewertung: 80,
      stopp_dots: [{ nr: 1, done: true }, { nr: 2, done: true }, { nr: 3, done: false }, { nr: 4, done: false }],
      eta_rueckkehr_min: 22, trend: 'steigend',
    },
    {
      fahrer_id: 'f2', fahrer_name: 'Jana W.', score: 72,
      score_puenktlichkeit: 70, score_abschluss: 80, score_bewertung: 70,
      stopp_dots: [{ nr: 1, done: true }, { nr: 2, done: true, late: true }, { nr: 3, done: false }, { nr: 4, done: false }],
      eta_rueckkehr_min: 31, trend: 'gleich',
    },
    {
      fahrer_id: 'f3', fahrer_name: 'Ali S.', score: 54,
      score_puenktlichkeit: 50, score_abschluss: 60, score_bewertung: 55,
      stopp_dots: [{ nr: 1, done: true, late: true }, { nr: 2, done: false }, { nr: 3, done: false }],
      eta_rueckkehr_min: 45, trend: 'fallend',
    },
  ],
};

function ScoreRingSvg({ score }: { score: number }) {
  const r  = 22;
  const cx = 28;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <svg width="56" height="56" viewBox="0 0 56 56">
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="#e5e7eb" strokeWidth="5" />
      <circle
        cx={cx} cy={cx} r={r} fill="none"
        stroke={color} strokeWidth="5"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cx})`}
        className="transition-all duration-700"
      />
      <text x={cx} y={cx + 5} textAnchor="middle" fontSize="12" fontWeight="bold" fill={color}>
        {score}
      </text>
    </svg>
  );
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp  size={13} className="text-green-500" />;
  if (trend === 'fallend')  return <TrendingDown size={13} className="text-red-500"  />;
  return                           <Minus       size={13} className="text-gray-400" />;
}

const POLL = 20_000;

export function DispatchPhase2945TourScoreVisualisierungFinal({ locationId }: { locationId?: string | null }) {
  const [data, setData]     = useState<ApiData | null>(null);
  const [loading, setLoad]  = useState(false);
  const [expanded, setExp]  = useState<Record<string, boolean>>({});
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = () => {
    if (!locationId) { setData(MOCK); return; }
    setLoad(true);
    fetch(`/api/delivery/dispatch/tours?location_id=${locationId}`)
      .then(r => r.json())
      .then((d: ApiData) => setData(d))
      .catch(() => setData(MOCK))
      .finally(() => setLoad(false));
  };

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, POLL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data) return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center text-sm text-gray-400">
      <RefreshCw size={16} className="animate-spin mx-auto mb-2" />Touren werden geladen…
    </div>
  );

  const alerts = data.tours.filter(t => t.score < 60);
  const sorted = [...data.tours].sort((a, b) => b.score - a.score);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-900 overflow-hidden mb-4">
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-700 text-white">
        <div className="flex items-center gap-2">
          <Bike size={15} />
          <span className="font-semibold text-sm">Tour-Score Visualisierung</span>
          {loading && <RefreshCw size={11} className="animate-spin opacity-60" />}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Trophy size={12} className="opacity-80" />
          <span className="opacity-80">Flotten-Ø:</span>
          <span className={`font-bold ${data.flotten_avg >= 80 ? 'text-green-300' : data.flotten_avg >= 60 ? 'text-amber-300' : 'text-red-300'}`}>
            {data.flotten_avg} Pkt
          </span>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-950/20 border-b border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
          <AlertTriangle size={12} />
          <span><strong>{alerts.map(a => a.fahrer_name).join(', ')}</strong> — Score unter 60! Eingreifen erforderlich.</span>
        </div>
      )}

      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {sorted.map((t, idx) => {
          const isOpen = !!expanded[t.fahrer_id];
          const scoreColor = t.score >= 80 ? 'text-green-600' : t.score >= 60 ? 'text-amber-600' : 'text-red-600';
          return (
            <div key={t.fahrer_id}>
              <button
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
                onClick={() => setExp(e => ({ ...e, [t.fahrer_id]: !e[t.fahrer_id] }))}
              >
                <div className="shrink-0 text-xs text-gray-400 w-4 text-center">{idx + 1}</div>
                <ScoreRingSvg score={t.score} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">{t.fahrer_name}</span>
                    <TrendIcon trend={t.trend} />
                    {t.score < 60 && <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full">Alarm</span>}
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {t.stopp_dots.map(s => (
                      <div
                        key={s.nr}
                        title={`Stopp ${s.nr}`}
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${
                          s.done && s.late ? 'bg-amber-400' : s.done ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      >
                        {s.nr}
                      </div>
                    ))}
                    {t.eta_rueckkehr_min != null && (
                      <span className="text-xs text-blue-600 dark:text-blue-400 ml-1">
                        Rückkehr: {t.eta_rueckkehr_min} Min
                      </span>
                    )}
                  </div>
                </div>
                <span className={`text-lg font-extrabold ${scoreColor}`}>{t.score}</span>
              </button>

              {isOpen && (
                <div className="grid grid-cols-3 gap-2 px-4 pb-3">
                  {[
                    { label: 'Pünktlichkeit', val: t.score_puenktlichkeit },
                    { label: 'Abschlussrate', val: t.score_abschluss },
                    { label: 'Bewertung',     val: t.score_bewertung },
                  ].map(sub => {
                    const c = sub.val >= 80 ? 'text-green-600 dark:text-green-400' : sub.val >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';
                    return (
                      <div key={sub.label} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
                        <div className={`text-lg font-bold ${c}`}>{sub.val}</div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400">{sub.label}</div>
                        <div className="mt-1 h-1 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                          <div className={`h-full rounded-full ${sub.val >= 80 ? 'bg-green-500' : sub.val >= 60 ? 'bg-amber-400' : 'bg-red-500'}`} style={{ width: `${sub.val}%` }} />
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

      <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400 text-right">
        {data.letzte_aktualisierung}
      </div>
    </div>
  );
}
