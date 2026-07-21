'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Timer } from 'lucide-react';

interface DriverData {
  fahrer_single: {
    avg_stoppzeit_min: number;
    avg_stoppzeit_min_vw: number;
    trend: string;
    trend_delta: number;
    ampel: string;
    alert_zu_lang: boolean;
  };
  team_avg_stoppzeit_min: number;
}

const ZIEL_MIN = 5;
const WARN_MIN = 10;
const MAX_BAR  = 15;

function calcAmpel(min: number): string {
  if (min <= ZIEL_MIN) return 'gruen';
  if (min <= WARN_MIN) return 'gelb';
  return 'rot';
}

function ampelColors(a: string) {
  if (a === 'rot')  return { text: 'text-red-600',   bar: 'bg-red-500',   bg: 'bg-red-50'   };
  if (a === 'gelb') return { text: 'text-amber-600', bar: 'bg-amber-400', bg: 'bg-amber-50' };
  return                   { text: 'text-green-600', bar: 'bg-green-500', bg: 'bg-green-50' };
}

function coachingTipp(ampel: string): string {
  if (ampel === 'rot')  return 'Bestellung schnell übergeben & sofort weiterfahren — Ziel: ≤5 Min!';
  if (ampel === 'gelb') return 'Fast am Ziel! Noch etwas flotter am Stopp und du bist grün.';
  return 'Perfekt! Deine Stoppzeit ist sehr effizient — weiter so!';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-green-600" />;
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-red-500"   />;
  return                           <Minus        size={14} className="text-gray-400"  />;
}

const MOCK: DriverData = {
  fahrer_single: {
    avg_stoppzeit_min: 7.1,
    avg_stoppzeit_min_vw: 6.5,
    trend: 'steigend',
    trend_delta: 0.6,
    ampel: 'gelb',
    alert_zu_lang: false,
  },
  team_avg_stoppzeit_min: 6.9,
};

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2911MeineStoppzeit({ driverId, locationId, isOnline }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<DriverData | null>(null);

  useEffect(() => {
    if (!isOnline) return;
    if (!driverId || !locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-stoppzeit?location_id=${locationId}&driver_id=${driverId}`)
        .then(r => r.json())
        .then((d: DriverData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!isOnline || !data) return null;

  const f = data.fahrer_single;
  const ampel = calcAmpel(f.avg_stoppzeit_min);
  const { text, bar } = ampelColors(ampel);
  const pct     = Math.min(100, (f.avg_stoppzeit_min / MAX_BAR) * 100);
  const zielPct = (ZIEL_MIN / MAX_BAR) * 100;
  const tipp    = coachingTipp(ampel);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 bg-white dark:bg-gray-900 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Timer size={16} className="text-indigo-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Meine Stoppzeit</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="px-4 py-4 space-y-4">
          {/* Big value */}
          <div className="text-center">
            <div className={`text-4xl font-extrabold ${text}`}>{f.avg_stoppzeit_min.toFixed(1)} Min</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Ø Stoppzeit heute</div>
          </div>

          {/* Bar */}
          <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-visible mx-2">
            <div className={`absolute top-0 left-0 h-3 rounded-full transition-all ${bar}`} style={{ width: `${pct}%` }} />
            <div className="absolute top-[-3px] h-5 w-0.5 bg-gray-600 dark:bg-gray-300 opacity-70 rounded" style={{ left: `${zielPct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-400 px-2">
            <span>0 Min</span>
            <span className="text-gray-600 dark:text-gray-300 font-medium">Ziel ≤{ZIEL_MIN}</span>
            <span>{MAX_BAR} Min</span>
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400">Trend</div>
              <div className="flex items-center justify-center gap-1 mt-0.5">
                <TrendIcon trend={f.trend} />
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  {f.trend_delta > 0 ? '+' : ''}{f.trend_delta.toFixed(1)} Min
                </span>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400">Ziel</div>
              <div className="text-sm font-bold text-gray-700 dark:text-gray-300">≤{ZIEL_MIN} Min</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400">Team-Ø</div>
              <div className="text-sm font-bold text-gray-700 dark:text-gray-300">{data.team_avg_stoppzeit_min.toFixed(1)} Min</div>
            </div>
          </div>

          {/* Coaching tip */}
          <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg px-3 py-2 text-xs text-indigo-700 dark:text-indigo-300">
            {tipp}
          </div>
        </div>
      )}
    </div>
  );
}
