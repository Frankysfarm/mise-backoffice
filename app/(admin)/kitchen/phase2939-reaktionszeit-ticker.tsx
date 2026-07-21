'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  avg_min: number;
  trend: string;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_durchschnitt: number;
}

const ZIEL = 2;
const WARN = 5;

function calcAmpel(min: number): string {
  if (min <= ZIEL) return 'gruen';
  if (min <= WARN) return 'gelb';
  return 'rot';
}

function dotCls(a: string): string {
  if (a === 'rot')  return 'bg-red-500';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-green-500';
}

function textCls(a: string): string {
  if (a === 'rot')  return 'text-red-700';
  if (a === 'gelb') return 'text-amber-700';
  return 'text-green-700';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={10} className="text-red-500"   />;
  if (trend === 'fallend')  return <TrendingDown size={10} className="text-green-600" />;
  return                           <Minus        size={10} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'd1', fahrer_name: 'Max M.',  avg_min: 1.8, trend: 'fallend'  },
    { fahrer_id: 'd4', fahrer_name: 'Anna B.', avg_min: 2.9, trend: 'stabil'   },
    { fahrer_id: 'd2', fahrer_name: 'Sara K.', avg_min: 4.5, trend: 'steigend' },
    { fahrer_id: 'd3', fahrer_name: 'Tim W.',  avg_min: 7.2, trend: 'steigend' },
  ],
  team_durchschnitt: 4.1,
};

export function KitchenPhase2939ReaktionszeitTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-reaktionszeit?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const enriched  = data.fahrer.map(f => ({ ...f, ampel: calcAmpel(f.avg_min) }));
  const sorted    = [...enriched].sort((a, b) => a.avg_min - b.avg_min);
  const alerts    = enriched.filter(f => f.avg_min > WARN);
  const hasAlert  = alerts.length > 0;
  const teamAmpel = calcAmpel(data.team_durchschnitt);

  return (
    <div className={`rounded-xl border shadow-sm mb-4 overflow-hidden ${hasAlert ? 'border-red-300' : 'border-gray-200'} bg-white dark:bg-gray-900`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Zap size={15} className="text-yellow-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Reaktionszeit-Ticker</span>
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${textCls(teamAmpel)} bg-gray-100 dark:bg-gray-700`}>
            Ø {data.team_durchschnitt.toFixed(1)} Min
          </span>
          {hasAlert && (
            <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">{alerts.length} Alert</span>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="px-4 py-3 space-y-2">
          {alerts.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-1.5 text-xs">
              <AlertTriangle size={12} className="text-red-500 shrink-0" />
              <span className="text-red-700 dark:text-red-300 font-medium">
                {f.fahrer_name}: Reaktionszeit zu hoch! {f.avg_min.toFixed(1)} Min
              </span>
            </div>
          ))}

          {sorted.map(f => (
            <div key={f.fahrer_id} className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-800 last:border-0">
              <div className="flex items-center gap-1.5">
                <span className={`inline-block w-2 h-2 rounded-full ${dotCls(f.ampel)}`} />
                <span className="text-xs text-gray-700 dark:text-gray-300">{f.fahrer_name}</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendIcon trend={f.trend} />
                <span className={`text-xs font-bold ${textCls(f.ampel)}`}>{f.avg_min.toFixed(1)} Min</span>
              </div>
            </div>
          ))}

          <div className="text-xs text-gray-400 dark:text-gray-500 pt-1">Ziel ≤{ZIEL} Min · Alert &gt;{WARN} Min · aufsteigend</div>
        </div>
      )}
    </div>
  );
}
