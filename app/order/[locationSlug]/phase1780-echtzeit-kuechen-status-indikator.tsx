'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, X } from 'lucide-react';

/**
 * Phase 1780 — Echtzeit-Küchenstatus-Indikator (Storefront)
 *
 * "Küche entspannt / normal / beschäftigt" basierend auf aktiver Bestelllast.
 * Reuses /api/delivery/public/kuechen-status; Hydration-safe; 5-Min-Polling; schließbar.
 */

type KuechenStatus = 'frei' | 'normal' | 'beschaeftigt' | 'sehr_beschaeftigt';

interface KuechenStatusAntwort {
  status: KuechenStatus;
  aktive_bestellungen: number;
  eta_aufschlag_min: number;
}

interface Props {
  locationId: string;
  className?: string;
}

const STATUS_CONFIG: Record<KuechenStatus, {
  label: string;
  sublabel: string;
  bg: string;
  border: string;
  text: string;
  dot: string;
}> = {
  frei: {
    label: 'Küche entspannt',
    sublabel: 'Kurze Wartezeiten — perfekter Zeitpunkt!',
    bg: 'bg-matcha-50 dark:bg-matcha-900/20',
    border: 'border-matcha-200 dark:border-matcha-800',
    text: 'text-matcha-800 dark:text-matcha-200',
    dot: 'bg-matcha-500',
  },
  normal: {
    label: 'Küche normal ausgelastet',
    sublabel: 'Gewohnte Lieferzeiten',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-800 dark:text-blue-200',
    dot: 'bg-blue-500',
  },
  beschaeftigt: {
    label: 'Küche beschäftigt',
    sublabel: 'Etwas längere Wartezeit möglich',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-800 dark:text-amber-200',
    dot: 'bg-amber-500',
  },
  sehr_beschaeftigt: {
    label: 'Küche stark ausgelastet',
    sublabel: 'Höhere Nachfrage — wir geben alles!',
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-800 dark:text-red-200',
    dot: 'bg-red-500',
  },
};

export function StorefrontPhase1780EchtzeitKuechenStatusIndikator({ locationId, className }: Props) {
  const [data, setData] = useState<KuechenStatusAntwort | null>(null);
  const [mounted, setMounted] = useState(false);
  const [geschlossen, setGeschlossen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !locationId) return;

    async function load() {
      try {
        const res = await fetch(`/api/delivery/public/kuechen-status?location_id=${locationId}`);
        if (res.ok) setData(await res.json());
      } catch {}
    }

    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [mounted, locationId]);

  if (!mounted || !data || geschlossen) return null;

  const cfg = STATUS_CONFIG[data.status];

  return (
    <div className={cn(
      'flex items-start gap-3 rounded-xl border p-3 mx-4 mt-2',
      cfg.bg, cfg.border, className,
    )}>
      {/* Status-Punkt animiert */}
      <div className="mt-0.5 shrink-0 flex items-center justify-center">
        <span className="relative flex h-3 w-3">
          <span className={cn(
            'animate-ping absolute inline-flex h-full w-full rounded-full opacity-60',
            cfg.dot,
          )} />
          <span className={cn('relative inline-flex h-3 w-3 rounded-full', cfg.dot)} />
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <ChefHat className={cn('h-3.5 w-3.5 shrink-0', cfg.text)} />
          <p className={cn('text-xs font-bold', cfg.text)}>{cfg.label}</p>
        </div>
        <p className={cn('text-[10px] mt-0.5', cfg.text, 'opacity-80')}>{cfg.sublabel}</p>
        {data.eta_aufschlag_min > 0 && (
          <p className={cn('text-[10px] font-bold mt-0.5', cfg.text)}>
            +{data.eta_aufschlag_min} Min Aufschlag auf ETA
          </p>
        )}
      </div>

      <button
        onClick={() => setGeschlossen(true)}
        className={cn('shrink-0 rounded p-0.5 hover:bg-black/10 transition', cfg.text)}
        aria-label="Schließen"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
