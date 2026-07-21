'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Target } from 'lucide-react';

interface FahrerSingle {
  fahrer_id: string;
  fahrer_name: string;
  liefertreue_pct: number;
  liefertreue_gestern: number;
  puenktlich_heute: number;
  gesamt_heute: number;
  trend: string;
  trend_delta: number;
  ampel: string;
  alert: boolean;
}

interface ApiData {
  fahrer_single: FahrerSingle;
  team_avg_liefertreue: number;
}

const ZIEL = 90;
const MAX_BAR = 100;

function calcAmpel(pct: number) {
  if (pct >= ZIEL) return 'gruen';
  if (pct >= 70)   return 'gelb';
  return 'rot';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { text: 'text-red-600',   bar: 'bg-red-500',   bg: 'bg-red-50 border-red-200'    };
  if (a === 'gelb') return { text: 'text-amber-600',  bar: 'bg-amber-400', bg: 'bg-amber-50 border-amber-200' };
  return                   { text: 'text-green-600',  bar: 'bg-green-500', bg: 'bg-green-50 border-green-200' };
}

function coaching(a: string): string {
  if (a === 'gruen') return 'Super — über 90% pünktlich! Weiter so.';
  if (a === 'gelb')  return 'Gut, aber Luft nach oben. Prüfe deine Routenplanung.';
  return 'Liefertreue zu niedrig. Zeitpuffer einplanen und früh losfahren.';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={14} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={14} className="text-red-500"   />;
  return                           <Minus        size={14} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer_single: {
    fahrer_id: 'mock', fahrer_name: 'Ich', liefertreue_pct: 85, liefertreue_gestern: 80,
    puenktlich_heute: 17, gesamt_heute: 20, trend: 'steigend', trend_delta: 5, ampel: 'gelb', alert: false,
  },
  team_avg_liefertreue: 78,
};

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2957MeineLiefertreue({ driverId, locationId, isOnline }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!isOnline) return;
    if (!locationId) { setData(MOCK); return; }
    const url = driverId
      ? `/api/delivery/admin/fahrer-liefertreue?location_id=${locationId}&driver_id=${driverId}`
      : `/api/delivery/admin/fahrer-liefertreue?location_id=${locationId}`;
    const load = () =>
      fetch(url)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [driverId, locationId, isOnline]);

  if (!isOnline || !data) return null;

  const f = data.fahrer_single;
  const ampelKey = calcAmpel(f.liefertreue_pct);
  const { text, bar, bg } = ampelCls(ampelKey);
  const pct = Math.min(MAX_BAR, f.liefertreue_pct);
  const delta = f.trend_delta;

  return (
    <div className={`rounded-xl border shadow-sm mb-4 overflow-hidden ${bg} bg-white dark:bg-gray-900`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Target size={16} className="text-blue-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Meine Liefertreue</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="px-4 py-3 space-y-3">
          <div className="text-center">
            <div className={`text-4xl font-black ${text}`}>{f.liefertreue_pct}%</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">pünktliche Lieferungen</div>
          </div>

          <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-visible">
            <div className={`absolute top-0 left-0 h-3 rounded-full ${bar} transition-all`} style={{ width: `${pct}%` }} />
            <div className="absolute top-[-3px] h-5 w-0.5 bg-gray-600 dark:bg-gray-300 opacity-60" style={{ left: `${ZIEL}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>0%</span>
            <span className="text-gray-500">Ziel ≥{ZIEL}%</span>
            <span>100%</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400">Trend (gestern)</div>
              <div className="flex items-center justify-center gap-1 mt-0.5">
                <TrendIcon trend={f.trend} />
                <span className={`text-sm font-bold ${delta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {delta >= 0 ? '+' : ''}{delta}%
                </span>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
              <div className="text-xs text-gray-500 dark:text-gray-400">Team-Ø</div>
              <div className="text-sm font-bold text-gray-700 dark:text-gray-300">{data.team_avg_liefertreue.toFixed(1)}%</div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
            {coaching(ampelKey)}
          </div>

          <div className="text-xs text-gray-400 text-center">{f.puenktlich_heute}/{f.gesamt_heute} Lieferungen heute pünktlich</div>
        </div>
      )}
    </div>
  );
}
