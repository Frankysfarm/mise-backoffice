'use client';
import { useEffect, useState } from 'react';
import { Clock, AlertTriangle, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  quote_pct: number;
  rang: number;
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiData {
  fahrer: FahrerRow[];
  team_durchschnitt: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max Müller',  quote_pct: 92.9, rang: 1, trend_delta:  4.0, ampel: 'gruen' },
    { fahrer_id: 'f2', fahrer_name: 'Sara Koch',   quote_pct: 81.6, rang: 2, trend_delta:  1.0, ampel: 'gelb'  },
    { fahrer_id: 'f3', fahrer_name: 'Tim Becker',  quote_pct: 69.0, rang: 3, trend_delta: -6.0, ampel: 'gelb'  },
    { fahrer_id: 'f4', fahrer_name: 'Lisa Fuchs',  quote_pct: 52.6, rang: 4, trend_delta:  0.0, ampel: 'rot'   },
  ],
  team_durchschnitt: 74.0,
};

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800',         dot: 'bg-red-500',   text: 'text-red-700 dark:text-red-300',     bar: 'bg-red-500'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800', dot: 'bg-amber-400', text: 'text-amber-700 dark:text-amber-300', bar: 'bg-amber-400' };
  return                   { bg: 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800', dot: 'bg-green-500', text: 'text-green-700 dark:text-green-300', bar: 'bg-green-500' };
}

function RankBadge({ rang }: { rang: number }) {
  const colors =
    rang === 1 ? 'bg-yellow-100 text-yellow-700 border-yellow-300' :
    rang === 2 ? 'bg-gray-100 text-gray-600 border-gray-300' :
    rang === 3 ? 'bg-orange-100 text-orange-600 border-orange-300' :
    'bg-white text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600';
  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full border text-xs font-bold ${colors}`}>
      {rang}
    </span>
  );
}

export function DispatchPhase3291PuenktlichkeitRankingBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!locationId) { setData(MOCK); return; }
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-puenktlichkeit?location_id=${locationId}`);
        if (res.ok && active) setData(await res.json());
      } catch {
        if (active) setData(MOCK);
      }
    };
    load();
    const iv = setInterval(load, 30 * 60 * 1000);
    return () => { active = false; clearInterval(iv); };
  }, [locationId]);

  const d = data ?? MOCK;
  const list = [...d.fahrer].sort((a, b) => a.rang - b.rang);
  const total = list.length;
  const cutoff = Math.ceil(total * 0.25);
  const alerts = list.filter(f => f.rang > total - cutoff);
  const bester = list.find(f => f.rang === 1);
  const niedrigster = list[list.length - 1];

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-green-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">
            Pünktlichkeits-Ranking
          </span>
          {alerts.length > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 rounded-full px-2 py-0.5">
              <AlertTriangle size={10} /> {alerts.length} Alert
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {alerts.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 text-red-700 dark:text-red-300 dark:bg-red-950 dark:border-red-800 text-xs font-semibold px-3 py-2">
              <AlertTriangle size={14} />
              {alerts.map(f => f.fahrer_name).join(', ')} — Niedrige Pünktlichkeit!
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 p-2">
              <div className="text-gray-500 dark:text-gray-400 font-medium mb-0.5 flex items-center justify-center gap-1">
                <Clock size={10} className="text-green-500" /> Bester
              </div>
              <div className="font-bold text-sm text-yellow-700 dark:text-yellow-400">{bester?.fahrer_name ?? '—'}</div>
              <div className="text-xs text-gray-500">{bester ? `${bester.quote_pct.toFixed(1)}%` : '—'}</div>
            </div>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-2">
              <div className="text-gray-500 dark:text-gray-400 font-medium mb-0.5">Team-Ø</div>
              <div className="font-bold text-base text-blue-600 dark:text-blue-400">{d.team_durchschnitt.toFixed(1)}%</div>
              <div className="text-xs text-gray-500">Ø heute</div>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
              <div className="text-gray-500 dark:text-gray-400 font-medium mb-0.5">Niedrigster</div>
              <div className="font-bold text-sm text-gray-600 dark:text-gray-300">{niedrigster?.fahrer_name ?? '—'}</div>
              <div className="text-xs text-gray-500">{niedrigster ? `${niedrigster.quote_pct.toFixed(1)}%` : '—'}</div>
            </div>
          </div>

          <div className="space-y-2">
            {list.map(f => {
              const cls = ampelCls(f.ampel);
              const barWidth = Math.max((f.quote_pct / 100) * 100, 2);
              const isAlert = f.rang > total - cutoff;
              return (
                <div key={f.fahrer_id} className={`rounded-lg border p-3 ${cls.bg}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <RankBadge rang={f.rang} />
                      <span className={`w-2 h-2 rounded-full ${cls.dot}`} />
                      <span className={`font-semibold text-sm ${cls.text}`}>{f.fahrer_name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`font-bold text-sm ${cls.text}`}>{f.quote_pct.toFixed(1)}%</span>
                      {f.trend_delta > 0
                        ? <TrendingUp   size={11} className="text-green-500" />
                        : f.trend_delta < 0
                        ? <TrendingDown size={11} className="text-red-400"   />
                        : <Minus        size={11} className="text-gray-400"  />}
                      {f.trend_delta !== 0 && (
                        <span className="text-xs text-gray-500">
                          {f.trend_delta > 0 ? `+${f.trend_delta.toFixed(1)}` : f.trend_delta.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full transition-all ${cls.bar}`} style={{ width: `${barWidth}%` }} />
                  </div>
                  {isAlert && (
                    <div className="mt-1 text-xs text-red-600 dark:text-red-400 font-semibold flex items-center gap-1">
                      <AlertTriangle size={10} /> Niedrige Pünktlichkeit!
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-gray-500 pt-1">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Gut (≥85%)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Mittel (65–84%)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"   /> Niedrig (&lt;65%)</span>
          </div>
        </div>
      )}
    </div>
  );
}
