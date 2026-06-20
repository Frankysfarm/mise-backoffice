'use client';

/**
 * EtaVertrauensAnzeige — Zeigt Kunden wie verlässlich die angezeigte ETA ist.
 * Basiert auf: Küchenauslastung, Fahreranzahl, Entfernung, Tageszeit.
 * Drei Stufen: Hoch / Mittel / Gering (grün / amber / rot).
 */

import { useEffect, useState } from 'react';
import { Shield, ShieldAlert, ShieldCheck, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type ConfidenceLevel = 'high' | 'medium' | 'low';

interface EtaConfidenceData {
  level: ConfidenceLevel;
  reason: string;
  etaMinEarliest: number;
  etaMinLatest: number;
}

interface Props {
  orderId: string | null;
  etaMinEarliest?: number | null;
  etaMinLatest?: number | null;
  kitchenLoad?: 'low' | 'medium' | 'high' | null;
  availableDrivers?: number | null;
}

function deriveConfidence(
  kitchenLoad: string | null,
  availableDrivers: number | null,
  etaMin: number | null,
): EtaConfidenceData {
  const eta = etaMin ?? 30;

  if (kitchenLoad === 'high' || (availableDrivers !== null && availableDrivers < 2)) {
    return {
      level: 'low',
      reason: 'Hohe Auslastung – etwas mehr Zeit einplanen',
      etaMinEarliest: eta + 5,
      etaMinLatest: eta + 15,
    };
  }
  if (kitchenLoad === 'medium' || (availableDrivers !== null && availableDrivers < 4)) {
    return {
      level: 'medium',
      reason: 'Normaler Betrieb – Lieferzeit kann leicht variieren',
      etaMinEarliest: eta - 2,
      etaMinLatest: eta + 8,
    };
  }
  return {
    level: 'high',
    reason: 'Sehr gute Verfügbarkeit – Lieferzeit ist zuverlässig',
    etaMinEarliest: eta - 3,
    etaMinLatest: eta + 3,
  };
}

const LEVEL_CONFIG = {
  high: {
    bg: 'bg-matcha-50',
    border: 'border-matcha-300',
    text: 'text-matcha-700',
    badgeBg: 'bg-matcha-100',
    label: 'Hohe Zuverlässigkeit',
    Icon: ShieldCheck,
    iconColor: 'text-matcha-600',
  },
  medium: {
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    text: 'text-amber-700',
    badgeBg: 'bg-amber-100',
    label: 'Mittlere Zuverlässigkeit',
    Icon: Shield,
    iconColor: 'text-amber-600',
  },
  low: {
    bg: 'bg-red-50',
    border: 'border-red-300',
    text: 'text-red-700',
    badgeBg: 'bg-red-100',
    label: 'Geringe Zuverlässigkeit',
    Icon: ShieldAlert,
    iconColor: 'text-red-500',
  },
} as const;

export function EtaVertrauensAnzeige({
  orderId,
  etaMinEarliest,
  etaMinLatest,
  kitchenLoad,
  availableDrivers,
}: Props) {
  const [confidence, setConfidence] = useState<EtaConfidenceData | null>(null);

  useEffect(() => {
    if (!orderId) return;

    const avgEta = etaMinEarliest != null && etaMinLatest != null
      ? Math.round((etaMinEarliest + etaMinLatest) / 2)
      : etaMinEarliest ?? etaMinLatest ?? null;

    const data = deriveConfidence(kitchenLoad ?? null, availableDrivers ?? null, avgEta);
    setConfidence(data);

    if (!kitchenLoad && !availableDrivers) {
      fetch(`/api/delivery/eta?orderId=${encodeURIComponent(orderId)}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.kitchenLoad || d.availableDrivers !== undefined) {
            setConfidence(deriveConfidence(d.kitchenLoad, d.availableDrivers, avgEta));
          }
        })
        .catch(() => {});
    }
  }, [orderId, etaMinEarliest, etaMinLatest, kitchenLoad, availableDrivers]);

  if (!confidence) return null;

  const cfg = LEVEL_CONFIG[confidence.level];
  const { Icon } = cfg;

  return (
    <div className={cn('rounded-2xl border px-4 py-3 flex items-start gap-3', cfg.bg, cfg.border)}>
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', cfg.badgeBg)}>
        <Icon className={cn('h-5 w-5', cfg.iconColor)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className={cn('text-xs font-bold', cfg.text)}>{cfg.label}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{confidence.reason}</div>
        {(confidence.etaMinEarliest > 0 || confidence.etaMinLatest > 0) && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-[11px] font-bold text-foreground">
              {confidence.etaMinEarliest}–{confidence.etaMinLatest} Min
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
