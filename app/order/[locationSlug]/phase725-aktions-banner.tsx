'use client';

import { useCallback, useEffect, useState } from 'react';
import { Tag, X } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface Aktion {
  id: string;
  titel: string;
  beschreibung: string;
  gueltig_bis: string;
  farbe: 'indigo' | 'emerald' | 'amber' | 'red';
}

const MOCK: Aktion = {
  id: 'mock',
  titel: 'Heute: Gratis-Lieferung!',
  beschreibung: 'Bis 20:00 Uhr — kein Mindestbestellwert.',
  gueltig_bis: new Date(Date.now() + 4 * 3600_000).toISOString(),
  farbe: 'emerald',
};

function farbenKlassen(f: Aktion['farbe']) {
  switch (f) {
    case 'emerald': return 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300';
    case 'amber': return 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300';
    case 'red': return 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300';
    default: return 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300';
  }
}

function formatVerbl(isoStr: string): string {
  const diff = new Date(isoStr).getTime() - Date.now();
  if (diff <= 0) return 'Abgelaufen';
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `${min} Min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function Phase725AktionsBanner({ locationId }: Props) {
  const [aktion, setAktion] = useState<Aktion | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [verbl, setVerbl] = useState('');

  const laden = useCallback(async () => {
    if (!locationId) {
      setAktion(MOCK);
      return;
    }
    try {
      const res = await fetch(
        `/api/delivery/admin/scheduled?location_id=${locationId}&type=aktion`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        const aktionen = (json.items ?? json.aktionen ?? []) as Aktion[];
        const jetzt = Date.now();
        const aktiv = aktionen.find(
          (a) => a.gueltig_bis && new Date(a.gueltig_bis).getTime() > jetzt,
        );
        if (aktiv) {
          setAktion(aktiv);
          return;
        }
      }
    } catch {
      // fallback — no mock for real locations
    }
    if (!locationId) setAktion(MOCK);
  }, [locationId]);

  useEffect(() => {
    laden();
    const id = setInterval(laden, 5 * 60_000);
    return () => clearInterval(id);
  }, [laden]);

  useEffect(() => {
    if (!aktion) return;
    setVerbl(formatVerbl(aktion.gueltig_bis));
    const id = setInterval(() => setVerbl(formatVerbl(aktion.gueltig_bis)), 60_000);
    return () => clearInterval(id);
  }, [aktion]);

  if (!aktion || dismissed || verbl === 'Abgelaufen') return null;

  return (
    <div className={`rounded-xl border p-3 ${farbenKlassen(aktion.farbe)}`}>
      <div className="flex items-start gap-2">
        <Tag className="h-4 w-4 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold">{aktion.titel}</p>
          <p className="text-[10px] mt-0.5 opacity-80">{aktion.beschreibung}</p>
          <p className="text-[9px] mt-1 opacity-60">Noch {verbl}</p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 opacity-60 hover:opacity-100"
          aria-label="Schließen"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
