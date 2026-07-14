'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { PieChart, ChevronDown, ChevronUp, Clock } from 'lucide-react';

// Phase 1466 — Bestelltyp-Analyse-Panel (Kitchen)
// Aufschlüsselung nach Bestelltyp (normal/express/geplant) + Anteil + Ø Zubereitungszeit;
// Props-basiert; rein client-seitig; nach Phase1461.

interface OrderItem {
  name?: string | null;
}

interface Order {
  id: string;
  status?: string | null;
  order_type?: string | null;
  delivery_type?: string | null;
  express?: boolean | null;
  geplant?: boolean | null;
  bestellt_am?: string | null;
  accepted_at?: string | null;
  ready_at?: string | null;
  items?: OrderItem[] | null;
}

interface Props {
  orders: Order[];
}

type BestellTyp = 'express' | 'geplant' | 'normal';

interface TypStats {
  typ: BestellTyp;
  anzahl: number;
  anteil: number;
  avgPrepMin: number | null;
}

const TYP_CONFIG: Record<BestellTyp, { label: string; farbe: string; badge: string; icon: string }> = {
  express: {
    label: 'Express',
    farbe: 'bg-rose-500',
    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    icon: '⚡',
  },
  geplant: {
    label: 'Geplant',
    farbe: 'bg-sky-500',
    badge: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
    icon: '📅',
  },
  normal: {
    label: 'Normal',
    farbe: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    icon: '🛒',
  },
};

const AKTIVE_STATUSES = new Set(['pending', 'confirmed', 'preparing', 'in_zubereitung', 'ready', 'accepted', 'delivered']);

function detectTyp(o: Order): BestellTyp {
  if (o.express === true) return 'express';
  if (o.order_type === 'express' || o.delivery_type === 'express') return 'express';
  if (o.geplant === true) return 'geplant';
  if (o.order_type === 'scheduled' || o.delivery_type === 'scheduled') return 'geplant';
  return 'normal';
}

function calcPrepMin(o: Order): number | null {
  const start = o.accepted_at ?? o.bestellt_am;
  const end = o.ready_at;
  if (!start || !end) return null;
  const diff = (new Date(end).getTime() - new Date(start).getTime()) / 60_000;
  return diff > 0 && diff < 120 ? Math.round(diff) : null;
}

export function KitchenPhase1466BestelltypAnalysePanel({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const stats = useMemo((): TypStats[] => {
    const aktiv = orders.filter(o => AKTIVE_STATUSES.has(o.status ?? ''));
    if (aktiv.length === 0) return [];

    const gruppen: Record<BestellTyp, { count: number; prepMins: number[] }> = {
      express: { count: 0, prepMins: [] },
      geplant: { count: 0, prepMins: [] },
      normal: { count: 0, prepMins: [] },
    };

    for (const o of aktiv) {
      const typ = detectTyp(o);
      gruppen[typ].count++;
      const pm = calcPrepMin(o);
      if (pm !== null) gruppen[typ].prepMins.push(pm);
    }

    const gesamt = aktiv.length;

    return (['express', 'geplant', 'normal'] as BestellTyp[])
      .filter(t => gruppen[t].count > 0)
      .map(typ => {
        const g = gruppen[typ];
        const avgPrepMin = g.prepMins.length > 0
          ? Math.round(g.prepMins.reduce((a, b) => a + b, 0) / g.prepMins.length)
          : null;
        return {
          typ,
          anzahl: g.count,
          anteil: Math.round((g.count / gesamt) * 100),
          avgPrepMin,
        };
      });
  }, [orders]);

  if (stats.length === 0) return null;

  const gesamt = stats.reduce((s, t) => s + t.anzahl, 0);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <PieChart className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex-1 text-left">
          Bestelltyp-Analyse
        </span>
        <span className="text-[10px] text-slate-400 shrink-0">{gesamt} Bestellungen</span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Stacked bar */}
          <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
            {stats.map(s => (
              <div
                key={s.typ}
                className={cn(TYP_CONFIG[s.typ].farbe, 'transition-all duration-500')}
                style={{ width: `${s.anteil}%` }}
                title={`${TYP_CONFIG[s.typ].label}: ${s.anteil}%`}
              />
            ))}
          </div>

          {/* Rows */}
          <div className="space-y-2">
            {stats.map(s => {
              const cfg = TYP_CONFIG[s.typ];
              return (
                <div key={s.typ} className="flex items-center gap-3">
                  <span className="text-base shrink-0">{cfg.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{cfg.label}</span>
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', cfg.badge)}>
                        {s.anteil}%
                      </span>
                    </div>
                    <div className="flex-1 mt-0.5 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={cn(cfg.farbe, 'h-full rounded-full')}
                        style={{ width: `${s.anteil}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-black tabular-nums text-slate-800 dark:text-slate-100">{s.anzahl}</div>
                    {s.avgPrepMin !== null && (
                      <div className="flex items-center gap-0.5 text-[10px] text-slate-500 dark:text-slate-400 justify-end">
                        <Clock className="w-2.5 h-2.5" />
                        {s.avgPrepMin} Min
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
