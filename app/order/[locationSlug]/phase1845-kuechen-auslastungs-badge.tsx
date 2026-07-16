'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Flame, ChevronRight } from 'lucide-react';

/**
 * Phase 1845 — Küchen-Auslastungs-Badge (Storefront)
 *
 * Zeigt aktuelle Küchenauslastung: entspannt / normal / beschäftigt / sehr ausgelastet.
 * Hydration-safe. 5-Min-Polling. GET /api/delivery/admin/schicht-kapazitaets-ampel.
 */

type AuslastungsLevel = 'entspannt' | 'normal' | 'beschaeftigt' | 'sehr_ausgelastet';

interface Props {
  locationId: string;
  className?: string;
}

const LEVEL_CONFIG: Record<AuslastungsLevel, {
  label: string;
  subtext: string;
  bg: string;
  border: string;
  text: string;
  iconColor: string;
  flammen: number;
}> = {
  entspannt: {
    label: 'Entspannt',
    subtext: 'Küche hat freie Kapazität',
    bg: 'bg-matcha-50 dark:bg-matcha-950/30',
    border: 'border-matcha-200 dark:border-matcha-700',
    text: 'text-matcha-700 dark:text-matcha-300',
    iconColor: 'text-matcha-500',
    flammen: 1,
  },
  normal: {
    label: 'Normal ausgelastet',
    subtext: 'Normale Wartezeiten',
    bg: 'bg-muted/40',
    border: 'border-border',
    text: 'text-foreground',
    iconColor: 'text-amber-400',
    flammen: 2,
  },
  beschaeftigt: {
    label: 'Beschäftigt',
    subtext: 'Etwas längere Wartezeiten möglich',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-700',
    text: 'text-amber-700 dark:text-amber-300',
    iconColor: 'text-amber-500',
    flammen: 3,
  },
  sehr_ausgelastet: {
    label: 'Sehr ausgelastet',
    subtext: 'Küche arbeitet auf Hochtouren',
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-700',
    text: 'text-red-700 dark:text-red-300',
    iconColor: 'text-red-500',
    flammen: 4,
  },
};

function auslastungZuLevel(prozent: number, wartend: number): AuslastungsLevel {
  if (prozent >= 90 || wartend >= 4) return 'sehr_ausgelastet';
  if (prozent >= 65 || wartend >= 2) return 'beschaeftigt';
  if (prozent >= 35) return 'normal';
  return 'entspannt';
}

export function StorefrontPhase1845KuechenAuslastungsBadge({ locationId, className }: Props) {
  const [level, setLevel] = useState<AuslastungsLevel | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!locationId) return;

    const laden = async () => {
      try {
        const res = await fetch(
          `/api/delivery/admin/schicht-kapazitaets-ampel?location_id=${locationId}`,
          { cache: 'no-store' },
        );
        if (res.ok) {
          const data = await res.json();
          setLevel(auslastungZuLevel(data.auslastungs_prozent ?? 50, data.wartende_bestellungen ?? 0));
        }
      } catch {
        setLevel('normal');
      }
    };

    laden();
    const id = setInterval(laden, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!mounted || !level) return null;

  const cfg = LEVEL_CONFIG[level];

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl border px-4 py-3',
        cfg.bg,
        cfg.border,
        className,
      )}
    >
      {/* Flammen */}
      <div className="flex items-center gap-0.5 shrink-0">
        {Array.from({ length: 4 }).map((_, i) => (
          <Flame
            key={i}
            className={cn(
              'h-4 w-4 transition-opacity',
              i < cfg.flammen ? cfg.iconColor : 'text-muted-foreground/20',
            )}
          />
        ))}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-xs font-bold', cfg.text)}>{cfg.label}</p>
        <p className="text-[10px] text-muted-foreground">{cfg.subtext}</p>
      </div>

      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
    </div>
  );
}
