'use client';

import { useEffect, useState } from 'react';
import { Clock, Zap, TrendingUp, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1127 — Bestellzeit-Optimierer (Storefront)
// "Jetzt bestellen für schnellste Lieferung" wenn Zone gut besetzt + Peak-Warnung bei hoher Auslastung

interface Props {
  locationId: string;
  zone?: string | null;
  cartEmpty: boolean;
}

type ZoneSignal = {
  status: 'optimal' | 'gut' | 'peak' | 'knapp';
  eta_min: number;
  aktive_fahrer: number;
  message: string;
  cta: string;
};

const POLL_MS = 3 * 60_000;

function getStatusStyle(s: ZoneSignal['status']) {
  switch (s) {
    case 'optimal': return 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950/40';
    case 'gut':     return 'border-sky-300 bg-sky-50 dark:border-sky-700 dark:bg-sky-950/40';
    case 'peak':    return 'border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-950/40';
    case 'knapp':   return 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/40';
  }
}

function getIconStyle(s: ZoneSignal['status']) {
  switch (s) {
    case 'optimal': return 'text-green-500';
    case 'gut':     return 'text-sky-500';
    case 'peak':    return 'text-orange-500';
    case 'knapp':   return 'text-red-500';
  }
}

function getTextStyle(s: ZoneSignal['status']) {
  switch (s) {
    case 'optimal': return 'text-green-700 dark:text-green-300';
    case 'gut':     return 'text-sky-700 dark:text-sky-300';
    case 'peak':    return 'text-orange-700 dark:text-orange-300';
    case 'knapp':   return 'text-red-700 dark:text-red-300';
  }
}

async function fetchSignal(locationId: string, zone?: string | null): Promise<ZoneSignal | null> {
  try {
    const url = `/api/delivery/admin/fahrer-netz-heatmap?location_id=${locationId}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const data = await r.json() as { zonen: { zone: string; aktiv: number; on_tour: number; level: string }[]; gesamt_aktiv: number };

    const target = zone
      ? data.zonen.find(z => z.zone === zone)
      : data.zonen.reduce((best, z) => (z.aktiv > (best?.aktiv ?? -1) ? z : best), data.zonen[0]);

    if (!target) return null;

    const { level, aktiv, on_tour } = target;

    if (level === 'leer' || aktiv === 0) {
      return { status: 'knapp', eta_min: 50, aktive_fahrer: 0, message: 'Aktuell wenig Fahrer verfügbar.', cta: 'Trotzdem bestellen' };
    }
    if (level === 'voll' || level === 'hoch') {
      const eta = 20 + (on_tour * 3);
      return { status: 'peak', eta_min: eta, aktive_fahrer: aktiv, message: `Hochbetrieb — ca. ${eta} Min Lieferzeit.`, cta: 'Jetzt trotzdem bestellen' };
    }
    if (aktiv >= 2) {
      return { status: 'optimal', eta_min: 20, aktive_fahrer: aktiv, message: `${aktiv} Fahrer bereit — Blitzlieferung möglich!`, cta: 'Jetzt bestellen' };
    }
    return { status: 'gut', eta_min: 28, aktive_fahrer: aktiv, message: `${aktiv} Fahrer in der Nähe — guter Zeitpunkt.`, cta: 'Jetzt bestellen' };
  } catch {
    return null;
  }
}

export function Phase1127BestellzeitOptimierer({ locationId, zone, cartEmpty }: Props) {
  const [signal, setSignal] = useState<ZoneSignal | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    void fetchSignal(locationId, zone).then(s => setSignal(s));
    const id = setInterval(() => void fetchSignal(locationId, zone).then(s => setSignal(s)), POLL_MS);
    return () => clearInterval(id);
  }, [locationId, zone]);

  if (!signal || dismissed || !cartEmpty) return null;
  if (signal.status === 'knapp') return null;

  const isOptimal = signal.status === 'optimal' || signal.status === 'gut';

  return (
    <div className={cn(
      'relative rounded-xl border shadow-sm px-4 py-3 flex items-start gap-3',
      getStatusStyle(signal.status),
    )}>
      <div className={cn('shrink-0 mt-0.5', getIconStyle(signal.status))}>
        {isOptimal ? <Zap className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-bold', getTextStyle(signal.status))}>
          {signal.cta}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <Clock className={cn('h-3 w-3 shrink-0', getIconStyle(signal.status))} />
          <p className={cn('text-xs', getTextStyle(signal.status))}>
            {signal.message}
          </p>
        </div>
        <p className={cn('text-[10px] mt-1 font-bold', getTextStyle(signal.status))}>
          Geschätzte Lieferzeit: ~{signal.eta_min} Min
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className={cn('shrink-0 p-1 rounded hover:bg-black/10 transition', getIconStyle(signal.status))}
        aria-label="Schließen"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
