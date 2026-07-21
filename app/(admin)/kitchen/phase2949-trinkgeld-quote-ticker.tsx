'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Gift } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  trinkgeld_quote: number;
  trend: string;
  ampel: string;
  alert_niedrig: boolean;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_quote: number;
  alert_count: number;
}

const ZIEL = 30;
const ALERT_SCHWELLE = 10;

function calcAmpel(q: number): string {
  if (q >= 10) return 'gruen';
  if (q >= 5)  return 'gelb';
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
    { fahrer_id: 'd1', fahrer_name: 'Julia F.', trinkgeld_quote: 12.7, trend: 'steigend', ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'd2', fahrer_name: 'Max M.',   trinkgeld_quote:  9.8, trend: 'fallend',  ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'd3', fahrer_name: 'Sara K.',  trinkgeld_quote:  6.4, trend: 'steigend', ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'd4', fahrer_name: 'Tim B.',   trinkgeld_quote:  3.1, trend: 'fallend',  ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_quote: 8.0,
  alert_count: 1,
};

export function KitchenPhase2949TrinkgeldQuoteTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-trinkgeld-quote?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const enriched = data.fahrer.map(f => ({ ...f, ampel: calcAmpel(f.trinkgeld_quote) }));
  const sorted   = [...enriched].sort((a, b) => b.trinkgeld_quote - a.trinkgeld_quote);
  const alerts   = enriched.filter(f => f.trinkgeld_quote < ALERT_SCHWELLE);
  const hasAlert = alerts.length > 0;
  const teamAmpel = calcAmpel(data.team_avg_quote);
  const teamColor = teamAmpel === 'rot' ? 'text-red-600' : teamAmpel === 'gelb' ? 'text-amber-600' : 'text-green-600';

  return (
    <div className={`rounded-xl border shadow-sm mb-4 overflow-hidden ${hasAlert ? 'border-red-300' : 'border-gray-200'} bg-white dark:bg-gray-900`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Gift size={14} className="text-yellow-500" />
          <span className="font-semibold text-xs text-gray-700 dark:text-gray-200">Trinkgeld-Quote</span>
          <span className={`text-xs font-bold ${teamColor}`}>{data.team_avg_quote.toFixed(1)}% Ø</span>
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
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 w-12 text-right">{f.trinkgeld_quote.toFixed(1)}%</span>
            </div>
          ))}
          {alerts.map(f => (
            <div key={`alert-${f.fahrer_id}`} className="text-xs text-red-600 dark:text-red-400 font-medium pl-4">
              ⚠ {f.fahrer_name}: Niedrige Trinkgeld-Quote!
            </div>
          ))}
          <div className="pt-1 text-xs text-gray-400 dark:text-gray-500">Ziel ≥{ZIEL}% | absteigend</div>
        </div>
      )}
    </div>
  );
}
