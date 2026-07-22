'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Star, TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface FahrerScore {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  rang: number;
  puenktlichkeit: number;
  abschlussrate: number;
  bewertung: number;
  trend: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiData {
  fahrer: FahrerScore[];
  team_avg: number;
  bester_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   score: 92, rang: 1, puenktlichkeit: 95, abschlussrate: 98, bewertung: 4.9, trend:  2, ampel: 'gruen' },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', score: 78, rang: 2, puenktlichkeit: 80, abschlussrate: 90, bewertung: 4.5, trend:  0, ampel: 'gelb'  },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  score: 65, rang: 3, puenktlichkeit: 70, abschlussrate: 85, bewertung: 4.2, trend: -3, ampel: 'gelb'  },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   score: 48, rang: 4, puenktlichkeit: 55, abschlussrate: 72, bewertung: 3.8, trend: -5, ampel: 'rot'   },
  ],
  team_avg: 70.75,
  bester_name: 'Max M.',
  alert_count: 1,
  gesamt: 4,
};

function scoreCls(score: number) {
  if (score >= 80) return { ring: '#22c55e', text: 'text-green-600 dark:text-green-400', badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
  if (score >= 60) return { ring: '#f59e0b', text: 'text-amber-600 dark:text-amber-400', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' };
  return                  { ring: '#ef4444', text: 'text-red-600 dark:text-red-400',     badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
}

function ScoreRing({ score }: { score: number }) {
  const { ring } = scoreCls(score);
  const r = 20, cx = 24, cy = 24;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width={48} height={48} viewBox="0 0 48 48" className="shrink-0">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={5} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={ring} strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`} />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize={10} fontWeight="bold" fill={ring}>{score}</text>
    </svg>
  );
}

function TrendIcon({ t }: { t: number }) {
  if (t > 0) return <TrendingUp size={12} className="text-green-500" />;
  if (t < 0) return <TrendingDown size={12} className="text-red-400" />;
  return <Minus size={12} className="text-gray-400" />;
}

export function DispatchPhase3081TourScoreRankingLive({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-routen-score?location_id=${locationId ?? ''}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    if (locationId) load();
    else setData(MOCK);
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [locationId]);

  const list = data?.fahrer ?? [];
  const alerts = list.filter(f => f.score < 60);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Star size={16} className="text-yellow-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Tour-Score Ranking Live</span>
          {(data?.alert_count ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 dark:bg-red-900/40 rounded-full px-2 py-0.5">
              <AlertTriangle size={10} /> {data?.alert_count} Alert
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs text-center">
            <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 p-2">
              <div className="text-gray-500 dark:text-gray-400 font-medium">Team-Ø Score</div>
              <div className={`font-bold text-base ${scoreCls(data?.team_avg ?? 0).text}`}>{data?.team_avg?.toFixed(1) ?? '—'}</div>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
              <div className="text-gray-500 dark:text-gray-400 font-medium">Bester</div>
              <div className="font-bold text-sm text-gray-700 dark:text-gray-300">{data?.bester_name ?? '—'}</div>
            </div>
          </div>

          {alerts.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-400 text-xs font-semibold px-3 py-2">
              <AlertTriangle size={14} />
              {alerts.map(f => f.fahrer_name).join(', ')} — Score &lt; 60! Coachen!
            </div>
          )}

          <div className="space-y-2">
            {list.map(f => {
              const cls = scoreCls(f.score);
              return (
                <div key={f.fahrer_id} className={`rounded-lg border p-3 ${f.ampel === 'rot' ? 'border-red-200 bg-red-50 dark:border-red-700 dark:bg-red-900/20' : f.ampel === 'gelb' ? 'border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20' : 'border-green-200 bg-green-50 dark:border-green-700 dark:bg-green-900/20'}`}>
                  <div className="flex items-center gap-3">
                    <ScoreRing score={f.score} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-semibold text-sm ${cls.text}`}>{f.fahrer_name}</span>
                        <div className="flex items-center gap-1">
                          <TrendIcon t={f.trend} />
                          <span className="text-xs text-gray-500">{f.trend > 0 ? `+${f.trend}` : f.trend}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-xs">
                        <span className="text-gray-400">Pkt: <span className="font-semibold text-gray-700 dark:text-gray-300">{f.puenktlichkeit}%</span></span>
                        <span className="text-gray-400">Abs: <span className="font-semibold text-gray-700 dark:text-gray-300">{f.abschlussrate}%</span></span>
                        <span className="text-gray-400">Bew: <span className="font-semibold text-gray-700 dark:text-gray-300">{f.bewertung}★</span></span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
