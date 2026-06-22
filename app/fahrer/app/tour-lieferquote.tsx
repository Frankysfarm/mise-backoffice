'use client';

/**
 * TourLieferquote — Phase 427
 * Zeigt die Pünktlichkeitsquote der aktuellen Tour:
 * Wieviele Stopps wurden rechtzeitig geliefert?
 * Mit farbkodiertem Ring und Fortschrittsbalken.
 */

import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, Package } from 'lucide-react';

interface Stop {
  geliefert_am: string | null;
  angekommen_am?: string | null;
  order: Record<string, unknown> & {
    eta_earliest?: string | null;
    eta_latest?: string | null;
    geschaetzte_lieferung_min?: number | null;
  } | null;
}

interface TourLieferquoteBatch {
  started_at: string | null;
  total_eta_min?: number | null;
  stops: Stop[];
}

interface Props {
  activeBatch: TourLieferquoteBatch | null;
}

function isOnTime(stop: Stop): boolean {
  if (!stop.geliefert_am) return false;
  const deliveredAt = new Date(stop.geliefert_am).getTime();
  if (stop.order?.eta_latest) {
    return deliveredAt <= new Date(stop.order.eta_latest).getTime();
  }
  // Fallback: check if delivered within scheduled time
  if (stop.order?.eta_earliest) {
    const etaMs = new Date(stop.order.eta_earliest).getTime();
    return deliveredAt <= etaMs + 5 * 60_000; // 5-Min Puffer
  }
  return true; // If no ETA, assume on-time
}

export function TourLieferquote({ activeBatch }: Props) {
  if (!activeBatch || activeBatch.stops.length === 0) return null;

  const total = activeBatch.stops.length;
  const delivered = activeBatch.stops.filter((s) => s.geliefert_am).length;
  const remaining = total - delivered;
  const onTimeCount = activeBatch.stops.filter(isOnTime).length;
  const onTimePct = delivered > 0 ? Math.round((onTimeCount / delivered) * 100) : null;
  const progressPct = Math.round((delivered / total) * 100);

  const color =
    onTimePct === null ? 'text-stone-400' :
    onTimePct >= 90 ? 'text-matcha-500' :
    onTimePct >= 70 ? 'text-amber-500' :
    'text-red-500';

  const barColor =
    onTimePct === null ? 'bg-stone-300' :
    onTimePct >= 90 ? 'bg-matcha-500' :
    onTimePct >= 70 ? 'bg-amber-400' :
    'bg-red-500';

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-bold uppercase tracking-widest text-matcha-400 flex items-center gap-1.5">
          <Package size={10} />
          Tour-Fortschritt
        </div>
        {onTimePct !== null && (
          <div className={cn('text-xs font-black tabular-nums', color)}>
            {onTimePct}% pünktlich
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="relative h-2 w-full rounded-full bg-white/10 overflow-hidden mb-2">
        <div
          className={cn('h-full rounded-full transition-all duration-700', barColor)}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-matcha-300">
            <CheckCircle2 size={10} />
            <strong className="text-white">{delivered}</strong> geliefert
          </span>
          {remaining > 0 && (
            <span className="flex items-center gap-1 text-matcha-400">
              <Clock size={10} />
              <strong className="text-white">{remaining}</strong> ausstehend
            </span>
          )}
        </div>
        <span className="text-matcha-500 text-[10px] font-bold tabular-nums">
          {delivered}/{total}
        </span>
      </div>
    </div>
  );
}
