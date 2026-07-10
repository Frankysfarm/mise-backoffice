'use client';

import { useMemo, useState } from 'react';
import { AlertOctagon, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1084 — Rückstand-Alarm (Kitchen)
// Bestellungen in Zubereitung die länger als Prep-Ziel warten + Eskalations-Level

interface Item { name?: string; title?: string }
interface Order {
  id: string;
  status: string;
  created_at?: string | null;
  bestellnummer?: string | null;
  items?: Item[] | null;
}
interface Props { orders: Order[] }

const PREP_ZIEL_MIN = 15;
const LEVELS = [
  { minuten: 30, label: 'Kritisch', color: 'red',    pulse: true  },
  { minuten: 20, label: 'Hoch',     color: 'orange', pulse: true  },
  { minuten: PREP_ZIEL_MIN, label: 'Verzögert', color: 'amber', pulse: false },
] as const;

type Level = 'kritisch' | 'hoch' | 'verzoegert';

const LEVEL_CFG: Record<Level, { border: string; bg: string; badge: string; icon: string }> = {
  kritisch:  { border: 'border-red-400',    bg: 'bg-red-50 dark:bg-red-900/20',    badge: 'bg-red-100 text-red-700 border-red-300',    icon: 'text-red-600'    },
  hoch:      { border: 'border-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20', badge: 'bg-orange-100 text-orange-700 border-orange-300', icon: 'text-orange-500' },
  verzoegert:{ border: 'border-amber-300',  bg: 'bg-amber-50 dark:bg-amber-900/20', badge: 'bg-amber-100 text-amber-700 border-amber-300',  icon: 'text-amber-500'  },
};

const PREP_STATUSES = ['in_preparation', 'zubereitung', 'confirmed', 'angenommen', 'neu'];

function getLevel(warteMin: number): Level | null {
  if (warteMin >= 30) return 'kritisch';
  if (warteMin >= 20) return 'hoch';
  if (warteMin >= PREP_ZIEL_MIN) return 'verzoegert';
  return null;
}

export function KitchenPhase1084RueckstandAlarm({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const { verzoegert, kritischCount, hochCount, maxWarte } = useMemo(() => {
    const now = Date.now();
    const active = orders.filter(o => PREP_STATUSES.includes(o.status ?? ''));

    const items = active.map(o => {
      const seit = o.created_at ? (now - new Date(o.created_at).getTime()) / 60_000 : 0;
      const level = getLevel(seit);
      return level ? { order: o, warteMin: seit, level } : null;
    }).filter(Boolean) as { order: Order; warteMin: number; level: Level }[];

    items.sort((a, b) => b.warteMin - a.warteMin);

    return {
      verzoegert: items,
      kritischCount: items.filter(i => i.level === 'kritisch').length,
      hochCount: items.filter(i => i.level === 'hoch').length,
      maxWarte: items[0]?.warteMin ?? 0,
    };
  }, [orders]);

  if (verzoegert.length === 0) return null;

  const hasCritical = kritischCount > 0;
  const borderColor = hasCritical ? 'border-red-400' : hochCount > 0 ? 'border-orange-400' : 'border-amber-300';
  const headerBg = hasCritical ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100/70' : hochCount > 0 ? 'bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100/50' : 'bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100/50';

  return (
    <div className={cn('rounded-xl border shadow-sm overflow-hidden', borderColor)}>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn('w-full flex items-center justify-between px-4 py-3 transition', headerBg)}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <AlertOctagon className={cn('h-4 w-4 shrink-0', hasCritical ? 'text-red-600' : hochCount > 0 ? 'text-orange-500' : 'text-amber-500')} />
          <span className="text-sm font-bold">Rückstand-Alarm</span>
          {kritischCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-red-100 border border-red-300 px-2 py-0.5 text-[10px] font-black text-red-700 animate-pulse">
              {kritischCount}× Kritisch
            </span>
          )}
          {hochCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-orange-100 border border-orange-300 px-2 py-0.5 text-[10px] font-black text-orange-700">
              {hochCount}× Hoch
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">{verzoegert.length} verzögert · max {Math.round(maxWarte)} Min</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="divide-y divide-border">
          {verzoegert.map(({ order, warteMin, level }) => {
            const cfg = LEVEL_CFG[level];
            const levelCfg = LEVELS.find(l => l.label.toLowerCase() === level || (level === 'verzoegert' && l.label === 'Verzögert'));
            const itemNames = (order.items ?? []).map(i => i.name ?? i.title ?? '').filter(Boolean).slice(0, 3).join(', ');
            return (
              <div key={order.id} className={cn('px-4 py-2.5 flex items-center gap-3', cfg.bg)}>
                <Clock className={cn('h-4 w-4 shrink-0', cfg.icon)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-sm">#{order.bestellnummer ?? order.id.slice(-6)}</span>
                    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-black', cfg.badge, level === 'kritisch' ? 'animate-pulse' : '')}>
                      {levelCfg?.label ?? level}
                    </span>
                  </div>
                  {itemNames && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{itemNames}</p>}
                </div>
                <div className="text-right shrink-0">
                  <span className={cn('text-lg font-black tabular-nums', cfg.icon)}>{Math.round(warteMin)}</span>
                  <span className="text-[10px] text-muted-foreground ml-0.5">Min</span>
                </div>
              </div>
            );
          })}
          <div className="px-4 py-2 bg-muted/20">
            <p className="text-[10px] text-muted-foreground">Prep-Ziel: {PREP_ZIEL_MIN} Min · Kritisch: ≥30 Min · Hoch: ≥20 Min · Verzögert: ≥{PREP_ZIEL_MIN} Min</p>
          </div>
        </div>
      )}
    </div>
  );
}
