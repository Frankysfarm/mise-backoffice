'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Flame, ChevronDown, ChevronUp, Star } from 'lucide-react';

interface Order {
  id: string;
  status?: string;
  created_at?: string;
  promised_at?: string;
  items?: { name?: string; product_name?: string; prep_time_min?: number }[];
  total?: number;
  zone?: string;
}

interface Props {
  orders: Order[];
  className?: string;
}

interface PrioRow {
  id: string;
  label: string;
  prio: number;
  reason: string;
  stufe: 'hoch' | 'mittel' | 'niedrig';
  zone: string | null;
  wertEuro: number;
}

const ACTIVE_START = new Set(['accepted', 'new', 'angenommen']);

function calcPrio(o: Order): number {
  const now = Date.now();
  let score = 50;

  if (o.promised_at) {
    const remainMin = (new Date(o.promised_at).getTime() - now) / 60_000;
    if (remainMin < 10) score += 40;
    else if (remainMin < 20) score += 20;
    else if (remainMin < 30) score += 10;
  } else if (o.created_at) {
    const waitMin = (now - new Date(o.created_at).getTime()) / 60_000;
    score += Math.min(waitMin * 2, 40);
  }

  if ((o.total ?? 0) > 30) score += 10;
  return Math.min(100, Math.round(score));
}

function getReason(prio: number, o: Order): string {
  if (prio >= 80) {
    if (o.promised_at) return 'ETA in <10 Min — sofort starten!';
    return 'Lange Wartezeit — Priorität erhöht';
  }
  if (prio >= 60) return 'Mittlere Dringlichkeit';
  return 'Standard-Priorisierung';
}

export function KitchenPhase2048BatchKochstartPrioraetsCockpit({ orders, className }: Props) {
  const [open, setOpen] = useState(true);

  const rows = useMemo(() => {
    const list: PrioRow[] = [];

    for (const o of orders) {
      if (!ACTIVE_START.has(o.status ?? '')) continue;
      const prio = calcPrio(o);
      const stufe: PrioRow['stufe'] = prio >= 75 ? 'hoch' : prio >= 50 ? 'mittel' : 'niedrig';
      const firstItem = (o.items ?? [])[0];
      const label = firstItem?.product_name ?? firstItem?.name ?? `#${o.id.slice(-4)}`;
      list.push({
        id: o.id,
        label,
        prio,
        reason: getReason(prio, o),
        stufe,
        zone: o.zone ?? null,
        wertEuro: o.total ?? 0,
      });
    }

    return list.sort((a, b) => b.prio - a.prio).slice(0, 8);
  }, [orders]);

  const hochCount = rows.filter(r => r.stufe === 'hoch').length;

  return (
    <div className={cn('rounded-xl border border-gray-800 bg-gray-900 overflow-hidden', className)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-100 hover:bg-gray-800 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-400" />
          Kochstart-Prioritäts-Cockpit
          {hochCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-xs bg-orange-900 text-orange-300">
              {hochCount} dringend
            </span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2.5">
          {rows.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-2">Keine wartenden Bestellungen</p>
          ) : (
            rows.map((r, i) => (
              <div
                key={r.id}
                className={cn(
                  'rounded-lg p-2.5 space-y-1.5',
                  r.stufe === 'hoch' ? 'bg-orange-950 border border-orange-800' :
                  r.stufe === 'mittel' ? 'bg-amber-950/40 border border-amber-900/50' :
                  'bg-gray-800 border border-gray-700',
                )}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-gray-100 font-semibold truncate max-w-[65%]">
                    <span className="text-gray-500 w-4">{i + 1}.</span>
                    {r.stufe === 'hoch' && <Flame className="w-3 h-3 text-orange-400 shrink-0" />}
                    <span className="truncate">{r.label}</span>
                    {r.zone && (
                      <span className="text-gray-500 font-normal">({r.zone})</span>
                    )}
                  </span>
                  <span className={cn(
                    'font-black text-base tabular-nums',
                    r.stufe === 'hoch' ? 'text-orange-400' :
                    r.stufe === 'mittel' ? 'text-amber-400' : 'text-gray-400',
                  )}>
                    {r.prio}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-700 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      r.stufe === 'hoch' ? 'bg-orange-500' :
                      r.stufe === 'mittel' ? 'bg-amber-400' : 'bg-gray-500',
                    )}
                    style={{ width: `${r.prio}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-400">{r.reason}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
