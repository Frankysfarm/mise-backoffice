'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  auslastung_pct: number;
  trend: string;
  ampel: string;
  alert_gering: boolean;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_pct: number;
  alert_count: number;
}

const ZIEL_PCT  = 75;
const ALERT_PCT = 50;

function ampelDot(a: string) {
  if (a === 'rot')  return 'bg-red-500';
  if (a === 'gelb') return 'bg-amber-400';
  return 'bg-green-500';
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={11} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={11} className="text-red-500"   />;
  return                           <Minus        size={11} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', auslastung_pct: 88.3, trend: 'steigend', ampel: 'gruen', alert_gering: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   auslastung_pct: 78.2, trend: 'stabil',   ampel: 'gruen', alert_gering: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  auslastung_pct: 65.4, trend: 'fallend',  ampel: 'gelb',  alert_gering: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   auslastung_pct: 45.7, trend: 'fallend',  ampel: 'rot',   alert_gering: true  },
  ],
  team_avg_pct: 69.4,
  alert_count: 1,
};

export function KitchenPhase3054WochenauslastungTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-wochenauslastung?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return null;

  const sorted   = [...data.fahrer].sort((a, b) => b.auslastung_pct - a.auslastung_pct);
  const alerts   = data.fahrer.filter(f => f.alert_gering);
  const hasAlert = alerts.length > 0;
  const teamAmpelCls = data.team_avg_pct >= ZIEL_PCT
    ? 'text-green-600'
    : data.team_avg_pct >= ALERT_PCT
      ? 'text-amber-600'
      : 'text-red-600';

  return (
    <div className={`rounded-xl border shadow-sm mb-4 overflow-hidden ${hasAlert ? 'border-red-300' : 'border-gray-200'} bg-white dark:bg-gray-900`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-blue-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Wochenauslastung</span>
          <span className={`text-xs font-bold ${teamAmpelCls}`}>
            Team-Ø {data.team_avg_pct.toFixed(1)} %
          </span>
          {hasAlert && <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">{alerts.length} Alert</span>}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="px-4 py-3 space-y-2">
          {alerts.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-1.5 text-xs">
              <AlertTriangle size={13} className="text-red-500 shrink-0" />
              <span className="text-red-700 dark:text-red-300 font-medium">
                {f.fahrer_name}: Geringe Wochenauslastung! ({f.auslastung_pct.toFixed(1)} %)
              </span>
            </div>
          ))}

          <div className="space-y-1.5">
            {sorted.map(f => (
              <div key={f.fahrer_id} className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-800 last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${ampelDot(f.ampel)}`} />
                  <span className="text-xs text-gray-700 dark:text-gray-300">{f.fahrer_name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <TrendIcon trend={f.trend} />
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 tabular-nums">
                    {f.auslastung_pct.toFixed(1)} %
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="text-xs text-gray-400 dark:text-gray-500 pt-1">
            Ziel ≥{ZIEL_PCT} % · Mo–So · 30-Min-Polling
          </div>
        </div>
      )}
    </div>
  );
}
