'use client';

import { useEffect, useState } from 'react';
import { Clock, Timer, ChefHat, Zap, WifiOff, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderCountdown {
  order_id: string;
  order_nr: string;
  status: string;
  elapsed_sec: number;
  target_sec: number;
  remaining_sec: number;
  station: string;
  priority: 'kritisch' | 'hoch' | 'mittel' | 'niedrig' | 'ok' | 'fertig';
  fahrer_wartet: boolean;
}

interface ApiData {
  orders: OrderCountdown[];
  timing_score: number;
  on_time_pct: number;
  avg_prep_min: number;
  ueberfaellig: number;
  updated_at: string;
}

const STATION_COLORS: Record<string, string> = {
  Pizza:  'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  Grill:  'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  Pasta:  'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  Salat:  'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  Sonstiges: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const PRIORITY_CONFIG = {
  kritisch: { border: 'border-red-500',     bg: 'bg-red-50 dark:bg-red-950/40',     text: 'text-red-600 dark:text-red-400',     label: 'Kritisch',  ring: 'bg-red-500'     },
  hoch:     { border: 'border-orange-400',  bg: 'bg-orange-50 dark:bg-orange-950/40', text: 'text-orange-600 dark:text-orange-400', label: 'Hoch',    ring: 'bg-orange-400'  },
  mittel:   { border: 'border-amber-400',   bg: 'bg-amber-50 dark:bg-amber-950/40',  text: 'text-amber-600 dark:text-amber-400',  label: 'Mittel',   ring: 'bg-amber-400'   },
  niedrig:  { border: 'border-yellow-300',  bg: 'bg-yellow-50 dark:bg-yellow-950/40',text: 'text-yellow-600 dark:text-yellow-400',label: 'Niedrig',  ring: 'bg-yellow-300'  },
  ok:       { border: 'border-green-300',   bg: 'bg-green-50 dark:bg-green-950/40',  text: 'text-green-600 dark:text-green-400',  label: 'OK',       ring: 'bg-green-400'   },
  fertig:   { border: 'border-gray-200',    bg: 'bg-gray-50 dark:bg-gray-800/40',    text: 'text-gray-400 dark:text-gray-500',    label: 'Fertig',   ring: 'bg-gray-300'    },
};

function computePriority(remaining_sec: number, fahrer_wartet: boolean): OrderCountdown['priority'] {
  if (remaining_sec <= 0)   return 'kritisch';
  if (fahrer_wartet)        return 'hoch';
  if (remaining_sec <= 120) return 'hoch';
  if (remaining_sec <= 300) return 'mittel';
  if (remaining_sec <= 600) return 'niedrig';
  return 'ok';
}

function fmtMmSs(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sec < 0 ? '-' : ''}${m}:${String(s).padStart(2, '0')}`;
}

const NOW = new Date();
const MOCK_DATA: ApiData = {
  timing_score: 82,
  on_time_pct: 87,
  avg_prep_min: 14,
  ueberfaellig: 2,
  updated_at: NOW.toISOString(),
  orders: [
    { order_id: 'o1', order_nr: '0112', status: 'in_zubereitung', elapsed_sec: 920, target_sec: 900, remaining_sec: -20, station: 'Pizza',  priority: 'kritisch', fahrer_wartet: true  },
    { order_id: 'o2', order_nr: '0113', status: 'in_zubereitung', elapsed_sec: 780, target_sec: 900, remaining_sec: 120, station: 'Grill',  priority: 'hoch',     fahrer_wartet: false },
    { order_id: 'o3', order_nr: '0114', status: 'in_zubereitung', elapsed_sec: 500, target_sec: 900, remaining_sec: 400, station: 'Pasta',  priority: 'mittel',   fahrer_wartet: false },
    { order_id: 'o4', order_nr: '0115', status: 'bestätigt',      elapsed_sec: 120, target_sec: 900, remaining_sec: 780, station: 'Salat',  priority: 'niedrig',  fahrer_wartet: false },
    { order_id: 'o5', order_nr: '0116', status: 'bestätigt',      elapsed_sec:  60, target_sec: 900, remaining_sec: 840, station: 'Pizza',  priority: 'ok',       fahrer_wartet: false },
  ],
};

export function KitchenPhase4715SmartTimingCountdownFarbkodierungV13({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const params = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/admin/smart-timing-countdown${params}`);
        if (!res.ok) throw new Error('fetch failed');
        const json: ApiData = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(MOCK_DATA);
      }
    }
    load();
    const iv = setInterval(load, 15_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  const d = data ?? MOCK_DATA;

  const elapsed = tick;
  const orders = [...d.orders]
    .map((o) => ({ ...o, remaining_sec: o.remaining_sec - elapsed, priority: computePriority(o.remaining_sec - elapsed, o.fahrer_wartet) }))
    .sort((a, b) => a.remaining_sec - b.remaining_sec);

  const kritisch = orders.filter((o) => o.priority === 'kritisch' || o.priority === 'hoch');
  const scoreColor = d.timing_score >= 85 ? 'text-green-600 dark:text-green-400' : d.timing_score >= 70 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';

  if (error) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 flex items-center gap-2 text-gray-400">
        <WifiOff className="w-4 h-4" /><span className="text-xs">Countdown nicht verfügbar</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-gray-900 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm font-bold text-gray-800 dark:text-gray-200">Smart-Timing V13</span>
        </div>
        <div className={cn('text-sm font-extrabold tabular-nums', scoreColor)}>
          Score {d.timing_score}
        </div>
      </div>

      {kritisch.length > 0 && (
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 animate-pulse" />
          <span className="text-xs font-semibold text-red-700 dark:text-red-300">
            {kritisch.length} Bestellung{kritisch.length > 1 ? 'en' : ''} kritisch / Fahrer wartet
          </span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/40 p-2">
          <div className="text-[10px] text-indigo-500 dark:text-indigo-400">Pünktlichkeit</div>
          <div className="text-base font-extrabold text-indigo-700 dark:text-indigo-300 tabular-nums">{d.on_time_pct}%</div>
        </div>
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 p-2">
          <div className="text-[10px] text-amber-500 dark:text-amber-400">Ø Prep</div>
          <div className="text-base font-extrabold text-amber-700 dark:text-amber-300 tabular-nums">{d.avg_prep_min} Min</div>
        </div>
        <div className="rounded-lg bg-red-50 dark:bg-red-950/40 p-2">
          <div className="text-[10px] text-red-500 dark:text-red-400">Überfällig</div>
          <div className="text-base font-extrabold text-red-700 dark:text-red-300 tabular-nums">{d.ueberfaellig}</div>
        </div>
      </div>

      <div className="space-y-1.5">
        {orders.map((o) => {
          const cfg = PRIORITY_CONFIG[o.priority];
          const stationCls = STATION_COLORS[o.station] ?? STATION_COLORS.Sonstiges;
          const progressPct = Math.max(0, Math.min(100, (o.elapsed_sec / o.target_sec) * 100));
          return (
            <div key={o.order_id} className={cn('rounded-xl border-l-4 px-3 py-2', cfg.border, cfg.bg)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn('w-1.5 h-1.5 rounded-full', cfg.ring)} />
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">#{o.order_nr}</span>
                  <span className={cn('text-[9px] px-1.5 py-0.5 rounded-md font-medium', stationCls)}>{o.station}</span>
                  {o.fahrer_wartet && (
                    <span className="flex items-center gap-0.5 text-[9px] text-orange-600 dark:text-orange-400">
                      <Zap className="w-2.5 h-2.5" />Wartet
                    </span>
                  )}
                </div>
                <span className={cn('text-sm font-extrabold tabular-nums', cfg.text)}>
                  {fmtMmSs(o.remaining_sec)}
                </span>
              </div>
              <div className="mt-1.5 h-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', cfg.ring)}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
        {(['ok', 'niedrig', 'mittel', 'hoch', 'kritisch'] as const).map((p) => (
          <div key={p} className="flex items-center gap-1">
            <div className={cn('w-2 h-2 rounded-full', PRIORITY_CONFIG[p].ring)} />
            <span className="text-[9px] text-gray-500 dark:text-gray-400">{PRIORITY_CONFIG[p].label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
