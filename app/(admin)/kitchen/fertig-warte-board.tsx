'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, Clock, Package } from 'lucide-react';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  typ: string;
  fertig_am: string | null;
  kunde_name: string;
  gesamtbetrag: number;
};

function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(iv);
  }, []);
  return now;
}

function waitMin(fertigAm: string, now: number): number {
  return Math.floor((now - new Date(fertigAm).getTime()) / 60_000);
}

type Urgency = 'ok' | 'warn' | 'critical';
function urgency(min: number): Urgency {
  if (min >= 8) return 'critical';
  if (min >= 4) return 'warn';
  return 'ok';
}

const URGENCY_STYLES: Record<Urgency, string> = {
  ok:       'border-l-matcha-500 bg-matcha-50',
  warn:     'border-l-amber-500 bg-amber-50',
  critical: 'border-l-red-500 bg-red-50 animate-pulse',
};
const URGENCY_BADGE: Record<Urgency, string> = {
  ok:       'bg-matcha-100 text-matcha-700',
  warn:     'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
};

export function KitchenFertigWarteBoard({ orders }: { orders: Order[] }) {
  const now = useNow();

  const waiting = orders
    .filter((o) => o.status === 'fertig' && o.typ === 'lieferung' && o.fertig_am)
    .sort((a, b) => new Date(a.fertig_am!).getTime() - new Date(b.fertig_am!).getTime());

  if (waiting.length === 0) return null;

  const maxWait = waitMin(waiting[0].fertig_am!, now);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-1.5">
          <Package size={14} className="text-matcha-600" />
          <span className="text-xs font-semibold text-gray-700">Fertig — warte auf Fahrer</span>
        </div>
        <span className={cn(
          'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
          maxWait >= 8 ? 'bg-red-100 text-red-700 animate-pulse' :
          maxWait >= 4 ? 'bg-amber-100 text-amber-700' : 'bg-matcha-100 text-matcha-700',
        )}>
          {waiting.length} {waiting.length === 1 ? 'Bestellung' : 'Bestellungen'}
        </span>
      </div>

      <div className="divide-y divide-gray-100">
        {waiting.map((o) => {
          const min = waitMin(o.fertig_am!, now);
          const urg = urgency(min);
          return (
            <div key={o.id} className={cn('flex items-center gap-3 px-4 py-2.5 border-l-4', URGENCY_STYLES[urg])}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-black text-gray-800 font-mono">#{o.bestellnummer}</span>
                  <span className="text-[11px] text-gray-500 truncate">{o.kunde_name}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {urg === 'critical' ? (
                  <AlertTriangle size={11} className="text-red-500" />
                ) : urg === 'warn' ? (
                  <Clock size={11} className="text-amber-500" />
                ) : (
                  <CheckCircle2 size={11} className="text-matcha-500" />
                )}
                <span className={cn('text-[11px] font-black tabular-nums px-1.5 py-0.5 rounded-full', URGENCY_BADGE[urg])}>
                  {min === 0 ? '<1 Min' : `${min} Min`}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {waiting.length > 0 && maxWait >= 4 && (
        <div className={cn(
          'px-4 py-2 text-[10px] font-semibold flex items-center gap-1',
          maxWait >= 8 ? 'text-red-600 bg-red-50' : 'text-amber-600 bg-amber-50',
        )}>
          <AlertTriangle size={10} />
          {maxWait >= 8
            ? `Älteste Bestellung wartet seit ${maxWait} Min — Fahrer kontaktieren!`
            : `${waiting.filter(o => waitMin(o.fertig_am!, now) >= 4).length} Bestellung(en) warten über 4 Min`
          }
        </div>
      )}
    </div>
  );
}
