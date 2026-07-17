'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Timer, ChevronDown, ChevronUp, Zap } from 'lucide-react';

interface Order {
  id: string;
  status?: string;
  created_at?: string;
  promised_at?: string;
  items?: { name?: string; product_name?: string }[];
}

interface Props {
  orders: Order[];
  className?: string;
}

type Stufe = 'ok' | 'warn' | 'kritisch' | 'ueberfaellig';

interface Row {
  id: string;
  label: string;
  warteMin: number;
  stufe: Stufe;
  etaMin: number | null;
}

const WARN_MIN = 10;
const CRIT_MIN = 18;
const OVER_MIN = 25;

const ACTIVE = new Set(['accepted', 'preparing', 'in_progress', 'in_zubereitung', 'angenommen']);

const STUFE_META: Record<Stufe, { bar: string; badge: string; label: string }> = {
  ok:          { bar: 'bg-green-500',  badge: 'bg-green-900 text-green-300',  label: 'OK'         },
  warn:        { bar: 'bg-amber-400',  badge: 'bg-amber-900 text-amber-300',  label: 'Warnung'    },
  kritisch:    { bar: 'bg-orange-500', badge: 'bg-orange-900 text-orange-300', label: 'Kritisch'  },
  ueberfaellig:{ bar: 'bg-red-500',   badge: 'bg-red-900 text-red-300',       label: 'Überfällig' },
};

function getStufe(min: number): Stufe {
  if (min >= OVER_MIN) return 'ueberfaellig';
  if (min >= CRIT_MIN) return 'kritisch';
  if (min >= WARN_MIN) return 'warn';
  return 'ok';
}

export function KitchenPhase2046SmartTimingFarbkodierungsLiveMatrix({ orders, className }: Props) {
  const [open, setOpen] = useState(true);

  const { rows, counts } = useMemo(() => {
    const now = Date.now();
    const list: Row[] = [];

    for (const o of orders) {
      if (!ACTIVE.has(o.status ?? '')) continue;
      if (!o.created_at) continue;
      const warteMin = Math.floor((now - new Date(o.created_at).getTime()) / 60_000);
      const stufe = getStufe(warteMin);
      const firstItem = (o.items ?? [])[0];
      const label = firstItem?.product_name ?? firstItem?.name ?? `#${o.id.slice(-4)}`;
      const etaMin = o.promised_at
        ? Math.max(0, Math.round((new Date(o.promised_at).getTime() - now) / 60_000))
        : null;
      list.push({ id: o.id, label, warteMin, stufe, etaMin });
    }

    list.sort((a, b) => b.warteMin - a.warteMin);

    const counts = { ok: 0, warn: 0, kritisch: 0, ueberfaellig: 0 };
    for (const r of list) counts[r.stufe]++;

    return { rows: list.slice(0, 10), counts };
  }, [orders]);

  const alertCount = counts.kritisch + counts.ueberfaellig;

  return (
    <div className={cn('rounded-xl border border-gray-800 bg-gray-900 overflow-hidden', className)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-100 hover:bg-gray-800 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-purple-400" />
          Smart-Timing Farbkodierungs-Matrix
          {alertCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-xs bg-red-900 text-red-300">
              {alertCount} kritisch
            </span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Ampel-Legende */}
          <div className="grid grid-cols-4 gap-1.5">
            {(Object.entries(counts) as [Stufe, number][]).map(([stufe, count]) => (
              <div key={stufe} className={cn('rounded-lg px-2 py-1.5 text-center', STUFE_META[stufe].badge)}>
                <div className="text-sm font-black">{count}</div>
                <div className="text-[9px] mt-0.5">{STUFE_META[stufe].label}</div>
              </div>
            ))}
          </div>

          {rows.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-2">Keine aktiven Bestellungen</p>
          ) : (
            <div className="space-y-2">
              {rows.map(r => {
                const meta = STUFE_META[r.stufe];
                return (
                  <div key={r.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-gray-200 truncate max-w-[60%]">
                        {r.stufe === 'ueberfaellig' && <Zap className="w-3 h-3 text-red-400 flex-shrink-0" />}
                        <span className="truncate">{r.label}</span>
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        {r.etaMin !== null && (
                          <span className="text-gray-500 text-[10px]">ETA: {r.etaMin}m</span>
                        )}
                        <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold', meta.badge)}>
                          {r.warteMin}m
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-700 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', meta.bar)}
                        style={{ width: `${Math.min((r.warteMin / OVER_MIN) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-[10px] text-gray-600 text-right">
            Ampel: &lt;{WARN_MIN}m grün · {WARN_MIN}–{CRIT_MIN}m gelb · {CRIT_MIN}–{OVER_MIN}m orange · &gt;{OVER_MIN}m rot
          </p>
        </div>
      )}
    </div>
  );
}
