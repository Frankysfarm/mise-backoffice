'use client';

import React, { useEffect, useState } from 'react';

interface AktionInfo {
  aktiv: boolean;
  titel: string;
  beschreibung: string;
  rabatt_pct: number | null;
  gueltig_bis: string | null;
}

interface Props {
  locationId: string;
}

export function StorefrontPhase1571AktionsBadge({ locationId }: Props) {
  const [aktion, setAktion] = useState<AktionInfo | null>(null);
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setMounted(true);
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/public/aktuelle-aktion?location_id=${locationId}`);
        if (res.ok) {
          const json: AktionInfo = await res.json();
          if (json.aktiv) setAktion(json);
        } else {
          setAktion({
            aktiv: true,
            titel: 'Heutiger Deal',
            beschreibung: 'Kostenlose Lieferung ab 15 €',
            rabatt_pct: null,
            gueltig_bis: null,
          });
        }
      } catch {
        /* silent fallback — no badge if API unavailable */
      }
    };
    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!mounted || !aktion || dismissed) return null;

  const hasRabatt = aktion.rabatt_pct !== null && aktion.rabatt_pct > 0;

  return (
    <div className="flex items-center gap-2 rounded-full bg-amber-100 border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-800 w-fit">
      <span className="text-base">🎉</span>
      <span className="font-semibold">{aktion.titel}</span>
      {hasRabatt && (
        <span className="rounded-full bg-amber-500 text-white px-1.5 py-0.5 text-[10px] font-bold">
          -{aktion.rabatt_pct}%
        </span>
      )}
      <span className="text-stone-600">{aktion.beschreibung}</span>
      {aktion.gueltig_bis && (
        <span className="text-stone-400 text-[10px]">
          bis {new Date(aktion.gueltig_bis).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
      <button
        onClick={() => setDismissed(true)}
        className="ml-1 text-stone-400 hover:text-stone-600 leading-none"
        aria-label="Schließen"
      >
        ×
      </button>
    </div>
  );
}
