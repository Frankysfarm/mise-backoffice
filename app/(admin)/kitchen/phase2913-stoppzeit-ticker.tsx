'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingDown, TrendingUp, Minus, Timer } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  avg_stoppzeit_min: number;
  trend: string;
  alert_zu_lang: boolean;
  ampel: string;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_stoppzeit_min: number;
  alert_count: number;
}

const ZIEL_MIN = 5;
const WARN_MIN = 10;

function calcAmpel(min: number): string {
  if (min <= ZIEL_MIN) return 'gruen';
  if (min <= WARN_MIN) return 'gelb';
  return 'rot';
}

function dotCls(a: string) {
  if (a === 'rot')  return 'bg-red-500';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-green-500';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'fallend')  return <TrendingDown size={10} className="text-green-600" />;
  if (trend === 'steigend') return <TrendingUp   size={10} className="text-red-500"   />;
  return                           <Minus        size={10} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'd1', fahrer_name: 'Julia F.', avg_stoppzeit_min: 3.8,  trend: 'fallend',  alert_zu_lang: false, ampel: 'gruen' },
    { fahrer_id: 'd2', fahrer_name: 'Max M.',   avg_stoppzeit_min: 4.2,  trend: 'steigend', alert_zu_lang: false, ampel: 'gruen' },
    { fahrer_id: 'd3', fahrer_name: 'Sara K.',  avg_stoppzeit_min: 7.1,  trend: 'steigend', alert_zu_lang: false, ampel: 'gelb'  },
    { fahrer_id: 'd4', fahrer_name: 'Tim B.',   avg_stoppzeit_min: 12.5, trend: 'steigend', alert_zu_lang: true,  ampel: 'rot'   },
  ],
  team_avg_stoppzeit_min: 6.9,
  alert_count: 1,
};

export function KitchenPhase2913StoppzeitTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-stoppzeit?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const enriched = data.fahrer.map(f => ({ ...f, ampel: calcAmpel(f.avg_stoppzeit_min) }));
  const sorted   = [...enriched].sort((a, b) => a.avg_stoppzeit_min - b.avg_stoppzeit_min);
  const alerts   = enriched.filter(f => f.alert_zu_lang);
  const hasAlert = alerts.length > 0;
  const teamAmpelColor = calcAmpel(data.team_avg_stoppzeit_min) === 'rot'
    ? 'text-red-600' : calcAmpel(data.team_avg_stoppzeit_min) === 'gelb'
    ? 'text-amber-600' : 'text-green-600';

  return (
    <div className={`rounded-xl border shadow-sm mb-4 overflow-hidden ${hasAlert ? 'border-red-300' : 'border-gray-200'} bg-white dark:bg-gray-900`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Timer size={14} className="text-indigo-500" />
          <span className="font-semibold text-xs text-gray-700 dark:text-gray-200">Stoppzeit-Ticker</span>
          <span className={`text-xs font-bold ${teamAmpelColor}`}>{data.team_avg_stoppzeit_min.toFixed(1)} Min Team-Ø</span>
          {hasAlert && <span className="bg-red-100 text-red-700 text-xs font-bold px-1.5 py-0.5 rounded-full">{alerts.length} Alert</span>}
        </div>
        {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>

      {open && (
        <div className="px-3 py-2 space-y-1.5">
          {/* Alerts */}
          {alerts.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded px-2 py-1 text-xs">
              <AlertTriangle size={11} className="text-red-500 shrink-0" />
              <span className="text-red-700 dark:text-red-300 font-medium">{f.fahrer_name}: Stoppzeit zu lang! {f.avg_stoppzeit_min.toFixed(1)} Min</span>
            </div>
          ))}

          {/* Driver list */}
          {sorted.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-2 px-1">
              <span className={`w-2 h-2 rounded-full shrink-0 ${dotCls(f.ampel)}`} />
              <span className="text-xs text-gray-700 dark:text-gray-300 flex-1">{f.fahrer_name}</span>
              <TrendIcon trend={f.trend} />
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 w-14 text-right">{f.avg_stoppzeit_min.toFixed(1)} Min</span>
            </div>
          ))}

          <div className="pt-1 text-xs text-gray-400 dark:text-gray-500">Ziel ≤{ZIEL_MIN} Min | aufsteigend nach Stoppzeit</div>
        </div>
      )}
    </div>
  );
}
