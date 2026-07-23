'use client';
import { useEffect, useState } from 'react';
import { Clock, AlertTriangle, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  puenktlich_pct: number;
  puenktlich: number;
  gesamt: number;
  rang: number;
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
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, puenktlich_pct: 95, puenktlich: 19, gesamt: 20, rank_delta:  1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, puenktlich_pct: 85, puenktlich: 17, gesamt: 20, rank_delta:  0, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, puenktlich_pct: 72, puenktlich: 13, gesamt: 18, rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, puenktlich_pct: 55, puenktlich:  6, gesamt: 11, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_pct: 76.8,
  bester_name: 'Julia F.',
  niedrigster_name: 'Tim B.',
  alert_count: 1,
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

export function DispatchPhase3311SchichtPuenktlichkeitRankingBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!locationId) { setData(MOCK); return; }
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-schicht-puenktlichkeit?location_id=${locationId}`);
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
  const bester = list.find(f => f.rang === 1);
  const niedrigster = list[list.length - 1];
  const maxPct = Math.max(...list.map(f => f.puenktlich_pct), 1);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-green-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">
            Schicht-Pünktlichkeit-Ranking
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
              {alerts.map(f => f.fahrer_name).join(', ')} — Unpünktlich!
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 p-2">
              <div className="text-gray-500 dark:text-gray-400 font-medium mb-0.5 flex items-center justify-center gap-1">
                <Clock size={10} className="text-green-500" /> Bester
              </div>
              <div className="font-bold text-sm text-yellow-700 dark:text-yellow-400">{bester?.fahrer_name ?? '—'}</div>
              <div className="text-xs text-gray-500">{bester ? `${bester.puenktlich_pct}%` : '—'}</div>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
              <div className="text-gray-500 dark:text-gray-400 font-medium mb-0.5">Team-Ø</div>
              <div className="font-bold text-sm text-gray-700 dark:text-gray-200">{d.team_avg_pct}%</div>
              <div className="text-xs text-gray-400">Ziel ≥90%</div>
            </div>
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-2">
              <div className="text-gray-500 dark:text-gray-400 font-medium mb-0.5">Niedrigster</div>
              <div className="font-bold text-sm text-red-600 dark:text-red-400">{niedrigster?.fahrer_name ?? '—'}</div>
              <div className="text-xs text-gray-500">{niedrigster ? `${niedrigster.puenktlich_pct}%` : '—'}</div>
            </div>
          </div>

          <div className="space-y-2">
            {list.map(f => {
              const cls = ampelCls(f.ampel);
              const barW = maxPct > 0 ? Math.round((f.puenktlich_pct / maxPct) * 100) : 0;
              return (
                <div key={f.fahrer_id} className={`rounded-lg border p-3 ${cls.bg}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <RankBadge rang={f.rang} />
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cls.dot}`} />
                      <span className={`text-sm font-semibold ${cls.text}`}>{f.fahrer_name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm font-bold ${cls.text}`}>{f.puenktlich_pct}%</span>
                      {f.rank_delta > 0
                        ? <TrendingUp   size={12} className="text-green-500" />
                        : f.rank_delta < 0
                        ? <TrendingDown size={12} className="text-red-400"   />
                        : <Minus        size={12} className="text-gray-400"  />}
                      {f.rank_delta !== 0 && (
                        <span className={`text-xs ${f.rank_delta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {f.rank_delta > 0 ? '+' : ''}{f.rank_delta}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full transition-all ${cls.bar}`} style={{ width: `${barW}%` }} />
                  </div>
                  <div className="mt-1 text-xs text-gray-400">{f.puenktlich} von {f.gesamt} Schichten pünktlich</div>
                </div>
              );
            })}
          </div>

          <div className="pt-1 border-t border-gray-100 dark:border-gray-700 flex justify-between text-xs text-gray-400">
            <span>Team-Ø: {d.team_avg_pct}% Pünktlichkeit</span>
            <span>Ziel ≥90%</span>
          </div>
        </div>
      )}
    </div>
  );
}
