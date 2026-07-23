'use client';
import { useEffect, useState } from 'react';
import { Target, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

interface SubScores {
  puenktlichkeit: number;
  abschlussrate: number;
  speed: number;
}

interface Stopp {
  id: string;
  status: 'delivered' | 'current' | 'pending';
  label: string;
}

interface TourDriver {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  sub_scores: SubScores;
  stopps: Stopp[];
}

interface ApiData {
  tours: TourDriver[];
  fleet_avg_score: number;
}

const MOCK: ApiData = {
  fleet_avg_score: 74,
  tours: [
    {
      fahrer_id: 'd1',
      fahrer_name: 'Max M.',
      score: 88,
      sub_scores: { puenktlichkeit: 90, abschlussrate: 95, speed: 80 },
      stopps: [
        { id: 's1', status: 'delivered', label: '#101' },
        { id: 's2', status: 'delivered', label: '#102' },
        { id: 's3', status: 'current',   label: '#103' },
        { id: 's4', status: 'pending',   label: '#104' },
        { id: 's5', status: 'pending',   label: '#105' },
      ],
    },
    {
      fahrer_id: 'd2',
      fahrer_name: 'Tim B.',
      score: 58,
      sub_scores: { puenktlichkeit: 50, abschlussrate: 70, speed: 55 },
      stopps: [
        { id: 's6', status: 'delivered', label: '#201' },
        { id: 's7', status: 'current',   label: '#202' },
        { id: 's8', status: 'pending',   label: '#203' },
      ],
    },
  ],
};

function ScoreRing({ score }: { score: number }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444';
  return (
    <svg width={56} height={56} viewBox="0 0 56 56" className="flex-shrink-0">
      <circle cx={28} cy={28} r={r} fill="none" stroke="#e5e7eb" strokeWidth={5} />
      <circle
        cx={28} cy={28} r={r} fill="none"
        stroke={color} strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 28 28)"
      />
      <text x={28} y={33} textAnchor="middle" fontSize={13} fontWeight="bold" fill={color}>{score}</text>
    </svg>
  );
}

function StoppDot({ status }: { status: Stopp['status'] }) {
  const cls =
    status === 'delivered' ? 'bg-green-500' :
    status === 'current'   ? 'bg-blue-500 ring-2 ring-blue-300' :
    'bg-gray-300 dark:bg-gray-600';
  return <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${cls}`} />;
}

function SubScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? 'bg-green-500' : value >= 60 ? 'bg-yellow-400' : 'bg-red-500';
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="w-24 text-gray-500 dark:text-gray-400 truncate">{label}</span>
      <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="w-6 text-right tabular-nums text-gray-700 dark:text-gray-300 font-medium">{value}</span>
    </div>
  );
}

export function DispatchPhase3400TourScoreFinalCockpitUltra({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!locationId) { setData(MOCK); return; }
      try {
        const res = await fetch(`/api/delivery/admin/tour-score-live?location_id=${locationId}`);
        if (res.ok && active) setData(await res.json());
      } catch {
        if (active) setData(MOCK);
      }
    };
    load();
    const iv = setInterval(load, 20 * 1000);
    return () => { active = false; clearInterval(iv); };
  }, [locationId]);

  const d = data ?? MOCK;
  const criticalTours = d.tours.filter(t => t.score < 65);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Target size={16} className="text-emerald-600" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">
            Tour-Score Final Ultra Cockpit
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
            Flotten-Ø {d.fleet_avg_score}
          </span>
          {criticalTours.length > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 rounded-full px-2 py-0.5">
              <AlertTriangle size={10} /> {criticalTours.length}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {criticalTours.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 text-red-700 dark:text-red-300 dark:bg-red-950 dark:border-red-800 text-xs font-semibold px-3 py-2">
              <AlertTriangle size={14} />
              Tour-Score kritisch! — {criticalTours.map(t => t.fahrer_name).join(', ')}
            </div>
          )}

          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-xs text-center">
            <span className="text-gray-500 dark:text-gray-400">Flotten-Durchschnitt: </span>
            <span className={`font-bold text-sm ${d.fleet_avg_score >= 80 ? 'text-green-600 dark:text-green-400' : d.fleet_avg_score >= 60 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
              {d.fleet_avg_score}
            </span>
          </div>

          <div className="space-y-4">
            {d.tours.map(tour => (
              <div key={tour.fahrer_id} className="rounded-lg border border-gray-100 dark:border-gray-700 p-3 space-y-2">
                <div className="flex items-center gap-3">
                  <ScoreRing score={tour.score} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-gray-800 dark:text-gray-100 truncate">{tour.fahrer_name}</div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {tour.stopps.map(s => (
                        <div key={s.id} className="flex items-center gap-0.5">
                          <StoppDot status={s.status} />
                        </div>
                      ))}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {tour.stopps.filter(s => s.status === 'delivered').length}/{tour.stopps.length} Stopps
                    </div>
                  </div>
                </div>
                <div className="space-y-1 pt-1 border-t border-gray-50 dark:border-gray-800">
                  <SubScoreBar label="Pünktlichkeit" value={tour.sub_scores.puenktlichkeit} />
                  <SubScoreBar label="Abschlussrate" value={tour.sub_scores.abschlussrate} />
                  <SubScoreBar label="Speed" value={tour.sub_scores.speed} />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-1 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400 text-right">
            Aktualisiert alle 20 Sek.
          </div>
        </div>
      )}
    </div>
  );
}
