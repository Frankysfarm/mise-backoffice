'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Zap, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface RankEntry {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  stopps_pro_stunde: number;
  total_stopps: number;
  aktive_stunden: number;
  rank_delta: number;
  ampel: string;
  alert_bottom: boolean;
}

interface ApiData {
  fahrer: RankEntry[];
  team_avg_stopps_h: number;
  bester_name: string;
  letzter_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 1, stopps_pro_stunde: 4.2, total_stopps: 8, aktive_stunden: 1.9, rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, stopps_pro_stunde: 3.5, total_stopps: 7, aktive_stunden: 2.0, rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, stopps_pro_stunde: 2.8, total_stopps: 5, aktive_stunden: 1.8, rank_delta:  1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, stopps_pro_stunde: 1.5, total_stopps: 3, aktive_stunden: 2.0, rank_delta: -1, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_stopps_h: 3.0,
  bester_name: 'Max M.',
  letzter_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function ampelCls(a: string) {
  if (a === 'rot')  return { bg: 'bg-red-50 border-red-200',     dot: 'bg-red-500',   text: 'text-red-700',   bar: 'bg-red-500'   };
  if (a === 'gelb') return { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-400', text: 'text-amber-700', bar: 'bg-amber-400' };
  return                   { bg: 'bg-green-50 border-green-200', dot: 'bg-green-500', text: 'text-green-700', bar: 'bg-green-500' };
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
  if (delta < 0) return <TrendingUp  size={11} className="text-green-500" title={`+${Math.abs(delta)} Ränge verbessert`} />;
  if (delta > 0) return <TrendingDown size={11} className="text-red-400"  title={`${delta} Ränge gefallen`} />;
  return               <Minus        size={11} className="text-gray-400" />;
}

export function DispatchPhase3096StoppEffizienzRankingBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    if (!locationId) { setData(MOCK); return; }
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-stopp-effizienz-ranking?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    load();
    const t = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  const list    = data?.fahrer ?? [];
  const teamAvg = data?.team_avg_stopps_h ?? 0;
  const alerts  = list.filter(f => f.alert_bottom);
  const gesamt  = data?.gesamt ?? list.length;
  const bester  = list.find(f => f.rang === 1);
  const letzter = list.find(f => f.rang === gesamt) ?? list[list.length - 1];
  const maxSH   = Math.max(...list.map(f => f.stopps_pro_stunde), 1);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-yellow-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">
            Stopp-Effizienz-Ranking heute
          </span>
          {(data?.alert_count ?? 0) > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 rounded-full px-2 py-0.5">
              <AlertTriangle size={10} /> {data?.alert_count} Alert
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {/* Alert-Banner */}
          {alerts.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-2">
              <AlertTriangle size={14} />
              {alerts.map(f => f.fahrer_name).join(', ')} — Niedrigste Stopp-Effizienz!
            </div>
          )}

          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 p-2">
              <div className="text-gray-500 dark:text-gray-400 font-medium mb-0.5 flex items-center justify-center gap-1">
                <Zap size={10} className="text-yellow-500" /> Bester
              </div>
              <div className="font-bold text-sm text-yellow-700 dark:text-yellow-400">{bester?.fahrer_name ?? '—'}</div>
              <div className="text-xs text-gray-500">{bester?.stopps_pro_stunde?.toFixed(1) ?? '—'} Stp/h</div>
            </div>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-2">
              <div className="text-gray-500 dark:text-gray-400 font-medium mb-0.5">Team-Ø</div>
              <div className="font-bold text-base text-blue-600 dark:text-blue-400">{teamAvg.toFixed(1)}</div>
              <div className="text-xs text-gray-500">Stopps/h</div>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
              <div className="text-gray-500 dark:text-gray-400 font-medium mb-0.5">Letzter</div>
              <div className="font-bold text-sm text-gray-600 dark:text-gray-300">{letzter?.fahrer_name ?? '—'}</div>
              <div className="text-xs text-gray-500">{letzter?.stopps_pro_stunde?.toFixed(1) ?? '—'} Stp/h</div>
            </div>
          </div>

          {/* Fahrerliste */}
          <div className="space-y-2">
            {list.map(f => {
              const cls  = ampelCls(f.ampel);
              const barW = Math.round((f.stopps_pro_stunde / maxSH) * 100);
              return (
                <div key={f.fahrer_id} className={`rounded-lg border p-3 ${cls.bg}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <RankBadge rang={f.rang} />
                      <span className={`w-2 h-2 rounded-full ${cls.dot}`} />
                      <span className={`font-semibold text-sm ${cls.text}`}>{f.fahrer_name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Zap size={11} className="text-gray-400" />
                      <span className={`font-bold text-sm ${cls.text}`}>{f.stopps_pro_stunde.toFixed(1)} Stp/h</span>
                      <DeltaIcon delta={f.rank_delta} />
                      {f.rank_delta !== 0 && (
                        <span className="text-xs text-gray-500">
                          {f.rank_delta < 0 ? `+${Math.abs(f.rank_delta)}` : `-${f.rank_delta}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full transition-all ${cls.bar}`} style={{ width: `${barW}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>{f.total_stopps} Stopps</span>
                    <span>{f.aktive_stunden.toFixed(1)} h aktiv</span>
                  </div>
                  {f.alert_bottom && (
                    <div className="mt-1 text-xs text-red-600 font-semibold flex items-center gap-1">
                      <AlertTriangle size={10} /> Niedrigste Stopp-Effizienz!
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legende */}
          <div className="flex flex-wrap gap-3 text-xs text-gray-500 pt-1">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Top 25%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Mitte 50%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"   /> Bottom 25%</span>
          </div>
        </div>
      )}
    </div>
  );
}
