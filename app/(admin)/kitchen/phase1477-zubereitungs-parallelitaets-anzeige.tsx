'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';

// Phase 1477 — Zubereitungs-Parallelitäts-Anzeige (Kitchen)
// Wieviele Bestellungen laufen gleichzeitig in Zubereitung + Kapazitätsampel + Überlast-Warnung.
// Props-basiert. Nach Phase 1472.

interface Order {
  id: string;
  status: string;
  bestellnummer?: string | null;
}

interface Props {
  orders: Order[];
  maxKapazitaet?: number;
}

const MAX_DEFAULT = 5;

type Ampel = 'gruen' | 'gelb' | 'rot';

function calcAmpel(aktiv: number, max: number): Ampel {
  const ratio = aktiv / max;
  if (ratio >= 1.0) return 'rot';
  if (ratio >= 0.6) return 'gelb';
  return 'gruen';
}

const AMPEL_CFG: Record<Ampel, { label: string; ringCls: string; textCls: string; bgCls: string; borderCls: string }> = {
  gruen: {
    label: 'Normal',
    ringCls: 'stroke-emerald-500',
    textCls: 'text-emerald-700 dark:text-emerald-400',
    bgCls: 'bg-emerald-50 dark:bg-emerald-900/20',
    borderCls: 'border-emerald-200 dark:border-emerald-800',
  },
  gelb: {
    label: 'Hoch',
    ringCls: 'stroke-amber-500',
    textCls: 'text-amber-700 dark:text-amber-400',
    bgCls: 'bg-amber-50 dark:bg-amber-900/20',
    borderCls: 'border-amber-200 dark:border-amber-800',
  },
  rot: {
    label: 'Überlast',
    ringCls: 'stroke-rose-500',
    textCls: 'text-rose-700 dark:text-rose-400',
    bgCls: 'bg-rose-50 dark:bg-rose-900/20',
    borderCls: 'border-rose-200 dark:border-rose-800',
  },
};

const SIZE = 72;
const STROKE = 7;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

export function KitchenPhase1477ZubereitungsParallelitaetsAnzeige({ orders, maxKapazitaet }: Props) {
  const max = maxKapazitaet ?? MAX_DEFAULT;

  const { inZubereitung, ampel } = useMemo(() => {
    const active = orders.filter((o) => o.status === 'in_zubereitung');
    return { inZubereitung: active, ampel: calcAmpel(active.length, max) };
  }, [orders, max]);

  const count = inZubereitung.length;
  if (count === 0) return null;

  const cfg = AMPEL_CFG[ampel];
  const fill = Math.min(count / max, 1);
  const dashOffset = CIRC * (1 - fill);

  return (
    <Card className={cn('overflow-hidden border', cfg.borderCls)}>
      <div className={cn('flex items-center gap-2 px-4 py-2.5 border-b', cfg.bgCls)}>
        <ChefHat className={cn('h-4 w-4 shrink-0', cfg.textCls)} />
        <span className="text-xs font-bold uppercase tracking-wider">Parallelitäts-Anzeige</span>
        <span className={cn('ml-auto text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 border', cfg.textCls, cfg.bgCls, cfg.borderCls)}>
          {cfg.label}
        </span>
      </div>

      <div className="flex items-center gap-4 px-4 py-3">
        {/* SVG Ring */}
        <div className="relative shrink-0">
          <svg width={SIZE} height={SIZE} className="-rotate-90">
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              stroke="currentColor"
              strokeWidth={STROKE}
              className="text-muted/30"
            />
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={dashOffset}
              className={cfg.ringCls}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn('text-xl font-black tabular-nums leading-none', cfg.textCls)}>{count}</span>
            <span className="text-[9px] text-muted-foreground font-medium">/ {max}</span>
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 space-y-1.5">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">In Zubereitung</div>
            <div className={cn('text-2xl font-black tabular-nums', cfg.textCls)}>{count}</div>
          </div>
          <div className="text-xs text-muted-foreground">
            Kapazität: <span className="font-semibold text-foreground">{max} parallel</span>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', ampel === 'rot' ? 'bg-rose-500' : ampel === 'gelb' ? 'bg-amber-400' : 'bg-emerald-500')}
              style={{ width: `${Math.min(fill * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Überlast-Warnung */}
      {ampel === 'rot' && (
        <div className={cn('flex items-center gap-2 px-4 py-2 border-t text-xs font-semibold', cfg.bgCls, cfg.borderCls, cfg.textCls)}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>Überlast! {count - max} Bestellung{count - max > 1 ? 'en' : ''} über Kapazität — Priorisierung empfohlen.</span>
        </div>
      )}
      {ampel === 'gruen' && count > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 border-t text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          <span>Kapazität gut — Küche läuft reibungslos.</span>
        </div>
      )}
    </Card>
  );
}
