'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Target } from 'lucide-react';

type Order = {
  id: string;
  status?: string;
  created_at?: string;
  bestellt_am?: string;
  fertig_am?: string;
  prep_time?: number;
};

function getPrepDelta(order: Order): number | null {
  const start = order.bestellt_am ?? order.created_at;
  const end = order.fertig_am;
  if (!start || !end) return null;
  const actual = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
  const target = order.prep_time ?? 20;
  return actual - target;
}

function circumference(r: number) { return 2 * Math.PI * r; }

export function KitchenPhase1061SmartTimingSchichtRing({ orders }: { orders: Order[] }) {
  const [open, setOpen] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const stats = useMemo(() => {
    const fertig = orders.filter((o) => o.status === 'fertig' || o.status === 'geliefert' || o.status === 'abgeholt');
    const deltas = fertig.map(getPrepDelta).filter((d): d is number => d !== null);
    if (deltas.length === 0) return null;
    const onTime = deltas.filter((d) => d <= 2).length;
    const score = Math.round((onTime / deltas.length) * 100);
    const avg = deltas.reduce((s, v) => s + v, 0) / deltas.length;
    return { score, total: deltas.length, onTime, avg: Math.round(avg * 10) / 10 };
  }, [orders]);

  if (!stats) return null;

  const r = 30;
  const circ = circumference(r);
  const dash = circ * (stats.score / 100);
  const ampel = stats.score >= 80 ? 'gruen' : stats.score >= 60 ? 'gelb' : 'rot';
  const ringFarbe = ampel === 'gruen' ? '#22c55e' : ampel === 'gelb' ? '#f59e0b' : '#ef4444';
  const textFarbe = ampel === 'gruen' ? 'text-matcha-700 dark:text-matcha-300' : ampel === 'gelb' ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300';
  const bgFarbe = ampel === 'gruen' ? 'bg-matcha-50 dark:bg-matcha-950/30 border-matcha-200 dark:border-matcha-800' : ampel === 'gelb' ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800';

  return (
    <div className={cn('rounded-2xl border overflow-hidden', bgFarbe)}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left"
      >
        {/* Ring */}
        <div className="shrink-0">
          <svg width={72} height={72} viewBox="0 0 72 72">
            <circle cx={36} cy={36} r={r} fill="none" stroke="currentColor" strokeWidth={6} className="text-black/10" />
            <circle
              cx={36} cy={36} r={r} fill="none"
              stroke={ringFarbe} strokeWidth={6}
              strokeDasharray={`${dash} ${circ}`}
              strokeLinecap="round"
              transform="rotate(-90 36 36)"
              className="transition-all duration-700"
            />
            <text x={36} y={40} textAnchor="middle" className="font-black" fontSize={14} fill={ringFarbe} fontWeight={900}>
              {stats.score}%
            </text>
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Target size={13} className={textFarbe} />
            <span className={cn('text-xs font-bold', textFarbe)}>Smart-Timing-Score — Schicht</span>
          </div>
          <div className="mt-1 flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
            <span>{stats.onTime}/{stats.total} pünktlich</span>
            <span>Ø Δ {stats.avg > 0 ? '+' : ''}{stats.avg} Min</span>
          </div>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-3 space-y-2 border-t border-black/5">
          <div className="grid grid-cols-3 gap-2 pt-2">
            {[
              { label: 'Score', value: `${stats.score}%` },
              { label: 'Pünktlich', value: `${stats.onTime}` },
              { label: 'Ø Abw.', value: `${stats.avg > 0 ? '+' : ''}${stats.avg} Min` },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-lg bg-white/60 dark:bg-black/20 border border-white/50 p-2 text-center">
                <div className={cn('text-lg font-black', textFarbe)}>{kpi.value}</div>
                <div className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{kpi.label}</div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Basiert auf {stats.total} abgeschlossenen Bestellungen dieser Schicht. Ziel: ≤2 Min Abweichung.
          </p>
        </div>
      )}
    </div>
  );
}
