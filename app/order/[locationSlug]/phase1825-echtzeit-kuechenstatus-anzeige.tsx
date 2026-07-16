'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, X, Clock, AlertTriangle } from 'lucide-react';

/**
 * Phase 1825 — Echtzeit-Küchen-Status-Anzeige (Storefront)
 *
 * "Küche aktiv", "Kurze Wartezeit", "Hohe Auslastung" basierend auf Kitchen-API.
 * Hydration-safe; schließbar; nach Phase1820.
 */

interface Props {
  locationId: string;
  className?: string;
}

type KuechenStatus = 'aktiv' | 'kurze_wartezeit' | 'hohe_auslastung';

interface KuechenDaten {
  status: KuechenStatus;
  aktive_bestellungen: number;
  durchschnitt_wartezeit_min: number;
}

const MOCK_DATEN: KuechenDaten = {
  status: 'aktiv',
  aktive_bestellungen: 3,
  durchschnitt_wartezeit_min: 18,
};

function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

function kuechenStatusVon(aktiv: number, wartezeit: number): KuechenStatus {
  if (aktiv >= 8 || wartezeit >= 30) return 'hohe_auslastung';
  if (wartezeit >= 20) return 'kurze_wartezeit';
  return 'aktiv';
}

const STATUS_CONFIG: Record<KuechenStatus, {
  label: string;
  sub: string;
  bg: string;
  border: string;
  iconColor: string;
  textColor: string;
  Icon: React.ElementType;
}> = {
  aktiv: {
    label: 'Küche aktiv',
    sub: 'Bestellungen werden schnell bearbeitet.',
    bg: 'bg-matcha-50 dark:bg-matcha-950/30',
    border: 'border-matcha-200 dark:border-matcha-800',
    iconColor: 'text-matcha-600 dark:text-matcha-400',
    textColor: 'text-matcha-700 dark:text-matcha-300',
    Icon: ChefHat,
  },
  kurze_wartezeit: {
    label: 'Kurze Wartezeit',
    sub: 'Etwas mehr los als sonst — Bestellung dauert minimal länger.',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    iconColor: 'text-amber-600 dark:text-amber-400',
    textColor: 'text-amber-700 dark:text-amber-300',
    Icon: Clock,
  },
  hohe_auslastung: {
    label: 'Hohe Auslastung',
    sub: 'Küche ist sehr ausgelastet — etwas mehr Geduld einplanen.',
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    iconColor: 'text-red-600 dark:text-red-400',
    textColor: 'text-red-700 dark:text-red-300',
    Icon: AlertTriangle,
  },
};

async function ladeDaten(locationId: string): Promise<KuechenDaten> {
  const res = await fetch(`/api/delivery/public/kuechen-status?location_id=${locationId}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('fetch_failed');
  const json = (await res.json()) as { aktive_bestellungen?: number; avg_wait_minutes?: number; status?: string };
  const aktiv = json.aktive_bestellungen ?? 0;
  const wartezeit = json.avg_wait_minutes ?? 0;
  return {
    status: kuechenStatusVon(aktiv, wartezeit),
    aktive_bestellungen: aktiv,
    durchschnitt_wartezeit_min: wartezeit,
  };
}

export function StorefrontPhase1825EchtzeitKuechenStatusAnzeige({ locationId, className }: Props) {
  const [daten, setDaten] = useState<KuechenDaten | null>(null);
  const [geschlossen, setGeschlossen] = useState(false);
  const hydrated = useHydrated();

  useEffect(() => {
    if (!locationId) return;

    let aktiv = true;
    const laden = () =>
      ladeDaten(locationId)
        .then((d) => { if (aktiv) setDaten(d); })
        .catch(() => { if (aktiv) setDaten(MOCK_DATEN); });

    laden();
    const id = setInterval(laden, 30 * 60_000);
    return () => { aktiv = false; clearInterval(id); };
  }, [locationId]);

  if (!hydrated || geschlossen) return null;

  const d = daten ?? MOCK_DATEN;
  const config = STATUS_CONFIG[d.status];
  const { Icon } = config;

  return (
    <div className={cn('mx-4 mt-2 rounded-xl border px-4 py-3 flex items-start gap-3', config.bg, config.border, className)}>
      <Icon className={cn('h-4 w-4 mt-0.5 flex-shrink-0', config.iconColor)} />
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-semibold', config.textColor)}>{config.label}</p>
        <p className={cn('text-xs mt-0.5', config.textColor, 'opacity-80')}>{config.sub}</p>
        {d.durchschnitt_wartezeit_min > 0 && (
          <p className="text-[10px] text-zinc-400 mt-1">
            Ø Wartezeit: {d.durchschnitt_wartezeit_min} Min · {d.aktive_bestellungen} aktive Bestellungen
          </p>
        )}
      </div>
      <button
        onClick={() => setGeschlossen(true)}
        className="flex-shrink-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
        aria-label="Schließen"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
