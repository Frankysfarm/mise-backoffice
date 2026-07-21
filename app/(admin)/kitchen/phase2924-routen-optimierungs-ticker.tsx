'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Route } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  trend: string;
  trend_delta: number;
  ampel: string;
  alert_ineffizient: boolean;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_score: number;
  alert_count: number;
}

const ZIEL = 90;
const WARN = 75;

function calcAmpel(score: number): string {
  if (score >= ZIEL) return 'gruen';
  if (score >= WARN) return 'gelb';
  return 'rot';
}

function dotCls(a: string) {
  if (a === 'rot')  return 'bg-red-500';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-green-500';
}

// Trend normal: steigend = gut (höherer Score), fallend = schlecht
function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={10} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={10} className="text-red-500"   />;
  return                           <Minus        size={10} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'd4', fahrer_name: 'Julia F.', score: 96, trend: 'steigend', trend_delta:  2, ampel: 'gruen', alert_ineffizient: false },
    { fahrer_id: 'd1', fahrer_name: 'Max M.',   score: 92, trend: 'fallend',  trend_delta: -1, ampel: 'gruen', alert_ineffizient: false },
    { fahrer_id: 'd2', fahrer_name: 'Sara K.',  score: 82, trend: 'steigend', trend_delta:  2, ampel: 'gelb',  alert_ineffizient: false },
    { fahrer_id: 'd3', fahrer_name: 'Tim B.',   score: 61, trend: 'fallend',  trend_delta: -5, ampel: 'rot',   alert_ineffizient: true  },
  ],
  team_avg_score: 83,
  alert_count: 1,
};

export function KitchenPhase2924RoutenOptimierungsTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-routen-optimierung?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const enriched  = data.fahrer.map(f => ({ ...f, ampel: calcAmpel(f.score) }));
  const sorted    = [...enriched].sort((a, b) => b.score - a.score);
  const alerts    = enriched.filter(f => f.alert_ineffizient);
  const hasAlert  = alerts.length > 0;
  const teamAmpel = calcAmpel(data.team_avg_score);
  const teamColor = teamAmpel === 'rot' ? 'text-red-600' : teamAmpel === 'gelb' ? 'text-amber-600' : 'text-green-600';

  return (
    <div className={`rounded-xl border shadow-sm mb-4 overflow-hidden ${hasAlert ? 'border-red-300' : 'border-gray-200'} bg-white dark:bg-gray-900`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Route size={14} className="text-violet-500" />
          <span className="font-semibold text-xs text-gray-700 dark:text-gray-200">Routen-Optimierung</span>
          <span className={`text-xs font-bold ${teamColor}`}>{data.team_avg_score} Pkt Team-Ø</span>
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
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 w-14 text-right">{f.score} Pkt</span>
            </div>
          ))}
          {alerts.map(f => (
            <div key={`alert-${f.fahrer_id}`} className="text-xs text-red-600 dark:text-red-400 font-medium pl-4">
              ⚠ {f.fahrer_name}: Ineffiziente Route!
            </div>
          ))}
          <div className="pt-1 text-xs text-gray-400 dark:text-gray-500">Ziel ≥{ZIEL} Pkt | absteigend nach Score</div>
        </div>
      )}
    </div>
  );
}
