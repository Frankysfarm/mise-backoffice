'use client';

import { useEffect, useState } from 'react';

interface Props {
  status: string | null | undefined;
  isDelivery: boolean;
  etaMinuten?: number;
  bestelltAt?: string;
}

type StatusConfig = {
  emoji: string;
  label: string;
  sublabel: string;
  animate: boolean;
  color: string;
};

function getConfig(status: string | null | undefined, isDelivery: boolean): StatusConfig {
  switch (status) {
    case 'pending':
      return {
        emoji: '⏳',
        label: 'Bestellung wird geprüft',
        sublabel: 'Einen Moment bitte...',
        animate: true,
        color: 'text-amber-600 dark:text-amber-400',
      };
    case 'confirmed':
      return {
        emoji: '✅',
        label: 'Bestätigt!',
        sublabel: 'Küche bereitet vor',
        animate: false,
        color: 'text-emerald-600 dark:text-emerald-400',
      };
    case 'preparing':
      return {
        emoji: '👨‍🍳',
        label: 'Wird zubereitet',
        sublabel: 'Küche ist dran',
        animate: true,
        color: 'text-orange-600 dark:text-orange-400',
      };
    case 'ready':
      return {
        emoji: isDelivery ? '🚀' : '🛎️',
        label: isDelivery ? 'Bereit zur Abfahrt' : 'Abholbereit!',
        sublabel: isDelivery ? 'Fahrer kommt gleich' : 'Deine Bestellung wartet',
        animate: true,
        color: 'text-indigo-600 dark:text-indigo-400',
      };
    case 'on_route':
    case 'assigned':
      return {
        emoji: '🛵',
        label: 'Unterwegs!',
        sublabel: isDelivery ? 'Fahrer ist auf dem Weg' : 'Fast fertig',
        animate: true,
        color: 'text-indigo-600 dark:text-indigo-400',
      };
    case 'delivered':
    case 'completed':
      return {
        emoji: '🎉',
        label: isDelivery ? 'Geliefert!' : 'Abgeholt!',
        sublabel: 'Guten Appetit!',
        animate: false,
        color: 'text-emerald-600 dark:text-emerald-400',
      };
    case 'cancelled':
      return {
        emoji: '❌',
        label: 'Storniert',
        sublabel: 'Bestellung wurde abgesagt',
        animate: false,
        color: 'text-red-600 dark:text-red-400',
      };
    default:
      return {
        emoji: '📋',
        label: 'Bestellung aufgegeben',
        sublabel: 'Wird bearbeitet',
        animate: false,
        color: 'text-muted-foreground',
      };
  }
}

export function Phase705LiveLieferstatusEmoji({ status, isDelivery, etaMinuten, bestelltAt }: Props) {
  const [pulse, setPulse] = useState(false);
  const cfg = getConfig(status, isDelivery);

  useEffect(() => {
    if (!cfg.animate) return;
    const id = setInterval(() => setPulse((p) => !p), 800);
    return () => clearInterval(id);
  }, [cfg.animate]);

  // Remaining minutes calculation
  let remainingMin: number | null = null;
  if (bestelltAt && etaMinuten && status && !['delivered', 'completed', 'cancelled'].includes(status)) {
    const etaMs = new Date(bestelltAt).getTime() + etaMinuten * 60_000;
    remainingMin = Math.max(0, Math.ceil((etaMs - Date.now()) / 60_000));
  }

  return (
    <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <span
          className={`text-3xl transition-opacity duration-300 ${cfg.animate && pulse ? 'opacity-60' : 'opacity-100'}`}
          role="img"
          aria-label={cfg.label}
        >
          {cfg.emoji}
        </span>
        <div>
          <p className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</p>
          <p className="text-[10px] text-muted-foreground">{cfg.sublabel}</p>
        </div>
      </div>
      {remainingMin !== null && remainingMin > 0 && (
        <div className="text-right">
          <p className="text-xl font-bold tabular-nums text-indigo-700 dark:text-indigo-400">
            {remainingMin} Min
          </p>
          <p className="text-[9px] text-muted-foreground">verbleibend</p>
        </div>
      )}
      {status === 'delivered' || status === 'completed' ? (
        <span className="text-2xl">😊</span>
      ) : null}
    </div>
  );
}
