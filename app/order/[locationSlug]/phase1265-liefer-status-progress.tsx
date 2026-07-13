'use client';

// Phase 1265 — Liefer-Status-Progress (Storefront)
// Farbkodierter mehrstufiger Fortschrittsbalken mit aktuellem Lieferstatus + ETA
// Props: status, etaMin, placedAt · props-basiert

import { Clock, ChefHat, Package, Bike, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type OrderStatus =
  | 'pending' | 'confirmed' | 'preparing' | 'ready' | 'dispatched'
  | 'in_delivery' | 'delivered' | 'completed'
  | 'bestätigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert';

interface Props {
  status: OrderStatus | string;
  etaMin?: number | null;
  placedAt?: string | null;
}

const STAGES: Array<{
  key: string[];
  label: string;
  icon: React.ElementType;
  color: string;
  activeBg: string;
  activeText: string;
}> = [
  {
    key: ['pending', 'confirmed', 'bestätigt'],
    label: 'Bestätigt',
    icon: CheckCircle2,
    color: 'bg-matcha-500',
    activeBg: 'bg-matcha-50 dark:bg-matcha-950/40',
    activeText: 'text-matcha-700 dark:text-matcha-300',
  },
  {
    key: ['preparing', 'in_zubereitung'],
    label: 'Zubereitung',
    icon: ChefHat,
    color: 'bg-amber-500',
    activeBg: 'bg-amber-50 dark:bg-amber-950/40',
    activeText: 'text-amber-700 dark:text-amber-300',
  },
  {
    key: ['ready', 'fertig'],
    label: 'Abholbereit',
    icon: Package,
    color: 'bg-blue-500',
    activeBg: 'bg-blue-50 dark:bg-blue-950/40',
    activeText: 'text-blue-700 dark:text-blue-300',
  },
  {
    key: ['dispatched', 'in_delivery', 'unterwegs'],
    label: 'Unterwegs',
    icon: Bike,
    color: 'bg-orange-500',
    activeBg: 'bg-orange-50 dark:bg-orange-950/40',
    activeText: 'text-orange-700 dark:text-orange-300',
  },
  {
    key: ['delivered', 'completed', 'geliefert'],
    label: 'Geliefert',
    icon: CheckCircle2,
    color: 'bg-green-500',
    activeBg: 'bg-green-50 dark:bg-green-950/40',
    activeText: 'text-green-700 dark:text-green-300',
  },
];

function stageIndex(status: string): number {
  const lc = status.toLowerCase();
  const idx = STAGES.findIndex(s => s.key.some(k => k === lc || lc.includes(k)));
  return idx >= 0 ? idx : 0;
}

function etaLabel(etaMin: number | null | undefined, placedAt: string | null | undefined): string | null {
  if (etaMin != null) return `Noch ca. ${etaMin} Min`;
  if (!placedAt) return null;
  const elapsed = Math.floor((Date.now() - new Date(placedAt).getTime()) / 60000);
  const remaining = Math.max(0, 35 - elapsed);
  return remaining > 0 ? `Noch ca. ${remaining} Min` : 'Jeden Moment';
}

export function Phase1265LieferStatusProgress({ status, etaMin, placedAt }: Props) {
  const activeIdx = stageIndex(status);
  const isDelivered = activeIdx === STAGES.length - 1;
  const currentStage = STAGES[activeIdx];
  const eta = etaLabel(etaMin, placedAt);

  return (
    <div className={cn('rounded-xl border p-4 shadow-sm', currentStage.activeBg, 'border-current/10')}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <currentStage.icon className={cn('h-4 w-4', currentStage.activeText)} />
          <span className={cn('text-sm font-bold', currentStage.activeText)}>{currentStage.label}</span>
          {!isDelivered && (
            <span className="inline-block h-2 w-2 rounded-full bg-current animate-pulse ml-0.5 opacity-70" />
          )}
        </div>
        {eta && !isDelivered && (
          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <Clock className="h-3 w-3" />
            <span>{eta}</span>
          </div>
        )}
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-0">
        {STAGES.map((stage, idx) => {
          const done = idx < activeIdx;
          const active = idx === activeIdx;
          const Icon = stage.icon;
          return (
            <div key={stage.label} className="flex flex-1 items-center">
              {/* Circle */}
              <div className="relative flex shrink-0 flex-col items-center">
                <div
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all',
                    done
                      ? cn('border-transparent', stage.color, 'text-white')
                      : active
                      ? cn('border-current', currentStage.color.replace('bg-', 'border-'), currentStage.activeText, 'bg-white dark:bg-slate-900')
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-300 dark:text-slate-600',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span
                  className={cn(
                    'absolute top-8 text-xs whitespace-nowrap font-medium',
                    done ? 'text-slate-500 dark:text-slate-400' :
                    active ? currentStage.activeText :
                    'text-slate-300 dark:text-slate-600',
                  )}
                >
                  {stage.label}
                </span>
              </div>
              {/* Connector line (not after last) */}
              {idx < STAGES.length - 1 && (
                <div
                  className={cn(
                    'h-0.5 flex-1 mx-0.5 transition-all',
                    idx < activeIdx ? stage.color : 'bg-slate-200 dark:bg-slate-700',
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
      {/* Spacer for labels */}
      <div className="h-5" />
    </div>
  );
}
