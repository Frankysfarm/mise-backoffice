'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

interface TransparenzDaten {
  aktive_bestellungen: number;
  storno_quote: number;
  gesamtQuote: number;
}

export function Phase774BestellTransparenzSiegel({ locationId }: { locationId: string }) {
  const [daten, setDaten] = useState<TransparenzDaten | null>(null);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [quotRes, aktRes] = await Promise.all([
          fetch(`/api/delivery/admin/storno-quote-verlauf?location_id=${locationId}&tage=7`),
          fetch(`/api/delivery/admin/kuechen-kapazitaets-warnsignal?location_id=${locationId}`),
        ]);
        const quot = quotRes.ok ? await quotRes.json() : null;
        const akt = aktRes.ok ? await aktRes.json() : null;

        if (quot) {
          setDaten({
            aktive_bestellungen: akt?.aktive_bestellungen ?? 0,
            storno_quote: quot.gesamtQuote ?? 0,
            gesamtQuote: quot.gesamtQuote ?? 0,
          });
          setPulse(true);
          setTimeout(() => setPulse(false), 600);
        }
      } catch {}
    }
    load();
    const id = setInterval(load, 3 * 60_000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!daten) return null;

  // Only show seal when storno quote is low (good track record)
  if (daten.gesamtQuote > 15) return null;

  const qualityLabel =
    daten.gesamtQuote <= 3
      ? { text: 'Sehr zuverlässig', color: 'from-emerald-600 to-green-500' }
      : daten.gesamtQuote <= 8
      ? { text: 'Zuverlässig', color: 'from-blue-600 to-cyan-500' }
      : { text: 'Gut', color: 'from-slate-600 to-slate-500' };

  return (
    <div
      className={`flex items-center gap-2 rounded-full px-4 py-2 bg-gradient-to-r ${qualityLabel.color} shadow-md w-fit transition-transform duration-300 ${pulse ? 'scale-105' : 'scale-100'}`}
    >
      <ShieldCheck className="h-4 w-4 text-white shrink-0" />
      <div className="flex flex-col leading-tight">
        <span className="text-xs font-bold text-white">{qualityLabel.text}</span>
        <span className="text-xs text-white/75">
          {daten.gesamtQuote.toFixed(1)}% Storno-Rate
        </span>
      </div>
    </div>
  );
}
