'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Star } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  avg_sterne: number;
  trend: string;
  ampel: string;
  alert_niedrig: boolean;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_sterne: number;
  alert_count: number;
}

const ZIEL = 4.5;
const ALERT_SCHWELLE = 4.0;

function calcAmpel(avg: number): string {
  if (avg >= 4.5) return 'gruen';
  if (avg >= 4.0) return 'gelb';
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
    { fahrer_id: 'd1', fahrer_name: 'Julia F.', avg_sterne: 4.8, trend: 'steigend', ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'd2', fahrer_name: 'Max M.',   avg_sterne: 4.2, trend: 'fallend',  ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'd3', fahrer_name: 'Sara K.',  avg_sterne: 3.8, trend: 'steigend', ampel: 'rot',   alert_niedrig: true  },
    { fahrer_id: 'd4', fahrer_name: 'Tim B.',   avg_sterne: 3.1, trend: 'fallend',  ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_sterne: 4.0,
  alert_count: 2,
};

export function KitchenPhase2954BewertungsTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-bewertung?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const enriched = data.fahrer.map(f => ({ ...f, ampel: calcAmpel(f.avg_sterne) }));
  const sorted   = [...enriched].sort((a, b) => b.avg_sterne - a.avg_sterne);
  const alerts   = enriched.filter(f => f.avg_sterne < ALERT_SCHWELLE);
  const hasAlert = alerts.length > 0;
  const teamAmpel = calcAmpel(data.team_avg_sterne);
  const teamColor = teamAmpel === 'rot' ? 'text-red-600' : teamAmpel === 'gelb' ? 'text-amber-600' : 'text-green-600';

  return (
    <div className={`rounded-xl border shadow-sm mb-4 overflow-hidden ${hasAlert ? 'border-red-300' : 'border-gray-200'} bg-white dark:bg-gray-900`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Star size={14} className="text-yellow-400 fill-yellow-400" />
          <span className="font-semibold text-xs text-gray-700 dark:text-gray-200">Bewertungen</span>
          <span className={`text-xs font-bold ${teamColor}`}>{data.team_avg_sterne.toFixed(1)} ★ Ø</span>
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
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 w-12 text-right">{f.avg_sterne.toFixed(1)} ★</span>
            </div>
          ))}
          {alerts.map(f => (
            <div key={`alert-${f.fahrer_id}`} className="text-xs text-red-600 dark:text-red-400 font-medium pl-4">
              ⚠ {f.fahrer_name}: Bewertung zu niedrig!
            </div>
          ))}
          <div className="pt-1 text-xs text-gray-400 dark:text-gray-500">Ziel ≥{ZIEL} ★ | absteigend</div>
        </div>
      )}
    </div>
  );
}
