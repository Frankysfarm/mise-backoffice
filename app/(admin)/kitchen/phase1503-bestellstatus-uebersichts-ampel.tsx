'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrafficCone, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

// Phase 1503 — Bestellstatus-Übersichts-Ampel (Kitchen)
// Kompakte Statusübersicht: Anzahl Bestellungen je Status-Stufe (pending/preparing/ready)
// + kritische Schwellen + Sofortmaßnahme-Hint; Props-basiert; rein client-seitig.

interface Order {
  id: string;
  status?: string | null;
  created_at?: string | null;
  accepted_at?: string | null;
}

interface Props {
  orders: Order[];
}

type StatusStufe = 'pending' | 'preparing' | 'ready';

interface StufeStats {
  stufe: StatusStufe;
  count: number;
  oldest_min: number | null;
  ampel: 'gruen' | 'gelb' | 'rot';
  hint: string | null;
}

const STUFE_CONFIG: Record<StatusStufe, {
  label: string;
  icon: string;
  statuses: string[];
  schwelle_gelb: number;
  schwelle_rot: number;
  hint_gelb: string;
  hint_rot: string;
}> = {
  pending: {
    label: 'Ausstehend',
    icon: '⏳',
    statuses: ['pending', 'confirmed'],
    schwelle_gelb: 4,
    schwelle_rot: 8,
    hint_gelb: 'Mehrere Bestellungen warten — Küche priorisieren.',
    hint_rot: 'Kritisch viele ausstehende Bestellungen — sofort annehmen!',
  },
  preparing: {
    label: 'In Zubereitung',
    icon: '🍳',
    statuses: ['preparing', 'in_zubereitung', 'accepted'],
    schwelle_gelb: 5,
    schwelle_rot: 10,
    hint_gelb: 'Hohe parallele Zubereitungslast — Kapazität prüfen.',
    hint_rot: 'Überlast in Zubereitung — zusätzliche Station öffnen!',
  },
  ready: {
    label: 'Fertig/Wartend',
    icon: '✅',
    statuses: ['ready'],
    schwelle_gelb: 3,
    schwelle_rot: 6,
    hint_gelb: 'Fertige Bestellungen warten auf Abholung — Fahrer informieren.',
    hint_rot: 'Kritisch viele fertige Bestellungen — sofort abholen!',
  },
};

function getAmpel(count: number, stufe: StatusStufe): StufeStats['ampel'] {
  const cfg = STUFE_CONFIG[stufe];
  if (count >= cfg.schwelle_rot) return 'rot';
  if (count >= cfg.schwelle_gelb) return 'gelb';
  return 'gruen';
}

function getHint(count: number, stufe: StatusStufe): string | null {
  const cfg = STUFE_CONFIG[stufe];
  if (count >= cfg.schwelle_rot) return cfg.hint_rot;
  if (count >= cfg.schwelle_gelb) return cfg.hint_gelb;
  return null;
}

function getOldestMin(orders: Order[], stufe: StatusStufe): number | null {
  const cfg = STUFE_CONFIG[stufe];
  const relevant = orders.filter(o => cfg.statuses.includes(o.status ?? ''));
  if (relevant.length === 0) return null;
  const oldest = relevant.reduce<Order | null>((acc, o) => {
    const t = o.accepted_at ?? o.created_at;
    if (!t) return acc;
    if (!acc) return o;
    const accT = acc.accepted_at ?? acc.created_at;
    return !accT || new Date(t) < new Date(accT) ? o : acc;
  }, null);
  if (!oldest) return null;
  const t = oldest.accepted_at ?? oldest.created_at;
  if (!t) return null;
  return Math.round((Date.now() - new Date(t).getTime()) / 60_000);
}

const AMPEL_COLORS: Record<StufeStats['ampel'], { dot: string; badge: string; ring: string }> = {
  gruen: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    ring: 'ring-emerald-200 dark:ring-emerald-800',
  },
  gelb: {
    dot: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    ring: 'ring-amber-200 dark:ring-amber-800',
  },
  rot: {
    dot: 'bg-rose-500 animate-pulse',
    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    ring: 'ring-rose-200 dark:ring-rose-800',
  },
};

export function KitchenPhase1503BestellstatusUebersichtsAmpel({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const stats = useMemo((): StufeStats[] => {
    return (['pending', 'preparing', 'ready'] as StatusStufe[]).map(stufe => {
      const cfg = STUFE_CONFIG[stufe];
      const count = orders.filter(o => cfg.statuses.includes(o.status ?? '')).length;
      return {
        stufe,
        count,
        oldest_min: getOldestMin(orders, stufe),
        ampel: getAmpel(count, stufe),
        hint: getHint(count, stufe),
      };
    });
  }, [orders]);

  const hatKritisch = stats.some(s => s.ampel === 'rot');
  const totalAktiv = stats.reduce((s, st) => s + st.count, 0);

  if (totalAktiv === 0) return null;

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden',
      hatKritisch
        ? 'border-rose-200 dark:border-rose-800'
        : 'border-slate-200 dark:border-slate-700',
    )}>
      <button
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <TrafficCone className={cn(
          'w-4 h-4 shrink-0',
          hatKritisch ? 'text-rose-500' : 'text-amber-500',
        )} />
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex-1 text-left">
          Bestellstatus-Ampel
        </span>
        {hatKritisch && (
          <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
        )}
        <span className="text-[10px] text-slate-400 shrink-0">{totalAktiv} aktiv</span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 bg-white dark:bg-slate-900">
          {stats.map(s => {
            const cfg = STUFE_CONFIG[s.stufe];
            const colors = AMPEL_COLORS[s.ampel];
            return (
              <div key={s.stufe} className={cn('rounded-lg p-3 ring-1 bg-slate-50 dark:bg-slate-800/50', colors.ring)}>
                <div className="flex items-center gap-3">
                  <span className="text-base shrink-0">{cfg.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{cfg.label}</span>
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', colors.badge)}>
                        {s.count}
                      </span>
                    </div>
                    {s.oldest_min !== null && (
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Älteste seit {s.oldest_min} Min
                      </div>
                    )}
                  </div>
                  <div className={cn('w-3 h-3 rounded-full shrink-0', colors.dot)} />
                </div>
                {s.hint && (
                  <div className={cn('mt-2 text-[11px] font-medium px-2 py-1 rounded', colors.badge)}>
                    {s.hint}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
