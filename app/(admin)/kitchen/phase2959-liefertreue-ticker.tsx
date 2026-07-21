'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Target } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  liefertreue_pct: number;
  trend: string;
  ampel: string;
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_liefertreue: number;
  alert_count: number;
}

const ZIEL = 90;
const ALERT_SCHWELLE = 70;

function calcAmpel(pct: number): string {
  if (pct >= ZIEL) return 'gruen';
  if (pct >= ALERT_SCHWELLE) return 'gelb';
  return 'rot';
}

function dotCls(a: string) {
  if (a === 'rot')  return 'bg-red-500';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-green-500';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={10} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={10} className="text-red-500"   />;
  return                           <Minus        size={10} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'd1', fahrer_name: 'Max M.',   liefertreue_pct: 95, trend: 'steigend', ampel: 'gruen', alert: false },
    { fahrer_id: 'd3', fahrer_name: 'Tim B.',   liefertreue_pct: 85, trend: 'steigend', ampel: 'gelb',  alert: false },
    { fahrer_id: 'd4', fahrer_name: 'Julia F.', liefertreue_pct: 72, trend: 'steigend', ampel: 'gelb',  alert: false },
    { fahrer_id: 'd2', fahrer_name: 'Sara K.',  liefertreue_pct: 60, trend: 'fallend',  ampel: 'rot',   alert: true  },
  ],
  team_avg_liefertreue: 78,
  alert_count: 1,
};

export function KitchenPhase2959LiefertreueTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-liefertreue?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const enriched = data.fahrer.map(f => ({ ...f, ampel: calcAmpel(f.liefertreue_pct) }));
  const sorted   = [...enriched].sort((a, b) => b.liefertreue_pct - a.liefertreue_pct);
  const alerts   = enriched.filter(f => f.alert);
  const hasAlert = alerts.length > 0;

  const teamAmpel = calcAmpel(data.team_avg_liefertreue);
  const teamText  = teamAmpel === 'rot' ? 'text-red-600' : teamAmpel === 'gelb' ? 'text-amber-600' : 'text-green-600';

  return (
    <div className={`rounded-xl border shadow-sm mb-4 overflow-hidden ${hasAlert ? 'border-red-300' : 'border-gray-200'} bg-white dark:bg-gray-900`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Target size={16} className="text-blue-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">
            Liefertreue-Ticker
            <span className={`ml-2 font-black ${teamText}`}>{data.team_avg_liefertreue.toFixed(1)}%</span>
            <span className="text-xs font-normal text-gray-400 ml-1">Team-Ø</span>
          </span>
          {hasAlert && <span className="ml-1 bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">{alerts.length} Alert</span>}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="px-4 py-3 space-y-2">
          {alerts.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-1.5 text-xs">
              <AlertTriangle size={12} className="text-red-500 shrink-0" />
              <span className="text-red-700 dark:text-red-300 font-medium">
                {f.fahrer_name}: Liefertreue zu niedrig! ({f.liefertreue_pct}%)
              </span>
            </div>
          ))}

          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {sorted.map(f => (
              <div key={f.fahrer_id} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${dotCls(f.ampel)} shrink-0`} />
                  <span className="text-xs text-gray-700 dark:text-gray-300">{f.fahrer_name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <TrendIcon trend={f.trend} />
                  <span className={`text-xs font-bold ${f.ampel === 'rot' ? 'text-red-600' : f.ampel === 'gelb' ? 'text-amber-600' : 'text-green-600'}`}>
                    {f.liefertreue_pct}%
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="text-xs text-gray-400 pt-1">Ziel ≥{ZIEL}% | 30-Min-Polling</div>
        </div>
      )}
    </div>
  );
}
