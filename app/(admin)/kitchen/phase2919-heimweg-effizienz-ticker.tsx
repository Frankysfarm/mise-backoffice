'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Home } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  heimweg_min: number;
  trend: string;
  trend_delta: number;
  ampel: string;
  alert_zu_lang: boolean;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_heimweg_min: number;
  alert_count: number;
}

const ZIEL = 10;
const WARN = 20;

function calcAmpel(min: number): string {
  if (min <= ZIEL) return 'gruen';
  if (min <= WARN) return 'gelb';
  return 'rot';
}

function dotCls(a: string) {
  if (a === 'rot')  return 'bg-red-500';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-green-500';
}

// Trend invertiert: fallend = gut, steigend = schlecht
function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'fallend')  return <TrendingDown size={10} className="text-green-600" />;
  if (trend === 'steigend') return <TrendingUp   size={10} className="text-red-500"   />;
  return                           <Minus        size={10} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'd1', fahrer_name: 'Julia F.', heimweg_min: 6.3,  trend: 'fallend',  trend_delta: -1.2, ampel: 'gruen', alert_zu_lang: false },
    { fahrer_id: 'd2', fahrer_name: 'Max M.',   heimweg_min: 8.5,  trend: 'steigend', trend_delta:  1.2, ampel: 'gruen', alert_zu_lang: false },
    { fahrer_id: 'd3', fahrer_name: 'Sara K.',  heimweg_min: 14.2, trend: 'fallend',  trend_delta: -1.3, ampel: 'gelb',  alert_zu_lang: false },
    { fahrer_id: 'd4', fahrer_name: 'Tim B.',   heimweg_min: 23.1, trend: 'steigend', trend_delta:  2.1, ampel: 'rot',   alert_zu_lang: true  },
  ],
  team_avg_heimweg_min: 13.0,
  alert_count: 1,
};

export function KitchenPhase2919HeimwegEffizienzTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-heimweg-effizienz?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const enriched  = data.fahrer.map(f => ({ ...f, ampel: calcAmpel(f.heimweg_min) }));
  const sorted    = [...enriched].sort((a, b) => a.heimweg_min - b.heimweg_min);
  const alerts    = enriched.filter(f => f.alert_zu_lang);
  const hasAlert  = alerts.length > 0;
  const teamAmpel = calcAmpel(data.team_avg_heimweg_min);
  const teamColor = teamAmpel === 'rot' ? 'text-red-600' : teamAmpel === 'gelb' ? 'text-amber-600' : 'text-green-600';

  return (
    <div className={`rounded-xl border shadow-sm mb-4 overflow-hidden ${hasAlert ? 'border-red-300' : 'border-gray-200'} bg-white dark:bg-gray-900`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Home size={14} className="text-sky-500" />
          <span className="font-semibold text-xs text-gray-700 dark:text-gray-200">Heimweg-Effizienz</span>
          <span className={`text-xs font-bold ${teamColor}`}>{data.team_avg_heimweg_min.toFixed(1)} Min Team-Ø</span>
          {hasAlert && <span className="bg-red-100 text-red-700 text-xs font-bold px-1.5 py-0.5 rounded-full">{alerts.length} Alert</span>}
        </div>
        {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>

      {open && (
        <div className="px-3 py-2 space-y-1.5">
          {sorted.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-2 px-1">
              <span className={`w-2 h-2 rounded-full shrink-0 ${dotCls(f.ampel)}`} />
              <span className="text-xs text-gray-700 dark:text-gray-300 flex-1">{f.fahrer_name}</span>
              <TrendIcon trend={f.trend} />
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 w-14 text-right">{f.heimweg_min.toFixed(1)} Min</span>
            </div>
          ))}
          {alerts.map(f => (
            <div key={`alert-${f.fahrer_id}`} className="text-xs text-red-600 dark:text-red-400 font-medium pl-4">
              ⚠ {f.fahrer_name}: Heimweg zu lang!
            </div>
          ))}
          <div className="pt-1 text-xs text-gray-400 dark:text-gray-500">Ziel ≤{ZIEL} Min | aufsteigend nach Zeit</div>
        </div>
      )}
    </div>
  );
}
