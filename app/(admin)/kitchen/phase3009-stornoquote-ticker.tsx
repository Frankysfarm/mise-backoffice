'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, XCircle } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  quote_pct: number;
  trend: string;
  trend_delta: number;
  ampel: string;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_durchschnitt: number;
  alert_count: number;
}

const ZIEL_PCT  = 5;
const ALERT_PCT = 15;

function ampelDot(a: string) {
  if (a === 'rot')  return 'bg-red-500';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-green-500';
}

function TrendIcon({ trend }: { trend: string }) {
  // INVERTIERT: fallend=grün (Quote sinkt = besser)
  if (trend === 'fallend')  return <TrendingDown size={11} className="text-green-600" />;
  if (trend === 'steigend') return <TrendingUp   size={11} className="text-red-500"   />;
  return                           <Minus        size={11} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   quote_pct:  0.0, trend: 'fallend',  trend_delta: -3.0, ampel: 'gruen' },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  quote_pct:  0.0, trend: 'fallend',  trend_delta: -5.0, ampel: 'gruen' },
    { fahrer_id: 'f3', fahrer_name: 'Tim B.',   quote_pct: 11.1, trend: 'steigend', trend_delta:  3.1, ampel: 'gelb'  },
    { fahrer_id: 'f4', fahrer_name: 'Julia F.', quote_pct: 16.7, trend: 'steigend', trend_delta:  6.7, ampel: 'rot'   },
  ],
  team_durchschnitt: 7.0,
  alert_count: 1,
};

export function KitchenPhase3009StornoquoteTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-stornoquote?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const sorted   = [...data.fahrer].sort((a, b) => a.quote_pct - b.quote_pct);
  const alerts   = data.fahrer.filter(f => f.quote_pct > ALERT_PCT);
  const hasAlert = alerts.length > 0;
  const teamAmpelText = data.team_durchschnitt <= ZIEL_PCT
    ? 'text-green-600' : data.team_durchschnitt <= ALERT_PCT
    ? 'text-amber-600' : 'text-red-600';

  return (
    <div className={`rounded-xl border shadow-sm mb-3 overflow-hidden ${hasAlert ? 'border-red-300' : 'border-gray-200'} bg-white dark:bg-gray-900`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <XCircle size={14} className="text-red-500" />
          <span className="font-semibold text-xs text-gray-800 dark:text-gray-100">Stornoquote-Ticker</span>
          <span className={`text-xs font-bold ${teamAmpelText}`}>Ø {data.team_durchschnitt.toFixed(1)}%</span>
          {hasAlert && (
            <span className="bg-red-100 text-red-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
              {alerts.length} Alert
            </span>
          )}
        </div>
        {open ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
      </button>

      {open && (
        <div className="px-3 py-2 space-y-1.5">
          {alerts.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded px-2 py-1 text-xs">
              <AlertTriangle size={11} className="text-red-500 shrink-0" />
              <span className="text-red-700 dark:text-red-300 font-medium">
                {f.fahrer_name}: Hohe Stornoquote! ({f.quote_pct.toFixed(1)}%)
              </span>
            </div>
          ))}

          {sorted.map(f => (
            <div key={f.fahrer_id} className="flex items-center justify-between py-0.5">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full inline-block shrink-0 ${ampelDot(f.ampel)}`} />
                <span className="text-xs text-gray-700 dark:text-gray-300">{f.fahrer_name}</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendIcon trend={f.trend} />
                <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{f.quote_pct.toFixed(1)}%</span>
              </div>
            </div>
          ))}

          <div className="pt-1 text-xs text-gray-400 dark:text-gray-500">Ziel ≤{ZIEL_PCT}% | 30-Min-Polling</div>
        </div>
      )}
    </div>
  );
}
