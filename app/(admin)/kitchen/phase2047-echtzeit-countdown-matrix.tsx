'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

interface Order {
  id: string;
  status?: string;
  created_at?: string;
  prep_time?: number;
  items?: { name?: string; product_name?: string }[];
}

interface Props {
  orders: Order[];
  className?: string;
}

interface CountdownRow {
  id: string;
  label: string;
  remainSec: number;
  targetSec: number;
  stufe: 'ok' | 'warn' | 'kritisch';
}

const ACTIVE = new Set(['accepted', 'preparing', 'in_progress', 'in_zubereitung', 'angenommen']);
const DEFAULT_PREP_MIN = 20;

function pad2(n: number) { return String(n).padStart(2, '0'); }
function fmtSec(s: number) {
  if (s <= 0) return '00:00';
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
}

function barColor(stufe: string) {
  if (stufe === 'ok') return 'bg-green-500';
  if (stufe === 'warn') return 'bg-amber-400';
  return 'bg-red-500';
}

export function KitchenPhase2047EchtzeitCountdownMatrix({ orders, className }: Props) {
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    ivRef.current = setInterval(() => setTick(t => t + 1), 1_000);
    return () => { if (ivRef.current) clearInterval(ivRef.current); };
  }, []);

  const rows = useMemo(() => {
    const now = Date.now();
    const list: CountdownRow[] = [];

    for (const o of orders) {
      if (!ACTIVE.has(o.status ?? '')) continue;
      if (!o.created_at) continue;

      const prepSec = (o.prep_time ?? DEFAULT_PREP_MIN) * 60;
      const startSec = new Date(o.created_at).getTime() / 1_000;
      const nowSec = now / 1_000;
      const elapsedSec = nowSec - startSec;
      const remainSec = Math.max(0, prepSec - elapsedSec);
      const progressPct = Math.min(1, elapsedSec / prepSec);

      const stufe: CountdownRow['stufe'] =
        remainSec <= 0 ? 'kritisch' : progressPct >= 0.75 ? 'warn' : 'ok';

      const firstItem = (o.items ?? [])[0];
      const label = firstItem?.product_name ?? firstItem?.name ?? `#${o.id.slice(-4)}`;

      list.push({ id: o.id, label, remainSec: Math.floor(remainSec), targetSec: prepSec, stufe });
    }

    list.sort((a, b) => a.remainSec - b.remainSec);
    return list.slice(0, 8);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, tick]);

  const overdueCount = rows.filter(r => r.remainSec <= 0).length;

  return (
    <div className={cn('rounded-xl border border-gray-800 bg-gray-900 overflow-hidden', className)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-100 hover:bg-gray-800 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-cyan-400" />
          Echtzeit-Countdown-Matrix
          {overdueCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-xs bg-red-900 text-red-300">
              {overdueCount} überfällig
            </span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {overdueCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-950 border border-red-800 px-3 py-2 text-xs text-red-300">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {overdueCount} Bestellung{overdueCount > 1 ? 'en' : ''} haben die Zubereitungszeit überschritten!
            </div>
          )}

          {rows.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-2">Keine aktiven Zubereitungen</p>
          ) : (
            <div className="space-y-2.5">
              {rows.map(r => {
                const progressPct = r.remainSec <= 0
                  ? 100
                  : Math.max(0, 100 - (r.remainSec / r.targetSec) * 100);
                return (
                  <div key={r.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-200 truncate max-w-[60%]">{r.label}</span>
                      <span className={cn(
                        'font-mono font-black text-sm tabular-nums',
                        r.stufe === 'ok' ? 'text-green-400' :
                        r.stufe === 'warn' ? 'text-amber-400' : 'text-red-400',
                      )}>
                        {r.remainSec <= 0 ? 'FERTIG!' : fmtSec(r.remainSec)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-1000', barColor(r.stufe))}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-[10px] text-gray-600 text-right">Live · aktualisiert jede Sekunde</p>
        </div>
      )}
    </div>
  );
}
