'use client';

import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

type Order = { id: string; status: string; fertig_um?: string | null; bestellt_am?: string | null };

interface Props { orders: Order[] }

const EINGANG_STATUSES  = new Set(['neu', 'angenommen', 'bestätigt']);
const COOKING_STATUSES  = new Set(['in_zubereitung']);
const WAITING_STATUSES  = new Set(['fertig', 'ready', 'bereit']);

type Phase = { label: string; count: number; icon: React.ReactNode; bg: string; text: string; border: string; warn?: boolean };

export function KitchenBestellungsFlowAmpel({ orders }: Props) {
  const phases = useMemo<Phase[]>(() => {
    const eingang = orders.filter(o => EINGANG_STATUSES.has(o.status)).length;
    const cooking = orders.filter(o => COOKING_STATUSES.has(o.status)).length;
    const waiting = orders.filter(o => WAITING_STATUSES.has(o.status)).length;

    return [
      {
        label: 'Eingang',
        count: eingang,
        icon: <Clock className="h-4 w-4" />,
        bg: eingang > 5 ? 'bg-red-50' : eingang > 2 ? 'bg-amber-50' : 'bg-stone-50',
        text: eingang > 5 ? 'text-red-700' : eingang > 2 ? 'text-amber-700' : 'text-stone-600',
        border: eingang > 5 ? 'border-red-200' : eingang > 2 ? 'border-amber-200' : 'border-stone-100',
        warn: eingang > 5,
      },
      {
        label: 'In Zubereitung',
        count: cooking,
        icon: <Flame className="h-4 w-4" />,
        bg: cooking > 8 ? 'bg-red-50' : cooking > 4 ? 'bg-amber-50' : 'bg-orange-50',
        text: cooking > 8 ? 'text-red-700' : cooking > 4 ? 'text-amber-700' : 'text-orange-700',
        border: cooking > 8 ? 'border-red-200' : cooking > 4 ? 'border-amber-200' : 'border-orange-100',
        warn: cooking > 8,
      },
      {
        label: 'Fertig – wartet',
        count: waiting,
        icon: <CheckCircle2 className="h-4 w-4" />,
        bg: waiting > 3 ? 'bg-red-50' : waiting > 1 ? 'bg-amber-50' : 'bg-matcha-50',
        text: waiting > 3 ? 'text-red-700' : waiting > 1 ? 'text-amber-700' : 'text-matcha-700',
        border: waiting > 3 ? 'border-red-200' : waiting > 1 ? 'border-amber-200' : 'border-matcha-200',
        warn: waiting > 3,
      },
    ];
  }, [orders]);

  const anyWarn = phases.some(p => p.warn);

  return (
    <div className="rounded-xl border border-stone-100 bg-white p-3">
      <div className="mb-2.5 flex items-center gap-2">
        {anyWarn
          ? <AlertTriangle className="h-4 w-4 text-red-500 animate-pulse shrink-0" />
          : <Flame className="h-4 w-4 text-matcha-600 shrink-0" />}
        <span className="text-xs font-bold text-stone-700">Bestellungs-Flow</span>
        {anyWarn && (
          <span className="ml-auto rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-black text-red-700">
            Stau erkannt
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {phases.map(p => (
          <div key={p.label} className={cn('rounded-lg border p-2.5 text-center', p.bg, p.border)}>
            <div className={cn('flex justify-center mb-1', p.text)}>{p.icon}</div>
            <div className={cn('text-2xl font-black tabular-nums leading-none', p.text)}>
              {p.count}
            </div>
            <div className="mt-1 text-[8px] font-semibold leading-tight text-stone-500">
              {p.label}
            </div>
            {p.warn && (
              <div className="mt-1 text-[8px] font-black text-red-600 animate-pulse">⚠ Stau</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
