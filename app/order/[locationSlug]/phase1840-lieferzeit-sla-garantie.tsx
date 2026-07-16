'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Shield, Clock, Tag, CheckCircle2, AlertTriangle, X } from 'lucide-react';

/**
 * Phase 1840 — Lieferzeit-SLA-Garantie-Widget (Storefront)
 *
 * ETA ≤ 30 Min → grünes Garantie-Badge
 * ETA 30–45 Min → gelbes Widget mit Hinweis
 * ETA >45 Min   → automatisches 10%-Rabatt-Angebot
 * Hydration-safe (mounted guard).
 */

interface Props {
  etaMinuten: number;
  locationId: string;
  className?: string;
}

type SlaStatus = 'garantiert' | 'verlaengert' | 'rabatt';

function ermittleSlaStatus(eta: number): SlaStatus {
  if (eta <= 30) return 'garantiert';
  if (eta <= 45) return 'verlaengert';
  return 'rabatt';
}

const STATUS_CONFIG: Record<SlaStatus, {
  bg: string; border: string; icon: React.ReactNode; titel: string;
  text: string; textFarbe: string; badgeBg: string; badgeText: string;
}> = {
  garantiert: {
    bg: 'bg-matcha-50 dark:bg-matcha-950/30',
    border: 'border-matcha-200 dark:border-matcha-700',
    icon: <Shield className="h-4 w-4 text-matcha-600 dark:text-matcha-400 fill-matcha-100 dark:fill-matcha-900/50" />,
    titel: 'Liefer-Garantie',
    text: 'Wir garantieren deine Lieferung in unter 30 Minuten!',
    textFarbe: 'text-matcha-700 dark:text-matcha-300',
    badgeBg: 'bg-matcha-100 dark:bg-matcha-900/40',
    badgeText: 'text-matcha-700 dark:text-matcha-300',
  },
  verlaengert: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-700',
    icon: <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
    titel: 'Etwas länger als gewöhnlich',
    text: 'Wir geben unser Bestes, deine Lieferung so schnell wie möglich zu bringen.',
    textFarbe: 'text-amber-700 dark:text-amber-300',
    badgeBg: 'bg-amber-100 dark:bg-amber-900/40',
    badgeText: 'text-amber-700 dark:text-amber-300',
  },
  rabatt: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-700',
    icon: <Tag className="h-4 w-4 text-red-600 dark:text-red-400" />,
    titel: '10% Rabatt auf deine Bestellung',
    text: 'Entschuldigung für die längere Lieferzeit. Als Dankeschön erhältst du 10% Rabatt auf deinen nächsten Einkauf.',
    textFarbe: 'text-red-700 dark:text-red-300',
    badgeBg: 'bg-red-100 dark:bg-red-900/40',
    badgeText: 'text-red-700 dark:text-red-300',
  },
};

export function StorefrontPhase1840LieferzeitSlaGarantie({ etaMinuten, locationId, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || dismissed) return null;

  const slaStatus = ermittleSlaStatus(etaMinuten);
  const cfg = STATUS_CONFIG[slaStatus];

  return (
    <div className={cn(
      'rounded-2xl border px-4 py-3 flex items-start gap-3 relative',
      cfg.bg, cfg.border,
      className,
    )}>
      <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full mt-0.5', cfg.badgeBg)}>
        {cfg.icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('text-xs font-bold', cfg.textFarbe)}>{cfg.titel}</span>
          <span className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums',
            cfg.badgeBg, cfg.badgeText,
          )}>
            {slaStatus === 'garantiert' && <CheckCircle2 className="h-3 w-3" />}
            {slaStatus === 'verlaengert' && <AlertTriangle className="h-3 w-3" />}
            {slaStatus === 'rabatt' && <Tag className="h-3 w-3" />}
            {etaMinuten} Min
          </span>
        </div>
        <p className={cn('text-[11px] mt-0.5 leading-relaxed', cfg.textFarbe)}>
          {cfg.text}
        </p>
        {slaStatus === 'rabatt' && (
          <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-red-200/70 dark:bg-red-900/40 border border-red-300 dark:border-red-700 px-2 py-1">
            <Tag className="h-3 w-3 text-red-600 dark:text-red-400" />
            <span className="text-[10px] font-black text-red-700 dark:text-red-300">Code: SORRY10</span>
          </div>
        )}
        {slaStatus === 'garantiert' && (
          <div className="mt-1 flex items-center gap-1">
            <div className="h-1 w-16 rounded-full bg-matcha-200 dark:bg-matcha-800 overflow-hidden">
              <div
                className="h-full bg-matcha-500 rounded-full"
                style={{ width: `${Math.min(100, (etaMinuten / 30) * 100)}%` }}
              />
            </div>
            <span className="text-[9px] text-matcha-600 dark:text-matcha-400 font-semibold">{etaMinuten}/30 Min</span>
          </div>
        )}
      </div>

      <button
        onClick={() => setDismissed(true)}
        aria-label="Schließen"
        className="shrink-0 rounded-full p-1 hover:bg-black/10 transition-colors"
      >
        <X className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}
