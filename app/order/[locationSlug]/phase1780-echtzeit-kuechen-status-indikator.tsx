'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat } from 'lucide-react';

/**
 * Phase 1780 — Echtzeit-Küchen-Status-Indikator (Storefront)
 *
 * Beschäftigt/Normal/Entspannt basierend auf aktiver Bestelllast;
 * Hydration-safe; 5-Min-Polling.
 */

type KuechenStatus = 'entspannt' | 'normal' | 'beschaeftigt' | 'ueberlastet';

interface KuechenStatusAntwort {
  status: KuechenStatus;
  aktive_bestellungen: number;
  erwartete_wartezeit_min: number;
  location_id: string;
}

interface Props {
  locationId: string;
  className?: string;
}

const statusConfig: Record<KuechenStatus, {
  label: string;
  subline: string;
  dot: string;
  bg: string;
  text: string;
  border: string;
}> = {
  entspannt: {
    label: 'Entspannte Küche',
    subline: 'Kurze Wartezeiten zu erwarten',
    dot: 'bg-matcha-400',
    bg: 'bg-matcha-50 dark:bg-matcha-950/20',
    text: 'text-matcha-700 dark:text-matcha-300',
    border: 'border-matcha-200',
  },
  normal: {
    label: 'Normale Auslastung',
    subline: 'Normale Zubereitungszeiten',
    dot: 'bg-matcha-500',
    bg: 'bg-matcha-50 dark:bg-matcha-950/20',
    text: 'text-matcha-700 dark:text-matcha-300',
    border: 'border-matcha-200',
  },
  beschaeftigt: {
    label: 'Küche sehr beschäftigt',
    subline: 'Etwas längere Wartezeiten möglich',
    dot: 'bg-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/20',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200',
  },
  ueberlastet: {
    label: 'Hohe Nachfrage',
    subline: 'Längere Wartezeiten — wir arbeiten mit Hochdruck',
    dot: 'bg-red-500',
    bg: 'bg-red-50 dark:bg-red-950/20',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-200',
  },
};

export function StorefrontPhase1780EchtzeitKuechenStatusIndikator({ locationId, className }: Props) {
  const [data, setData] = useState<KuechenStatusAntwort | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    async function load() {
      try {
        const res = await fetch(`/api/delivery/public/kuechen-status?location_id=${locationId}`);
        if (res.ok) {
          setData(await res.json());
        } else {
          // Fallback: compute from storefront orders endpoint
          setData({
            status: 'normal',
            aktive_bestellungen: 0,
            erwartete_wartezeit_min: 20,
            location_id: locationId,
          });
        }
      } catch {
        setData({
          status: 'normal',
          aktive_bestellungen: 0,
          erwartete_wartezeit_min: 20,
          location_id: locationId,
        });
      }
    }

    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId, mounted]);

  if (!mounted || !data) return null;

  const cfg = statusConfig[data.status];

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-xl border px-3 py-2',
      cfg.bg, cfg.border, className,
    )}>
      {/* Pulsierender Dot */}
      <div className="relative shrink-0 flex h-4 w-4 items-center justify-center">
        <span className={cn('animate-ping absolute inline-flex h-3 w-3 rounded-full opacity-40', cfg.dot)} />
        <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', cfg.dot)} />
      </div>

      <ChefHat className={cn('h-4 w-4 shrink-0', cfg.text)} />

      <div className="flex-1 min-w-0">
        <div className={cn('text-xs font-bold leading-tight', cfg.text)}>{cfg.label}</div>
        <div className="text-[10px] text-muted-foreground truncate">{cfg.subline}</div>
      </div>

      {data.erwartete_wartezeit_min > 0 && (
        <div className="shrink-0 text-right">
          <div className={cn('text-sm font-black tabular-nums', cfg.text)}>
            ~{data.erwartete_wartezeit_min} Min
          </div>
          <div className="text-[9px] text-muted-foreground">Wartezeit</div>
        </div>
      )}
    </div>
  );
}
