'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Timer, ChevronDown, ChevronUp, AlertCircle, Flame } from 'lucide-react';

interface Order {
  id: string;
  status?: string;
  created_at?: string;
  items?: { name?: string; product_name?: string }[];
}

interface Props {
  orders: Order[];
}

interface KochzeitEntry {
  id: string;
  label: string;
  minutenInPrep: number;
  stufe: 'ok' | 'warn' | 'kritisch';
}

const PREP_STATUSES = new Set(['accepted', 'preparing', 'in_progress', 'in_zubereitung', 'angenommen']);
const WARN_MIN = 15;
const CRIT_MIN = 25;

function stufeColor(stufe: KochzeitEntry['stufe']) {
  if (stufe === 'kritisch') return 'text-red-400';
  if (stufe === 'warn') return 'text-amber-400';
  return 'text-green-400';
}

function stufeBg(stufe: KochzeitEntry['stufe']) {
  if (stufe === 'kritisch') return 'bg-red-500';
  if (stufe === 'warn') return 'bg-amber-400';
  return 'bg-green-500';
}

function formatMin(min: number) {
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

export function KitchenPhase2045KritischeKochzeitAmpel({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const { entries, kritischCount } = useMemo(() => {
    const now = Date.now();
    const list: KochzeitEntry[] = [];

    for (const order of orders) {
      if (!PREP_STATUSES.has(order.status ?? '')) continue;
      if (!order.created_at) continue;

      const minutes = Math.floor((now - new Date(order.created_at).getTime()) / 60_000);
      const stufe: KochzeitEntry['stufe'] =
        minutes >= CRIT_MIN ? 'kritisch' : minutes >= WARN_MIN ? 'warn' : 'ok';

      const firstItem = (order.items ?? [])[0];
      const label = firstItem?.product_name ?? firstItem?.name ?? `#${order.id.slice(-4)}`;

      list.push({ id: order.id, label, minutenInPrep: minutes, stufe });
    }

    list.sort((a, b) => b.minutenInPrep - a.minutenInPrep);

    return { entries: list.slice(0, 8), kritischCount: list.filter(e => e.stufe === 'kritisch').length };
  }, [orders]);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-100 hover:bg-gray-800 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-orange-400" />
          Kritische Kochzeit-Ampel
          {kritischCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-red-900 text-red-300">
              {kritischCount} kritisch
            </span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {kritischCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-950 border border-red-800 px-3 py-2 text-xs text-red-300">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {kritischCount} Bestellung{kritischCount > 1 ? 'en' : ''} seit über {CRIT_MIN} Min in Zubereitung!
            </div>
          )}

          {entries.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-2">Keine aktiven Zubereitungen</p>
          ) : (
            <div className="space-y-2">
              {entries.map(e => (
                <div key={e.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-gray-200 truncate max-w-[65%]">
                      {e.stufe === 'kritisch' && <Flame className="w-3 h-3 text-red-400 flex-shrink-0" />}
                      <span className="truncate">{e.label}</span>
                    </span>
                    <span className={cn('font-semibold', stufeColor(e.stufe))}>
                      {formatMin(e.minutenInPrep)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-700 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', stufeBg(e.stufe))}
                      style={{ width: `${Math.min((e.minutenInPrep / CRIT_MIN) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="rounded-lg bg-gray-800 px-2 py-1.5 text-center">
              <div className="text-sm font-bold text-green-400">{entries.filter(e => e.stufe === 'ok').length}</div>
              <div className="text-[10px] text-gray-500">OK (&lt;{WARN_MIN}m)</div>
            </div>
            <div className="rounded-lg bg-gray-800 px-2 py-1.5 text-center">
              <div className="text-sm font-bold text-amber-400">{entries.filter(e => e.stufe === 'warn').length}</div>
              <div className="text-[10px] text-gray-500">Warn ({WARN_MIN}–{CRIT_MIN}m)</div>
            </div>
            <div className="rounded-lg bg-gray-800 px-2 py-1.5 text-center">
              <div className="text-sm font-bold text-red-400">{kritischCount}</div>
              <div className="text-[10px] text-gray-500">Kritisch (&gt;{CRIT_MIN}m)</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
