'use client';

/**
 * SchichtEndSummary — Phase 410
 * Kompaktes Schicht-Abschluss-Banner für den Fahrer wenn die Schicht endet
 * oder die letzten 30 Min angebrochen sind.
 * Zeigt: Umsatz, Lieferungen, Ø Lieferzeit, Trinkgeld, Bonus-Hinweis.
 */

import { Award, Clock, Package, TrendingUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShiftSummary {
  revenueEur: number;
  deliveries: number;
  avgDeliveryMin: number | null;
  tipsEur: number;
  bonusEur: number | null;
  isNearEnd: boolean;
  minutesLeft: number | null;
}

interface Props {
  summary: ShiftSummary | null;
}

export function SchichtEndSummary({ summary }: Props) {
  if (!summary) return null;

  return (
    <div className={cn(
      'rounded-2xl border overflow-hidden',
      summary.isNearEnd
        ? 'bg-gradient-to-br from-amber-900 to-amber-800 border-amber-700'
        : 'bg-gradient-to-br from-matcha-900 to-matcha-800 border-matcha-700',
    )}>
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-2">
        <Award size={16} className="text-accent shrink-0" />
        <span className="text-sm font-bold text-white">
          {summary.isNearEnd && summary.minutesLeft !== null
            ? `Schicht endet in ${summary.minutesLeft} Min`
            : 'Schicht-Zusammenfassung'}
        </span>
        {summary.isNearEnd && (
          <div className="ml-auto">
            <Zap size={14} className="text-accent" />
          </div>
        )}
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-2 px-4 pb-3">
        <div className="rounded-xl bg-white/10 px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={12} className="text-accent" />
            <span className="text-[10px] text-white/70 uppercase tracking-wider">Umsatz</span>
          </div>
          <div className="text-xl font-black text-white tabular-nums">
            {summary.revenueEur.toFixed(2)} €
          </div>
          {summary.tipsEur > 0 && (
            <div className="text-[10px] text-accent mt-0.5">+{summary.tipsEur.toFixed(2)} € Trinkgeld</div>
          )}
        </div>

        <div className="rounded-xl bg-white/10 px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Package size={12} className="text-accent" />
            <span className="text-[10px] text-white/70 uppercase tracking-wider">Lieferungen</span>
          </div>
          <div className="text-xl font-black text-white tabular-nums">{summary.deliveries}</div>
          {summary.avgDeliveryMin !== null && (
            <div className="text-[10px] text-white/60 mt-0.5">
              Ø {Math.round(summary.avgDeliveryMin)} Min
            </div>
          )}
        </div>
      </div>

      {/* Bonus Hinweis */}
      {summary.bonusEur !== null && summary.bonusEur > 0 && (
        <div className="mx-4 mb-3 px-3 py-2 rounded-xl bg-accent/20 border border-accent/30 flex items-center gap-2">
          <Award size={14} className="text-accent shrink-0" />
          <span className="text-xs text-white">
            Bonus: <span className="font-bold text-accent">+{summary.bonusEur.toFixed(2)} €</span> wird verrechnet
          </span>
        </div>
      )}

      {/* End-of-shift motivation */}
      {summary.isNearEnd && (
        <div className="mx-4 mb-3 px-3 py-2 rounded-xl bg-white/10 flex items-center gap-2">
          <Clock size={12} className="text-white/60 shrink-0" />
          <span className="text-xs text-white/70">
            Laufende Touren noch abschließen — danach Check-Out nicht vergessen!
          </span>
        </div>
      )}
    </div>
  );
}
