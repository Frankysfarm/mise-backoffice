'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Home } from 'lucide-react';

interface DriverData {
  fahrer_single: {
    heimweg_min: number;
    heimweg_min_vw: number;
    trend: string;
    trend_delta: number;
    ampel: string;
    alert_zu_lang: boolean;
  };
  team_avg_heimweg_min: number;
}

const ZIEL = 10;
const WARN = 20;
const MAX_BAR = 30;

function calcAmpel(min: number): string {
  if (min <= ZIEL) return 'gruen';
  if (min <= WARN) return 'gelb';
  return 'rot';
}

function ampelColors(a: string) {
  if (a === 'rot')  return { text: 'text-red-600',   bar: 'bg-red-500'   };
  if (a === 'gelb') return { text: 'text-amber-600', bar: 'bg-amber-400' };
  return                   { text: 'text-green-600', bar: 'bg-green-500' };
}

function coachingTipp(ampel: string): string {
  if (ampel === 'rot')  return 'Heimweg zu lang! Direktere Route zurück zum Depot wählen — kein Umweg.';
  if (ampel === 'gelb') return 'Fast im grünen Bereich! Konsequent direkte Rückfahrt einhalten.';
  return 'Perfekte Rückfahrtzeit — weiter so!';
}

// Trend invertiert: fallend = gut, steigend = schlecht
function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-green-600" />;
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-red-500"   />;
  return                           <Minus        size={14} className="text-gray-400"  />;
}

const MOCK: DriverData = {
  fahrer_single: {
    heimweg_min: 14.2,
    heimweg_min_vw: 15.5,
    trend: 'fallend',
    trend_delta: -1.3,
    ampel: 'gelb',
    alert_zu_lang: false,
  },
  team_avg_heimweg_min: 13.0,
};

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2917MeinHeimweg({ driverId, locationId, isOnline }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<DriverData | null>(null);

  useEffect(() => {
    if (!isOnline) return;
    if (!driverId || !locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-heimweg-effizienz?location_id=${locationId}&driver_id=${driverId}`)
        .then(r => r.json())
        .then((d: DriverData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!isOnline || !data) return null;

  const f = data.fahrer_single;
  const ampel = calcAmpel(f.heimweg_min);
  const { text, bar } = ampelColors(ampel);
  const pct     = Math.min(100, (f.heimweg_min / MAX_BAR) * 100);
  const zielPct = (ZIEL / MAX_BAR) * 100;
  const tipp    = coachingTipp(ampel);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 bg-white dark:bg-gray-900 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Home size={16} className="text-sky-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Mein Heimweg</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="px-4 py-4 space-y-4">
          {/* Big value */}
          <div className="text-center">
            <div className={`text-4xl font-extrabold ${text}`}>{f.heimweg_min.toFixed(1)} Min</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Ø Leerfahrt-Zeit heute (Depot-Return)</div>
          </div>

          {/* Bar */}
          <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-visible mx-2">
            <div className={`absolute top-0 left-0 h-3 rounded-full transition-all ${bar}`} style={{ width: `${pct}%` }} />
            <div className="absolute top-[-3px] h-5 w-0.5 bg-gray-600 dark:bg-gray-300 opacity-70 rounded" style={{ left: `${zielPct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-400 px-2">
            <span>0</span>
            <span className="text-gray-600 dark:text-gray-300 font-medium">Ziel ≤{ZIEL} Min</span>
            <span>{MAX_BAR} Min</span>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400">Trend (vs. gestern)</div>
              <div className="flex items-center justify-center gap-1 mt-0.5">
                <TrendIcon trend={f.trend} />
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  {f.trend_delta > 0 ? '+' : ''}{f.trend_delta.toFixed(1)} Min
                </span>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400">Team-Ø</div>
              <div className="text-sm font-bold text-gray-700 dark:text-gray-300">{data.team_avg_heimweg_min.toFixed(1)} Min</div>
            </div>
          </div>

          {/* Coaching tip */}
          <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-lg px-3 py-2 text-xs text-sky-700 dark:text-sky-300">
            {tipp}
          </div>
        </div>
      )}
    </div>
  );
}
