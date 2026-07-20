'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, ChefHat, Clock, Flame, TrendingUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PrepEntry {
  order_id: string;
  bestellnummer: string;
  kunde: string;
  komplexitaet: 1 | 2 | 3; // 1=einfach, 2=mittel, 3=komplex
  prep_time_min: number;
  kochstart_am: string | null;
  status: 'wartend' | 'in_zubereitung' | 'fertig';
  prioritaets_score: number; // 0–100
}

interface ApiData {
  orders: PrepEntry[];
  team_on_time_pct: number;
  avg_komplexitaet: number;
}

const MOCK: ApiData = {
  orders: [
    { order_id: 'p1', bestellnummer: '#1050', kunde: 'Anna W.', komplexitaet: 3, prep_time_min: 18, kochstart_am: new Date(Date.now() - 20 * 60_000).toISOString(), status: 'in_zubereitung', prioritaets_score: 95 },
    { order_id: 'p2', bestellnummer: '#1051', kunde: 'Ben K.', komplexitaet: 2, prep_time_min: 12, kochstart_am: new Date(Date.now() - 5 * 60_000).toISOString(), status: 'in_zubereitung', prioritaets_score: 72 },
    { order_id: 'p3', bestellnummer: '#1052', kunde: 'Cora L.', komplexitaet: 1, prep_time_min: 8, kochstart_am: null, status: 'wartend', prioritaets_score: 60 },
    { order_id: 'p4', bestellnummer: '#1053', kunde: 'Dirk M.', komplexitaet: 2, prep_time_min: 15, kochstart_am: new Date(Date.now() - 2 * 60_000).toISOString(), status: 'in_zubereitung', prioritaets_score: 45 },
  ],
  team_on_time_pct: 82,
  avg_komplexitaet: 2.0,
};

function secsLeft(kochstartIso: string | null, prepMin: number): number | null {
  if (!kochstartIso) return null;
  const fertigAt = new Date(kochstartIso).getTime() + prepMin * 60_000;
  return Math.floor((fertigAt - Date.now()) / 1_000);
}

function fmtMmSs(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sec < 0 ? '-' : ''}${m}:${String(s).padStart(2, '0')}`;
}

function komplexLabel(k: 1 | 2 | 3) {
  return k === 1 ? 'Einfach' : k === 2 ? 'Mittel' : 'Komplex';
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-red-600';
  if (score >= 55) return 'text-amber-600';
  return 'text-matcha-700';
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-red-50 border-red-200';
  if (score >= 55) return 'bg-amber-50 border-amber-200';
  return 'bg-matcha-50 border-matcha-200';
}

export function KitchenPhase2725SmartPrepPrioritaetsCockpit({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [tick, setTick] = useState(0);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const load = () =>
      fetch(`/api/delivery/admin/kitchen-prep-priority?location_id=${locationId ?? ''}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    if (!locationId) { setData(MOCK); return; }
    load();
    const iv = setInterval(load, 25_000);
    return () => clearInterval(iv);
  }, [locationId]);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1_000);
    return () => clearInterval(iv);
  }, []);

  if (!data) return null;

  const sorted = [...data.orders].sort((a, b) => b.prioritaets_score - a.prioritaets_score);
  const criticalCount = sorted.filter(o => o.prioritaets_score >= 80).length;

  return (
    <div className="rounded-xl border border-matcha-200 bg-white shadow-sm mb-3 overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-matcha-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Zap size={16} className={criticalCount > 0 ? 'text-red-500' : 'text-amber-500'} />
          <span className="font-semibold text-sm text-gray-900">Prep-Priorität</span>
          {criticalCount > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-red-600 font-semibold bg-red-50 border border-red-200 rounded-full px-1.5 py-0.5">
              <Flame size={10} /> {criticalCount} kritisch
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-0.5">
            <TrendingUp size={11} />
            <span className={cn('font-semibold', data.team_on_time_pct >= 90 ? 'text-green-600' : data.team_on_time_pct >= 75 ? 'text-amber-600' : 'text-red-600')}>
              {data.team_on_time_pct}% pünktlich
            </span>
          </span>
          <span className="text-gray-300">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-matcha-100 divide-y divide-matcha-50">
          {sorted.length === 0 && (
            <div className="px-4 py-3 text-xs text-gray-400 text-center">Keine aktiven Aufträge</div>
          )}
          {sorted.map(order => {
            const sLeft = secsLeft(order.kochstart_am, order.prep_time_min);
            const isLate = sLeft !== null && sLeft < 0;
            const pct = sLeft !== null
              ? Math.min(100, Math.max(0, Math.round(((order.prep_time_min * 60 - sLeft) / (order.prep_time_min * 60)) * 100)))
              : 0;

            return (
              <div key={order.order_id} className={cn('px-4 py-2.5 flex items-center gap-3 border-l-2', scoreBg(order.prioritaets_score), isLate && 'border-l-red-500', !isLate && order.prioritaets_score >= 55 && 'border-l-amber-400', !isLate && order.prioritaets_score < 55 && 'border-l-matcha-400')}>
                <div className="flex-shrink-0 text-center w-10">
                  <div className={cn('text-base font-black tabular-nums', scoreColor(order.prioritaets_score))}>
                    {order.prioritaets_score}
                  </div>
                  <div className="text-[9px] text-gray-400">Score</div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs font-bold text-gray-800">{order.bestellnummer}</span>
                    <span className="text-xs text-gray-500 truncate">{order.kunde}</span>
                    <span className={cn('text-[10px] font-medium ml-auto px-1 rounded',
                      order.komplexitaet === 3 ? 'bg-red-100 text-red-700' :
                      order.komplexitaet === 2 ? 'bg-amber-100 text-amber-700' :
                      'bg-green-100 text-green-700'
                    )}>
                      {komplexLabel(order.komplexitaet)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {sLeft !== null && (
                      <span className={cn('text-xs font-mono font-bold tabular-nums', isLate ? 'text-red-600 animate-pulse' : 'text-gray-700')}>
                        {fmtMmSs(sLeft)}
                      </span>
                    )}
                    {order.status === 'wartend' && (
                      <span className="text-xs text-blue-500 font-medium flex items-center gap-0.5">
                        <Clock size={10} /> Wartet auf Start
                      </span>
                    )}
                    {sLeft !== null && (
                      <div className="flex-1 h-1 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-1000',
                            isLate ? 'bg-red-500' : order.prioritaets_score >= 55 ? 'bg-amber-400' : 'bg-matcha-500'
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-shrink-0">
                  {order.status === 'in_zubereitung' ? (
                    <ChefHat size={14} className={isLate ? 'text-red-500' : 'text-matcha-600'} />
                  ) : order.status === 'wartend' ? (
                    <Clock size={14} className="text-blue-400" />
                  ) : (
                    <AlertTriangle size={14} className="text-amber-500" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
