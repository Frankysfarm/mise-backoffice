'use client';
import { useEffect, useState } from 'react';
import { CheckCircle, AlertTriangle, ChevronDown, ChevronUp, Minus, TrendingDown, TrendingUp } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  quote_pct: number;
  delivered: number;
  total: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_pct: number;
  bester_name: string;
  niedrigster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, quote_pct: 98.0, delivered: 22, total: 22, rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, quote_pct: 95.0, delivered: 19, total: 20, rank_delta:  1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, quote_pct: 87.5, delivered: 14, total: 16, rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, quote_pct: 75.0, delivered:  9, total: 12, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_pct: 88.9,
  bester_name: 'Julia F.',
  niedrigster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function fmtPct(v: number): string {
  return `${v.toFixed(1)} %`;
}

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

function DeltaIcon({ delta }: { delta: number }) {
  if (delta > 0) return <TrendingUp   size={11} className="text-green-500" />;
  if (delta < 0) return <TrendingDown size={11} className="text-red-400"   />;
  return               <Minus         size={11} className="text-gray-400"  />;
}

export function DispatchPhase3261AblieferungsquoteRankingBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const params = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/admin/fahrer-ablieferungsquote${params}`);
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
  const alerts = list.filter(f => f.alert_bottom);
  const bester  = list.find(f => f.rang === 1);
  const letzter = list[list.length - 1];

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <CheckCircle size={16} className="text-green-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">
            Ablieferungsquote-Ranking
          </span>
          {d.alert_count > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 rounded-full px-2 py-0.5">
              <AlertTriangle size={10} /> {d.alert_count} Alert
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
              {alerts.map(f => f.fahrer_name).join(', ')} — Niedrige Ablieferungsquote!
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-2">
              <div className="text-gray-500 dark:text-gray-400 font-medium mb-0.5 flex items-center justify-center gap-1">
                <CheckCircle size={10} className="text-green-500" /> Bester
              </div>
              <div className="font-bold text-sm text-green-700 dark:text-green-400">{bester?.fahrer_name ?? '—'}</div>
              <div className="text-xs text-gray-500">{bester ? fmtPct(bester.quote_pct) : '—'}</div>
            </div>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-2">
              <div className="text-gray-500 dark:text-gray-400 font-medium mb-0.5">Team-Ø</div>
              <div className="font-bold text-base text-blue-600 dark:text-blue-400">{fmtPct(d.team_avg_pct)}</div>
              <div className="text-xs text-gray-500">Ø Ablieferung</div>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
              <div className="text-gray-500 dark:text-gray-400 font-medium mb-0.5">Niedrigster</div>
              <div className="font-bold text-sm text-gray-600 dark:text-gray-300">{letzter?.fahrer_name ?? '—'}</div>
              <div className="text-xs text-gray-500">{letzter ? fmtPct(letzter.quote_pct) : '—'}</div>
            </div>
          </div>

          <div className="space-y-2">
            {list.map(f => {
              const cls = ampelCls(f.ampel);
              const barWidth = Math.max(f.quote_pct, f.quote_pct > 0 ? 2 : 0);
              return (
                <div key={f.fahrer_id} className={`rounded-lg border p-3 ${cls.bg}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <RankBadge rang={f.rang} />
                      <span className={`w-2 h-2 rounded-full ${cls.dot}`} />
                      <span className={`font-semibold text-sm ${cls.text}`}>{f.fahrer_name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle size={11} className="text-green-500" />
                      <span className={`font-bold text-sm ${cls.text}`}>{fmtPct(f.quote_pct)}</span>
                      <span className="text-xs text-gray-400">({f.delivered}/{f.total})</span>
                      <DeltaIcon delta={f.rank_delta} />
                      {f.rank_delta !== 0 && (
                        <span className="text-xs text-gray-500">
                          {f.rank_delta > 0 ? `+${f.rank_delta}` : `${f.rank_delta}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${cls.bar}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  {f.alert_bottom && (
                    <div className="mt-1 text-xs text-red-600 dark:text-red-400 font-semibold flex items-center gap-1">
                      <AlertTriangle size={10} /> Niedrige Ablieferungsquote!
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-gray-500 pt-1">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Top 25% (höchste Quote)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Mitte 50%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"   /> Bottom 25% (niedrigste Quote)</span>
          </div>
        </div>
      )}
    </div>
  );
}
