'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus, Gift } from 'lucide-react';

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  trinkgeld_quote: number;
  quote_vw: number;
  trend: string;
  trend_delta: number;
  ampel: string;
  alert_niedrig: boolean;
}

interface ApiData {
  fahrer: FahrerEntry[];
  team_avg_quote: number;
  team_avg_quote_vw: number;
  alert_count: number;
}

const ZIEL = 30;
const ALERT_SCHWELLE = 10;
const MAX_BAR = 50;

function calcAmpel(q: number): string {
  if (q >= 10) return 'gruen';
  if (q >= 5)  return 'gelb';
  return 'rot';
}

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',    dot: 'bg-red-500',   text: 'text-red-700',   bar: 'bg-red-500'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700', bar: 'bg-amber-400' };
  return                   { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-700', bar: 'bg-green-500' };
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'steigend') return <TrendingUp   size={12} className="text-green-600" />;
  if (trend === 'fallend')  return <TrendingDown size={12} className="text-red-500"   />;
  return                           <Minus        size={12} className="text-gray-400"  />;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'd1', fahrer_name: 'Julia F.', trinkgeld_quote: 12.7, quote_vw: 11.2, trend: 'steigend', trend_delta:  1.5, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'd2', fahrer_name: 'Max M.',   trinkgeld_quote:  9.8, quote_vw: 10.3, trend: 'fallend',  trend_delta: -0.5, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'd3', fahrer_name: 'Sara K.',  trinkgeld_quote:  6.4, quote_vw:  5.9, trend: 'steigend', trend_delta:  0.5, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'd4', fahrer_name: 'Tim B.',   trinkgeld_quote:  3.1, quote_vw:  4.8, trend: 'fallend',  trend_delta: -1.7, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_quote: 8.0,
  team_avg_quote_vw: 8.1,
  alert_count: 1,
};

export function DispatchPhase2946TrinkgeldQuoteBoard({ locationId }: { locationId: string | null }) {
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

  const enriched  = data.fahrer.map(f => ({ ...f, ampel: calcAmpel(f.trinkgeld_quote) }));
  const sorted    = [...enriched].sort((a, b) => b.trinkgeld_quote - a.trinkgeld_quote);
  const alerts    = enriched.filter(f => f.trinkgeld_quote < ALERT_SCHWELLE);
  const hasAlert  = alerts.length > 0;
  const best      = sorted[0]?.trinkgeld_quote ?? 0;
  const teamAmpel = calcAmpel(data.team_avg_quote);
  const { text: teamText } = ampelCls(teamAmpel);
  const zielPct   = (ZIEL / MAX_BAR) * 100;

  return (
    <div className={`rounded-xl border shadow-sm mb-4 overflow-hidden ${hasAlert ? 'border-red-300' : 'border-gray-200'} bg-white dark:bg-gray-900`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Gift size={16} className="text-yellow-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Trinkgeld-Quote-Board</span>
          {hasAlert && <span className="ml-2 bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">{alerts.length} Alert</span>}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="px-4 py-3 space-y-3">
          {alerts.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-sm">
              <AlertTriangle size={14} className="text-red-500 shrink-0" />
              <span className="text-red-700 dark:text-red-300 font-medium">
                {f.fahrer_name}: Niedrige Trinkgeld-Quote! ({f.trinkgeld_quote.toFixed(1)}%)
              </span>
            </div>
          ))}

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Team-Ø',  value: `${data.team_avg_quote.toFixed(1)} %`, cls: teamText },
              { label: 'Bester',  value: `${best.toFixed(1)} %`,                cls: 'text-green-600' },
              { label: 'Ziel',    value: `≥${ZIEL} %`,                          cls: 'text-gray-600 dark:text-gray-400' },
            ].map(k => (
              <div key={k.label} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-500 dark:text-gray-400">{k.label}</div>
                <div className={`text-sm font-bold ${k.cls}`}>{k.value}</div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            {sorted.map(f => {
              const { bg, dot, text, bar } = ampelCls(f.ampel);
              const pct = Math.min(100, (f.trinkgeld_quote / MAX_BAR) * 100);
              return (
                <div key={f.fahrer_id} className={`rounded-lg border p-2 ${bg} dark:bg-transparent dark:border-gray-700`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />
                      <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{f.fahrer_name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendIcon trend={f.trend} />
                      <span className={`text-xs font-bold ${text}`}>{f.trinkgeld_quote.toFixed(1)} %</span>
                    </div>
                  </div>
                  <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-visible">
                    <div className={`absolute top-0 left-0 h-2 rounded-full ${bar}`} style={{ width: `${pct}%` }} />
                    <div className="absolute top-[-2px] h-4 w-0.5 bg-gray-600 dark:bg-gray-300 opacity-60" style={{ left: `${zielPct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 text-xs text-gray-500 dark:text-gray-400 pt-1">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />≥10%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />5–9%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />&lt;5%</span>
            <span className="text-gray-400">| Ziel ≥{ZIEL}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
