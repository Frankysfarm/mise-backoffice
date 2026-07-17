'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Timer, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

interface Order {
  id: string;
  created_at?: string;
  status?: string;
  driver_id?: string | null;
  batch_id?: string | null;
}

interface Props {
  orders: Order[];
}

const THRESHOLDS = [
  { min: 10, label: '10–15 Min', color: 'text-amber-400', bg: 'bg-amber-950', border: 'border-amber-800', dot: 'bg-amber-400' },
  { min: 15, label: '15–20 Min', color: 'text-orange-400', bg: 'bg-orange-950', border: 'border-orange-800', dot: 'bg-orange-400' },
  { min: 20, label: '>20 Min', color: 'text-red-400', bg: 'bg-red-950', border: 'border-red-800', dot: 'bg-red-500' },
] as const;

function waitMin(order: Order): number {
  if (!order.created_at) return 0;
  return (Date.now() - new Date(order.created_at).getTime()) / 60_000;
}

function isUnassigned(order: Order): boolean {
  return !order.driver_id && !order.batch_id && order.status !== 'delivered' && order.status !== 'cancelled';
}

export function KitchenPhase2064BestellwartenEskalationsAmpel({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const { buckets, totalWaiting, highestAlert } = useMemo(() => {
    const unassigned = orders.filter(isUnassigned);

    const over10 = unassigned.filter(o => waitMin(o) >= 10 && waitMin(o) < 15);
    const over15 = unassigned.filter(o => waitMin(o) >= 15 && waitMin(o) < 20);
    const over20 = unassigned.filter(o => waitMin(o) >= 20);

    const bkts = [over10, over15, over20];
    const total = unassigned.filter(o => waitMin(o) >= 10).length;
    const highest = over20.length > 0 ? 2 : over15.length > 0 ? 1 : over10.length > 0 ? 0 : -1;

    return { buckets: bkts, totalWaiting: total, highestAlert: highest };
  }, [orders]);

  if (totalWaiting === 0) return null;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-100 hover:bg-gray-800 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-orange-400" />
          Bestellwarten-Eskalation
          <span className="text-xs text-gray-400 font-normal">ohne Fahrer-Zuweisung</span>
          {highestAlert === 2 && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs bg-red-950 text-red-300">
              <AlertTriangle className="w-3 h-3" /> Kritisch
            </span>
          )}
          {highestAlert === 1 && (
            <span className="px-1.5 py-0.5 rounded-full text-xs bg-orange-950 text-orange-300">Warnung</span>
          )}
          {highestAlert === 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-xs bg-amber-950 text-amber-300">Achtung</span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {THRESHOLDS.map((t, i) => {
            const bucket = buckets[i];
            if (bucket.length === 0) return null;
            return (
              <div
                key={t.min}
                className={cn('rounded-lg border px-3 py-2.5 flex items-start gap-3', t.bg, t.border)}
              >
                <div className={cn('w-2.5 h-2.5 rounded-full mt-0.5 shrink-0', t.dot)} />
                <div className="flex-1 min-w-0">
                  <div className={cn('text-xs font-bold', t.color)}>
                    {t.label} — {bucket.length} {bucket.length === 1 ? 'Bestellung' : 'Bestellungen'}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                    {bucket.slice(0, 3).map(o => `#${o.id.slice(-4)}`).join(', ')}
                    {bucket.length > 3 && ` +${bucket.length - 3} weitere`}
                  </div>
                </div>
                {i === 2 && (
                  <div className="flex items-center gap-1 shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-[10px] text-red-400 font-bold">Sofort zuweisen!</span>
                  </div>
                )}
              </div>
            );
          })}
          <div className="text-[10px] text-gray-500 text-right">
            {totalWaiting} Bestellung{totalWaiting !== 1 ? 'en' : ''} warten &gt;10 Min
          </div>
        </div>
      )}
    </div>
  );
}
