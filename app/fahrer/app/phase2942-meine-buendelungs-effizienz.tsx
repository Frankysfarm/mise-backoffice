'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Layers } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  avg_stopps: number;
  trend: string;
  trend_delta: number;
  ampel: string;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_stopps: number;
}

interface DriverData {
  avg_stopps: number;
  trend: string;
  trend_delta: number;
  ampel: string;
  team_avg: number;
}

const ZIEL = 3;
const MAX_BAR = 5;

function calcAmpel(avg: number): string {
  if (avg >= ZIEL) return 'gruen';
  if (avg >= 2)    return 'gelb';
  return 'rot';
}

function ampelColors(a: string) {
  if (a === 'rot')  return { text: 'text-red-600',   bar: 'bg-red-500'   };
  if (a === 'gelb') return { text: 'text-amber-600', bar: 'bg-amber-400' };
  return                   { text: 'text-green-600', bar: 'bg-green-500' };
}

function coachingTipp(ampel: string): string {
  if (ampel === 'rot')  return 'Zu wenige Stopps je Tour — versuche mehr Lieferungen pro Fahrt zu bündeln!';
  if (ampel === 'gelb') return 'Noch Potenzial! Bitte Disponenten ansprechen um mehr Stopps je Tour zu koordinieren.';
  return 'Sehr gute Bündelung — du lieferst effizient mehrere Stopps pro Tour!';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-red-500"   />;
  return                           <Minus        size={14} className="text-gray-400"  />;
}

const MOCK: DriverData = {
  avg_stopps: 3.6,
  trend: 'steigend',
  trend_delta: 0.4,
  ampel: 'gruen',
  team_avg: 2.8,
};

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2942MeineBuendelungsEffizienz({ driverId, locationId, isOnline }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<DriverData | null>(null);

  useEffect(() => {
    if (!isOnline) return;
    if (!driverId || !locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-buendelungs-effizienz?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => {
          const f = d.fahrer.find(x => x.fahrer_id === driverId) ?? d.fahrer[0];
          if (f) setData({ avg_stopps: f.avg_stopps, trend: f.trend, trend_delta: f.trend_delta, ampel: f.ampel, team_avg: d.team_avg_stopps });
          else setData(MOCK);
        })
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!isOnline || !data) return null;

  const ampel = calcAmpel(data.avg_stopps);
  const { text, bar } = ampelColors(ampel);
  const pct     = Math.min(100, (data.avg_stopps / MAX_BAR) * 100);
  const zielPct = (ZIEL / MAX_BAR) * 100;
  const tipp    = coachingTipp(ampel);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 bg-white dark:bg-gray-900 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-blue-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Meine Bündelungs-Effizienz</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="px-4 py-4 space-y-4">
          <div className="text-center">
            <div className={`text-4xl font-extrabold ${text}`}>{data.avg_stopps.toFixed(1)}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Ø Stopps je Tour heute</div>
          </div>

          <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-visible mx-2">
            <div className={`absolute top-0 left-0 h-3 rounded-full transition-all ${bar}`} style={{ width: `${pct}%` }} />
            <div className="absolute top-[-3px] h-5 w-0.5 bg-gray-600 dark:bg-gray-300 opacity-70 rounded" style={{ left: `${zielPct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-400 px-2">
            <span>0</span>
            <span className="text-gray-600 dark:text-gray-300 font-medium">Ziel ≥{ZIEL} Stopps/Tour</span>
            <span>{MAX_BAR}+</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400">Trend (vs. gestern)</div>
              <div className="flex items-center justify-center gap-1 mt-0.5">
                <TrendIcon trend={data.trend} />
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  {data.trend_delta > 0 ? '+' : ''}{data.trend_delta.toFixed(1)} Stopps
                </span>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400">Team-Ø</div>
              <div className="text-sm font-bold text-gray-700 dark:text-gray-300">{data.team_avg.toFixed(1)} Stopps/Tour</div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
            {tipp}
          </div>
        </div>
      )}
    </div>
  );
}
