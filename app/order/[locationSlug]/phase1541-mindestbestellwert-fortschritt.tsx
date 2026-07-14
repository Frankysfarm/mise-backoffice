'use client';

import React, { useEffect, useState } from 'react';

interface Props {
  cartTotalCents: number;
  minOrderCents?: number;
  locationSlug?: string;
}

export function StorefrontPhase1541MindestbestellwertFortschritt({
  cartTotalCents,
  minOrderCents = 1500,
  locationSlug = '',
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;
  if (cartTotalCents >= minOrderCents) return null;

  const remaining = minOrderCents - cartTotalCents;
  const pct = Math.min(100, Math.round((cartTotalCents / minOrderCents) * 100));

  const formatEur = (cents: number) =>
    (cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div
      className="rounded-xl border border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30 px-4 py-3 space-y-2"
      role="status"
      aria-label={`Noch ${formatEur(remaining)} € bis zum Mindestbestellwert`}
    >
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-orange-800 dark:text-orange-300">
          🛒 Noch {formatEur(remaining)} € bis Mindestbestellwert
        </span>
        <span className="text-orange-600 dark:text-orange-400 font-mono">{pct}%</span>
      </div>
      <div className="h-2 bg-orange-200 dark:bg-orange-900/50 rounded-full overflow-hidden">
        <div
          className="h-full bg-orange-500 dark:bg-orange-400 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-orange-600 dark:text-orange-400">
        Mindestbestellwert: {formatEur(minOrderCents)} €
      </p>
    </div>
  );
}
