'use client';

import { useEffect, useState, useCallback } from 'react';
import { Euro, TrendingUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeeInfo {
  baseFeeEur:       number;
  surgeMultiplier:  number;
  totalFeeEur:      number;
  isFreeDelivery:   boolean;
  breakdown:        string;
}

interface PricingStatus {
  isEnabled:    boolean;
  avgMultiplier: number | null;
  surgeEvents:  number;
}

interface Props {
  locationSlug?: string;
}

export function FahrerGebuehrenInfo({ locationSlug }: Props) {
  const [fee, setFee]       = useState<FeeInfo | null>(null);
  const [pricing, setPricing] = useState<PricingStatus | null>(null);

  const loadPricing = useCallback(async () => {
    try {
      const res = await fetch('/api/delivery/admin/dynamic-pricing?action=dashboard');
      if (!res.ok) return;
      const d = await res.json() as {
        config: { isEnabled: boolean };
        todayStats: { avgMultiplier: number | null; surgeEvents: number };
      };
      setPricing({
        isEnabled:     d.config.isEnabled,
        avgMultiplier: d.todayStats.avgMultiplier,
        surgeEvents:   d.todayStats.surgeEvents,
      });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    void loadPricing();
    const iv = setInterval(() => void loadPricing(), 120_000);
    return () => clearInterval(iv);
  }, [loadPricing]);

  if (!pricing?.isEnabled) return null;

  const hasSurge = (pricing.surgeEvents ?? 0) > 0;
  const avgMult  = pricing.avgMultiplier;

  return (
    <div className={cn(
      'rounded-xl border p-3 space-y-2',
      hasSurge
        ? 'bg-amber-50 border-amber-200'
        : 'bg-stone-50 border-stone-200',
    )}>
      <div className="flex items-center gap-2">
        {hasSurge ? (
          <Zap className="h-4 w-4 text-amber-500" />
        ) : (
          <Euro className="h-4 w-4 text-stone-400" />
        )}
        <span className={cn('text-sm font-semibold', hasSurge ? 'text-amber-800' : 'text-stone-600')}>
          {hasSurge ? 'Stoßzeit — Erhöhte Liefergebühren' : 'Normaltarif aktiv'}
        </span>
      </div>
      {hasSurge && avgMult && (
        <div className="flex items-center gap-2 text-xs text-amber-700">
          <TrendingUp className="h-3 w-3" />
          <span>Durchschnittlicher Multiplikator heute: ×{avgMult.toFixed(2)}</span>
        </div>
      )}
      <p className="text-xs text-stone-500">
        {hasSurge
          ? 'Mehr Bestellungen durch höhere Nachfrage — gute Zeit für maximale Touren!'
          : 'Ruhige Phase — mögliche Off-Peak-Rabatte für Kunden aktiv.'}
      </p>
    </div>
  );
}
