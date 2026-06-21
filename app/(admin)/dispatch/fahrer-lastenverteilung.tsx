'use client';

import { cn } from '@/lib/utils';
import { Scale } from 'lucide-react';

type Stop = { geliefert_am: string | null };
type Batch = {
  id: string;
  status: string;
  zone: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: Stop[];
};

interface Props {
  batches: Batch[];
}

const ACTIVE = ['assigned', 'on_route', 'en_route', 'unterwegs', 'active'];

export function DispatchFahrerLastenverteilung({ batches }: Props) {
  const active = batches.filter((b) => ACTIVE.includes(b.status));
  if (active.length < 2) return null;

  const rows = active.map((b) => {
    const name = b.fahrer
      ? `${b.fahrer.vorname} ${b.fahrer.nachname.charAt(0)}.`
      : 'Fahrer';
    const total = b.stops.length;
    const done = b.stops.filter((s) => s.geliefert_am).length;
    const remaining = total - done;
    return { id: b.id, name, total, done, remaining, zone: b.zone };
  });

  const maxRemaining = Math.max(...rows.map((r) => r.remaining), 1);
  const avgRemaining = rows.reduce((s, r) => s + r.remaining, 0) / rows.length;
  const imbalanced = rows.some((r) => r.remaining > avgRemaining * 1.5 + 1);

  return (
    <div className={cn('rounded-2xl border overflow-hidden bg-white', imbalanced ? 'border-amber-200' : 'border-stone-200')}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-stone-100">
        <Scale className={cn('h-4 w-4 shrink-0', imbalanced ? 'text-amber-600' : 'text-matcha-600')} />
        <span className="text-xs font-bold uppercase tracking-wider">Fahrer-Lastenverteilung</span>
        {imbalanced && (
          <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
            Ungleich
          </span>
        )}
        {!imbalanced && (
          <span className="ml-auto rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
            Ausgeglichen
          </span>
        )}
      </div>

      <div className="divide-y divide-stone-100">
        {rows.sort((a, b) => b.remaining - a.remaining).map((r) => {
          const pct = maxRemaining > 0 ? (r.remaining / maxRemaining) * 100 : 0;
          const overloaded = r.remaining > avgRemaining * 1.5 + 1;
          return (
            <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="w-20 shrink-0">
                <span className="text-xs font-bold text-foreground truncate block">{r.name}</span>
                {r.zone && (
                  <span className="text-[9px] text-muted-foreground">Zone {r.zone}</span>
                )}
              </div>
              <div className="flex-1 h-2.5 rounded-full bg-stone-100 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    overloaded ? 'bg-amber-400' : 'bg-matcha-500',
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="shrink-0 text-right min-w-[48px]">
                <span className={cn('font-mono text-xs font-black tabular-nums', overloaded ? 'text-amber-700' : 'text-matcha-700')}>
                  {r.remaining}
                </span>
                <span className="text-[9px] text-muted-foreground"> /{r.total}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-stone-100 px-4 py-2 text-[10px] text-muted-foreground flex items-center gap-2">
        <span>Ø verbleibende Stopps:</span>
        <span className="font-bold text-foreground tabular-nums">{avgRemaining.toFixed(1)}</span>
      </div>
    </div>
  );
}
