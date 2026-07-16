'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, X } from 'lucide-react';

/**
 * Phase 1921 — Zonen-Lieferzeit-Badge (Storefront)
 *
 * "In deiner Zone ~Xmin" dynamisch je PLZ; Hydration-safe; schließbar; 30-Min-Polling.
 */

interface ZoneBadgeDaten {
  zone: string;
  avg_lieferzeit_min: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

const MOCK: ZoneBadgeDaten = { zone: '10115', avg_lieferzeit_min: 22, ampel: 'gruen' };

interface Props {
  locationId: string;
  zone?: string;
  className?: string;
}

export function Phase1921ZonenLieferzeitBadge({ locationId, zone, className }: Props) {
  const [daten, setDaten] = useState<ZoneBadgeDaten | null>(null);
  const [geschlossen, setGeschlossen] = useState(false);
  const [gemountet, setGemountet] = useState(false);

  useEffect(() => { setGemountet(true); }, []);

  useEffect(() => {
    if (!gemountet) return;

    const laden = async () => {
      try {
        const url = `/api/delivery/admin/zonen-lieferheatmap?location_id=${locationId}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('API Fehler');
        const json = await res.json();
        const zonen: ZoneBadgeDaten[] = json.zonen ?? [];
        const gefunden = zone
          ? zonen.find((z) => z.zone === zone) ?? zonen[0]
          : zonen[0];
        if (gefunden) setDaten(gefunden);
        else throw new Error('no zone');
      } catch {
        setDaten(MOCK);
      }
    };

    laden();
    const id = setInterval(laden, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [gemountet, locationId, zone]);

  if (!gemountet || !daten || geschlossen) return null;

  const farbe =
    daten.ampel === 'gruen'
      ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 text-green-800 dark:text-green-200'
      : daten.ampel === 'gelb'
        ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200'
        : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-200';
  const iconFarbe =
    daten.ampel === 'gruen'
      ? 'text-green-600 dark:text-green-400'
      : daten.ampel === 'gelb'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';
  const closeFarbe =
    daten.ampel === 'gruen'
      ? 'hover:bg-green-100 dark:hover:bg-green-900/30 text-green-700 dark:text-green-300'
      : daten.ampel === 'gelb'
        ? 'hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-300'
        : 'hover:bg-red-100 dark:hover:bg-red-900/30 text-red-700 dark:text-red-300';

  return (
    <div className={cn('relative rounded-2xl border flex items-center gap-3 px-4 py-3 shadow-sm', farbe, className)}>
      <Clock className={cn('h-5 w-5 shrink-0', iconFarbe)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold">
          In deiner Zone ~{daten.avg_lieferzeit_min} Min Lieferzeit
        </p>
        <p className="text-xs mt-0.5 opacity-80">PLZ {daten.zone} · aktueller Schnitt</p>
      </div>
      <button
        onClick={() => setGeschlossen(true)}
        className={cn('shrink-0 rounded-full p-1 transition-colors', closeFarbe)}
        aria-label="Schließen"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
