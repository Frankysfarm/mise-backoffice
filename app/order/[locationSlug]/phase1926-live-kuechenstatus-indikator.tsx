'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, X } from 'lucide-react';

/**
 * Phase 1926 — Live-Küchenstatus-Indikator (Storefront)
 *
 * "Küche auf Hochtouren" / "Normale Auslastung" / "Ruhige Phase"
 * basierend auf offenen Bestellungen; Hydration-safe; 5-Min-Polling.
 */

type KuechenStatus = 'hoch' | 'normal' | 'ruhig';

interface KuechenDaten {
  offene_bestellungen: number;
  status: KuechenStatus;
}

const MOCK: KuechenDaten = { offene_bestellungen: 7, status: 'normal' };

interface Props {
  locationId: string;
  className?: string;
}

function berechneStatus(offene: number): KuechenStatus {
  if (offene >= 10) return 'hoch';
  if (offene >= 4) return 'normal';
  return 'ruhig';
}

const STATUS_CONFIG: Record<KuechenStatus, { text: string; sub: string; border: string; bg: string; textFarbe: string; iconFarbe: string; closeFarbe: string }> = {
  hoch: {
    text: 'Küche auf Hochtouren',
    sub: 'Etwas längere Wartezeiten möglich — wir geben alles!',
    border: 'border-orange-200 dark:border-orange-800',
    bg: 'bg-orange-50 dark:bg-orange-950/20',
    textFarbe: 'text-orange-800 dark:text-orange-200',
    iconFarbe: 'text-orange-600 dark:text-orange-400',
    closeFarbe: 'hover:bg-orange-100 dark:hover:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  },
  normal: {
    text: 'Normale Auslastung',
    sub: 'Deine Bestellung wird in gewohnter Zeit zubereitet.',
    border: 'border-green-200 dark:border-green-800',
    bg: 'bg-green-50 dark:bg-green-950/20',
    textFarbe: 'text-green-800 dark:text-green-200',
    iconFarbe: 'text-green-600 dark:text-green-400',
    closeFarbe: 'hover:bg-green-100 dark:hover:bg-green-900/30 text-green-700 dark:text-green-300',
  },
  ruhig: {
    text: 'Ruhige Phase',
    sub: 'Besonders schnelle Zubereitung — ideal zum Bestellen!',
    border: 'border-blue-200 dark:border-blue-800',
    bg: 'bg-blue-50 dark:bg-blue-950/20',
    textFarbe: 'text-blue-800 dark:text-blue-200',
    iconFarbe: 'text-blue-600 dark:text-blue-400',
    closeFarbe: 'hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  },
};

export function Phase1926LiveKuechenstatusIndikator({ locationId, className }: Props) {
  const [daten, setDaten] = useState<KuechenDaten | null>(null);
  const [geschlossen, setGeschlossen] = useState(false);
  const [gemountet, setGemountet] = useState(false);

  useEffect(() => { setGemountet(true); }, []);

  useEffect(() => {
    if (!gemountet) return;

    const laden = async () => {
      try {
        const res = await fetch(`/api/delivery/public/avg-eta?location_id=${locationId}`);
        if (!res.ok) throw new Error('API Fehler');
        const json = await res.json();
        const offene: number = json.pending_orders ?? json.open_orders ?? json.queue_length ?? 0;
        setDaten({ offene_bestellungen: offene, status: berechneStatus(offene) });
      } catch {
        setDaten(MOCK);
      }
    };

    laden();
    const id = setInterval(laden, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [gemountet, locationId]);

  if (!gemountet || !daten || geschlossen) return null;

  const cfg = STATUS_CONFIG[daten.status];

  return (
    <div className={cn('relative rounded-2xl border flex items-center gap-3 px-4 py-3 shadow-sm', cfg.border, cfg.bg, className)}>
      <ChefHat className={cn('h-5 w-5 shrink-0', cfg.iconFarbe)} />
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-bold', cfg.textFarbe)}>{cfg.text}</p>
        <p className={cn('text-xs mt-0.5 opacity-80', cfg.textFarbe)}>{cfg.sub}</p>
      </div>
      <button
        onClick={() => setGeschlossen(true)}
        className={cn('shrink-0 rounded-full p-1 transition-colors', cfg.closeFarbe)}
        aria-label="Schließen"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
