'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Route } from 'lucide-react';

interface DriverData {
  fahrer_single: {
    score: number;
    score_vw: number;
    trend: string;
    trend_delta: number;
    ampel: string;
    alert_ineffizient: boolean;
    avg_distance_km: number;
    avg_ideal_km: number;
  };
  team_avg_score: number;
}

const ZIEL = 90;
const WARN = 75;

function calcAmpel(score: number): string {
  if (score >= ZIEL) return 'gruen';
  if (score >= WARN) return 'gelb';
  return 'rot';
}

function ampelColors(a: string) {
  if (a === 'rot')  return { text: 'text-red-600',   bar: 'bg-red-500'   };
  if (a === 'gelb') return { text: 'text-amber-600', bar: 'bg-amber-400' };
  return                   { text: 'text-green-600', bar: 'bg-green-500' };
}

function coachingTipp(ampel: string): string {
  if (ampel === 'rot')  return 'Route stark ineffizient! Kürzeste Strecke nutzen und Umwege vermeiden — GPS-Empfehlungen folgen.';
  if (ampel === 'gelb') return 'Fast optimale Route! Kleine Anpassungen bei der Streckenplanung können deinen Score verbessern.';
  return 'Optimale Routenführung — weiter so! Du fährst nahezu die kürzeste Strecke.';
}

// Trend normal: steigend = gut (höherer Score), fallend = schlecht
function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-red-500"   />;
  return                           <Minus        size={14} className="text-gray-400"  />;
}

const MOCK: DriverData = {
  fahrer_single: {
    score: 82,
    score_vw: 80,
    trend: 'steigend',
    trend_delta: 2,
    ampel: 'gelb',
    alert_ineffizient: false,
    avg_distance_km: 6.1,
    avg_ideal_km: 5.0,
  },
  team_avg_score: 83,
};

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2922MeineRoutenOptimierung({ driverId, locationId, isOnline }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<DriverData | null>(null);

  useEffect(() => {
    if (!isOnline) return;
    if (!driverId || !locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-routen-optimierung?location_id=${locationId}&driver_id=${driverId}`)
        .then(r => r.json())
        .then((d: DriverData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!isOnline || !data) return null;

  const f = data.fahrer_single;
  const ampel   = calcAmpel(f.score);
  const { text, bar } = ampelColors(ampel);
  const pct     = Math.min(100, f.score);
  const zielPct = ZIEL;
  const tipp    = coachingTipp(ampel);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 bg-white dark:bg-gray-900 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Route size={16} className="text-violet-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Meine Routen-Optimierung</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="px-4 py-4 space-y-4">
          {/* Big score value */}
          <div className="text-center">
            <div className={`text-4xl font-extrabold ${text}`}>{f.score} Pkt</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Routen-Optimierungs-Score heute</div>
          </div>

          {/* Bar */}
          <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-visible mx-2">
            <div className={`absolute top-0 left-0 h-3 rounded-full transition-all ${bar}`} style={{ width: `${pct}%` }} />
            <div className="absolute top-[-3px] h-5 w-0.5 bg-gray-600 dark:bg-gray-300 opacity-70 rounded" style={{ left: `${zielPct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-400 px-2">
            <span>0</span>
            <span className="text-gray-600 dark:text-gray-300 font-medium">Ziel ≥{ZIEL} Pkt</span>
            <span>100</span>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400">Trend (vs. gestern)</div>
              <div className="flex items-center justify-center gap-1 mt-0.5">
                <TrendIcon trend={f.trend} />
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  {f.trend_delta > 0 ? '+' : ''}{f.trend_delta} Pkt
                </span>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400">Team-Ø</div>
              <div className="text-sm font-bold text-gray-700 dark:text-gray-300">{data.team_avg_score} Pkt</div>
            </div>
          </div>

          {/* Coaching tip */}
          <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-lg px-3 py-2 text-xs text-violet-700 dark:text-violet-300">
            {tipp}
          </div>
        </div>
      )}
    </div>
  );
}
