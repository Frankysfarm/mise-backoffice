'use client';

import { useState, useEffect } from 'react';
import { ShoppingBag, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KalenderData {
  zellen: { tag: number; stunde: number; anzahl: number }[];
}

export default function Phase1946BestellzahlHeuteBadge({
  locationId,
  className,
}: {
  locationId: string;
  className?: string;
}) {
  const [anzahl, setAnzahl] = useState<number | null>(null);
  const [geschlossen, setGeschlossen] = useState(false);
  const [gemountet, setGemountet] = useState(false);

  useEffect(() => {
    setGemountet(true);
  }, []);

  const laden = async () => {
    try {
      const res = await fetch(`/api/delivery/admin/tourauslastungs-kalender?location_id=${locationId}`);
      if (!res.ok) return;
      const json: KalenderData = await res.json();
      const heute = 6;
      const summe = json.zellen
        .filter((z) => z.tag === heute)
        .reduce((s, z) => s + z.anzahl, 0);
      setAnzahl(summe);
    } catch {}
  };

  useEffect(() => {
    if (!gemountet) return;
    laden();
    const id = setInterval(laden, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [gemountet, locationId]);

  if (!gemountet || geschlossen || anzahl === null) return null;

  return (
    <div
      className={cn(
        'relative flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl px-4 py-3',
        className,
      )}
    >
      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-800 shrink-0">
        <ShoppingBag className="w-5 h-5 text-blue-600 dark:text-blue-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 leading-tight">
          Heute bereits {anzahl} Bestellungen verarbeitet
        </p>
        <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5">
          Frische Küche · Schnelle Lieferung
        </p>
      </div>
      <button
        onClick={() => setGeschlossen(true)}
        className="shrink-0 text-blue-400 hover:text-blue-600 dark:hover:text-blue-300"
        aria-label="Schließen"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
