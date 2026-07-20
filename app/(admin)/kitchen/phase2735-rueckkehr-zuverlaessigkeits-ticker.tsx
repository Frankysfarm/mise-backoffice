'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, RotateCcw } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  rate: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  alert: string | null;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_rate: number;
}

const ZIEL = 90;
const WARN = 70;

function calcAmpel(rate: number): 'gruen' | 'gelb' | 'rot' {
  if (rate >= ZIEL) return 'gruen';
  if (rate >= WARN) return 'gelb';
  return 'rot';
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
  if (trend === 'steigend') return <TrendingUp   size={11} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={11} className="text-red-500"   />;
  return                           <Minus        size={11} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f4', fahrer_name: 'Julia F.', rate: 60, trend: 'fallend',  alert: 'Rückkehr unzuverlässig!' },
    { fahrer_id: 'f3', fahrer_name: 'Tim B.',   rate: 75, trend: 'fallend',  alert: null },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rate: 80, trend: 'stabil',   alert: null },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rate: 95, trend: 'steigend', alert: null },
  ],
  team_avg_rate: 77.5,
};

export function KitchenPhase2735RueckkehrZuverlaessigkeitsTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-rueckkehr-zuverlaessigkeit?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const enriched  = data.fahrer.map((f: FahrerEntry) => ({ ...f, ampel: calcAmpel(f.rate) }));
  // aufsteigend = niedrigste Rate (kritischste) oben
  const sorted    = [...enriched].sort((a, b) => a.rate - b.rate);
  const alerts    = enriched.filter((f: FahrerEntry & { ampel: string }) => f.alert !== null);
  const hasAlert  = alerts.length > 0;
  const teamAmpel = calcAmpel(data.team_avg_rate);

  return (
    <div className={`rounded-xl border ${hasAlert ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} shadow-sm mb-3`}>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left"
      >
        <div className="flex items-center gap-2">
          <RotateCcw size={15} className={hasAlert ? 'text-red-500' : 'text-blue-600'} />
          <span className="font-semibold text-sm text-gray-800">Rückkehr-Zuverlässigkeit</span>
          {hasAlert && (
            <span className="inline-flex items-center gap-0.5 text-xs text-red-600 font-medium">
              <AlertTriangle size={11} /> {alerts.length}
            </span>
          )}
          <span className={`ml-1 text-xs font-bold ${textCls(teamAmpel)}`}>
            Ø {data.team_avg_rate.toFixed(1)}%
          </span>
          <span className="text-[10px] text-gray-400 ml-1">Ziel ≥{ZIEL}%</span>
        </div>
        {open ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-3 space-y-1.5">
          {alerts.map((f: FahrerEntry & { ampel: string }) => (
            <div key={f.fahrer_id} className="flex items-center gap-1.5 rounded bg-red-100 border border-red-200 px-2 py-1 text-xs text-red-700 font-medium">
              <AlertTriangle size={11} />
              <span className="font-bold">{f.fahrer_name}</span>: {f.alert} ({f.rate}%)
            </div>
          ))}

          {sorted.map((f: FahrerEntry & { ampel: string }) => (
            <div key={f.fahrer_id} className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${dotCls(f.ampel)}`} />
                <span className="text-xs text-gray-700">{f.fahrer_name}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <TrendIcon trend={f.trend} />
                <span className={`text-xs font-bold ${textCls(f.ampel)}`}>{f.rate}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
