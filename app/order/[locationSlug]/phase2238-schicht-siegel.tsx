'use client';

import { useEffect, useState } from 'react';

interface Props {
  locationId: string;
  className?: string;
}

export function StorefrontPhase2238SchichtSiegel({ locationId, className = '' }: Props) {
  const [mounted, setMounted] = useState(false);
  const [gesamtStopps, setGesamtStopps] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
    let active = true;

    async function load() {
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-schicht-bilanz?location_id=${locationId}`);
        if (res.ok) {
          const json = await res.json();
          if (active) setGesamtStopps(json.gesamt_stopps ?? null);
        }
      } catch {
        // ignore
      }
    }

    load();
    const id = setInterval(load, 2 * 60 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [locationId]);

  if (!mounted || gesamtStopps === null || gesamtStopps < 50) return null;

  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-700 px-3 py-1 text-xs font-medium text-indigo-800 dark:text-indigo-300 ${className}`}>
      <span>📦</span>
      <span>Heute bereits {gesamtStopps} Lieferungen abgeschlossen</span>
    </div>
  );
}
