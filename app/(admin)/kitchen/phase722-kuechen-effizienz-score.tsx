'use client';

import { useEffect, useMemo, useState } from 'react';
import { Zap } from 'lucide-react';

interface Order {
  created_at?: string | null;
  status?: string | null;
  completed_at?: string | null;
}

interface Props {
  orders: Order[];
  zielProStunde?: number;
}

export function KitchenPhase722KuechenEffizienzScore({ orders, zielProStunde = 12 }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const { score, bestellungenLetzte60Min, avgZeitMin } = useMemo(() => {
    const cutoff = new Date(now - 60 * 60_000);

    const letzte60 = orders.filter(
      (o) => o.created_at && new Date(o.created_at) >= cutoff,
    );

    const bestellungen = letzte60.length;

    // Avg prep time from completed orders with timestamps
    const completed = letzte60.filter((o) => o.status === 'completed' && o.completed_at && o.created_at);
    const avgTime = completed.length > 0
      ? completed.reduce((s, o) => {
          const min = (new Date(o.completed_at!).getTime() - new Date(o.created_at!).getTime()) / 60_000;
          return s + min;
        }, 0) / completed.length
      : null;

    const effizienz = Math.min(100, Math.round((bestellungen / zielProStunde) * 100));

    return {
      score: effizienz,
      bestellungenLetzte60Min: bestellungen,
      avgZeitMin: avgTime ? Math.round(avgTime) : null,
    };
  }, [orders, now, zielProStunde]);

  const color = score >= 85 ? 'text-emerald-600 dark:text-emerald-400'
    : score >= 55 ? 'text-amber-600 dark:text-amber-400'
    : 'text-red-600 dark:text-red-400';

  const barColor = score >= 85 ? 'bg-emerald-500' : score >= 55 ? 'bg-amber-500' : 'bg-red-500';
  const label = score >= 85 ? 'Top-Leistung' : score >= 55 ? 'Im Plan' : 'Unter Plan';

  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <Zap className={`h-4 w-4 shrink-0 ${color}`} />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold">Küchen-Effizienz</span>
            <div className="flex items-center gap-1.5">
              <span className={`text-sm font-bold tabular-nums ${color}`}>{score}%</span>
              <span className={`text-[9px] font-semibold ${color}`}>{label}</span>
            </div>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${score}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[9px] text-muted-foreground">
              {bestellungenLetzte60Min} / {zielProStunde} Bestell./Std
            </span>
            {avgZeitMin !== null && (
              <span className="text-[9px] text-muted-foreground">Ø {avgZeitMin} Min/Bestellung</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
