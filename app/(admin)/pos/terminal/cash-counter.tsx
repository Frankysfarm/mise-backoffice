'use client';

import { useState, useMemo, useEffect } from 'react';
import { cn, euro } from '@/lib/utils';

const DENOMS = [
  { v: 500, label: '500 €' },
  { v: 200, label: '200 €' },
  { v: 100, label: '100 €' },
  { v: 50, label: '50 €' },
  { v: 20, label: '20 €' },
  { v: 10, label: '10 €' },
  { v: 5, label: '5 €' },
  { v: 2, label: '2 €', muenze: true },
  { v: 1, label: '1 €', muenze: true },
  { v: 0.5, label: '50 ct', muenze: true },
  { v: 0.2, label: '20 ct', muenze: true },
  { v: 0.1, label: '10 ct', muenze: true },
  { v: 0.05, label: '5 ct', muenze: true },
  { v: 0.02, label: '2 ct', muenze: true },
  { v: 0.01, label: '1 ct', muenze: true },
];

export function CashCounter({
  onChange,
}: {
  onChange: (total: number) => void;
}) {
  const [counts, setCounts] = useState<Record<string, number>>({});

  const total = useMemo(() => {
    return DENOMS.reduce((sum, d) => sum + (counts[d.v] ?? 0) * d.v, 0);
  }, [counts]);

  useEffect(() => { onChange(Math.round(total * 100) / 100); }, [total]); // eslint-disable-line

  return (
    <div className="bg-gray-50 rounded-2xl p-3">
      <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
        Kassenlade durchzählen
      </div>
      <div className="grid grid-cols-3 gap-2">
        {DENOMS.map((d) => {
          const c = counts[d.v] ?? 0;
          return (
            <div key={d.v} className={cn(
              'flex items-center gap-1 rounded-lg border p-1.5 bg-white',
              c > 0 && 'border-matcha-500',
            )}>
              <div className={cn(
                'h-9 w-14 rounded-md grid place-items-center text-xs font-bold shrink-0',
                d.muenze ? 'bg-amber-100 text-amber-900' : 'bg-green-100 text-green-900',
              )}>
                {d.label}
              </div>
              <input
                type="number"
                min={0}
                value={c || ''}
                onChange={(e) => {
                  const n = parseInt(e.target.value) || 0;
                  setCounts((p) => ({ ...p, [d.v]: n }));
                }}
                placeholder="0"
                className="flex-1 h-9 w-12 rounded-md bg-white text-center font-bold outline-none"
              />
              {c > 0 && (
                <div className="text-[10px] text-gray-500 shrink-0">
                  = {euro(c * d.v)}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 pt-3 border-t flex justify-between items-baseline">
        <span className="text-xs font-bold uppercase text-gray-500">Gezählter Bestand</span>
        <span className="font-display text-2xl font-black">{euro(total)}</span>
      </div>
    </div>
  );
}
