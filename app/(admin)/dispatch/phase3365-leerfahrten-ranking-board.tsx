'use client';
import { useEffect, useState } from 'react';
import { Car, AlertTriangle, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  leerfahrten_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_leerfahrten_pct: number;
  bester_name: string;
  letzter_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, leerfahrten_pct:  5, rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, leerfahrten_pct: 12, rank_delta:  1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, leerfahrten_pct: 22, rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, leerfahrten_pct: 38, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_leerfahrten_pct: 19.25,
  bester_name: 'Julia F.',
  letzter_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800',         dot: 'bg-red-500',    text: 'text-red-700 dark:text-red-300',     bar: 'bg-red-500'    };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800', dot: 'bg-amber-400',  text: 'text-amber-700 dark:text-amber-300', bar: 'bg-amber-400'  };
  return                   { bg: 'bg-orange-50 border-orange-200 dark:bg-orange-950 dark:border-orange-800', dot: 'bg-orange-500', text: 'text-orange-700 dark:text-orange-300', bar: 'bg-orange-500' };
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
  if (delta < 0) return <TrendingUp   size={11} className="text-green-500" />;
  if (delta > 0) return <TrendingDown size={11} className="text-red-400"   />;
  return               <Minus         size={11} className="text-gray-400"  />;
}

export function DispatchPhase3365LeerfahrtenRankingBoard({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!locationId) { setData(MOCK); return; }
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-leerfahrten-ranking?location_id=${locationId}`);
        if (res.ok && active) setData(await res.json());
      } catch {
        if (active) setData(MOCK);
      }
    };
    load();
    const iv = setInterval(load, 30 * 60 * 1000);
    return () => { active = false; clearInterval(iv); };
  }, [locationId]);

  const d       = data ?? MOCK;
  const list    = [...d.fahrer].sort((a, b) => a.rang - b.rang);
  const maxPct  = Math.max(...list.map(f => f.leerfahrten_pct), 1);
  const alerts  = list.filter(f => f.alert_bottom);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Car size={16} className="text-orange-600" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Leerfahrten-Quote Ranking</span>
          {alerts.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 rounded-full px-2 py-0.5">
              <AlertTriangle size={10} /> {alerts.length}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {alerts.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 text-red-700 dark:text-red-300 dark:bg-red-950 dark:border-red-800 text-xs font-semibold px-3 py-2">
              <AlertTriangle size={12} />
              {alerts.map(f => f.fahrer_name).join(', ')} — Hohe Leerfahrten-Quote!
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 px-2 py-2">
              <div className="text-xs text-gray-500 dark:text-gray-400">Bester</div>
              <div className="text-sm font-bold text-orange-600 truncate">{d.bester_name}</div>
              <div className="text-xs text-gray-500">{list[0]?.leerfahrten_pct ?? 0}%</div>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 px-2 py-2">
              <div className="text-xs text-gray-500 dark:text-gray-400">Team-Ø</div>
              <div className="text-sm font-bold text-gray-700 dark:text-gray-200">{d.team_avg_leerfahrten_pct}%</div>
              <div className="text-xs text-gray-400">Ziel &lt;10%</div>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 px-2 py-2">
              <div className="text-xs text-gray-500 dark:text-gray-400">Höchster</div>
              <div className="text-sm font-bold text-red-600 truncate">{d.letzter_name}</div>
              <div className="text-xs text-gray-500">{list[list.length - 1]?.leerfahrten_pct ?? 0}%</div>
            </div>
          </div>

          <div className="space-y-2">
            {list.map(f => {
              const cls = ampelCls(f.ampel);
              const barW = maxPct > 0 ? (f.leerfahrten_pct / maxPct) * 100 : 0;
              return (
                <div key={f.fahrer_id} className={`rounded-lg border px-3 py-2 ${cls.bg}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <RankBadge rang={f.rang} />
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cls.dot}`} />
                      <span className={`text-sm font-medium truncate ${cls.text}`}>{f.fahrer_name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className={`text-sm font-bold ${cls.text}`}>{f.leerfahrten_pct}%</span>
                      <DeltaIcon delta={f.rank_delta} />
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div className={`h-full rounded-full ${cls.bar} transition-all`} style={{ width: `${barW}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between text-xs text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-700">
            <span>Rang 1 = niedrigste Leerfahrten-Quote = bester</span>
            <span>{d.gesamt} Fahrer</span>
          </div>
        </div>
      )}
    </div>
  );
}
