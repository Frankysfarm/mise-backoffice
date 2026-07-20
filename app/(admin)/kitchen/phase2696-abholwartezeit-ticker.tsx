'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  avg_min: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_min: number;
  alert_count: number;
}

function dotCls(a: string) {
  if (a === 'rot')  return 'bg-red-500';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-green-500';
}

function textCls(a: string) {
  if (a === 'rot')  return 'text-red-700';
  if (a === 'gelb') return 'text-amber-700';
  return 'text-green-700';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={11} className="text-red-500"   />;
  if (trend === 'fallend')  return <TrendingDown size={11} className="text-green-600" />;
  return                           <Minus        size={11} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f3', fahrer_name: 'Tim B.',   avg_min: 11.2, trend: 'steigend', trend_delta: 2.1,  ampel: 'rot'   },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   avg_min:  6.8, trend: 'fallend',  trend_delta: -1.2, ampel: 'gelb'  },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  avg_min:  3.4, trend: 'stabil',   trend_delta:  0.1, ampel: 'gruen' },
    { fahrer_id: 'f4', fahrer_name: 'Julia F.', avg_min:  2.9, trend: 'fallend',  trend_delta: -0.5, ampel: 'gruen' },
  ],
  team_avg_min: 6.1,
  alert_count: 1,
};

export function KitchenPhase2696AbholwartezeitTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen]   = useState(true);
  const [data, setData]   = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-abholwartezeit?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const hasAlert  = data.alert_count > 0;
  const teamAmpel = data.team_avg_min <= 4 ? 'gruen' : data.team_avg_min <= 8 ? 'gelb' : 'rot';
  const sorted    = [...data.fahrer].sort((a, b) => b.avg_min - a.avg_min);

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white'} shadow-sm mb-4`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Clock size={15} className={hasAlert ? 'text-amber-500' : 'text-gray-500'} />
          <span className="font-semibold text-sm text-gray-800">Abholwartezeit</span>
          <span className={`text-xs font-bold ${textCls(teamAmpel)}`}>
            Ø {data.team_avg_min.toFixed(1)} Min
          </span>
          {hasAlert && (
            <span className="bg-amber-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
              {data.alert_count}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-3 space-y-2">
          {hasAlert && (
            <div className="flex items-start gap-2 bg-amber-100 border border-amber-200 rounded-lg px-3 py-1.5">
              <AlertTriangle size={13} className="text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 font-medium">
                {data.alert_count} Fahrer wartet über 8 Min auf Abholung!
              </p>
            </div>
          )}

          {sorted.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${dotCls(f.ampel)}`} />
              <span className="text-xs text-gray-700 flex-1 truncate">{f.fahrer_name}</span>
              <TrendIcon trend={f.trend} />
              <span className={`text-xs font-bold ${textCls(f.ampel)}`}>{f.avg_min.toFixed(1)} Min</span>
            </div>
          ))}

          <p className="text-xs text-gray-400 pt-1">Ziel: ≤4 Min Abholwartezeit</p>
        </div>
      )}
    </div>
  );
}
