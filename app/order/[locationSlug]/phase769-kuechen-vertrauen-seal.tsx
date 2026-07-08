'use client';

import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';

interface SealDaten {
  avg_rating: number;
  anzahl: number;
}

export function Phase769KuechenVertrauenSeal({ locationId }: { locationId: string }) {
  const [daten, setDaten] = useState<SealDaten | null>(null);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `/api/delivery/admin/kunden-feedback-engine?location_id=${locationId}&action=summary`
        );
        if (!res.ok) return;
        const json = await res.json();
        if (json.avg_rating != null && json.anzahl > 0) {
          setDaten({ avg_rating: json.avg_rating, anzahl: json.anzahl });
          setPulse(true);
          setTimeout(() => setPulse(false), 800);
        }
      } catch {}
    }
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!daten) return null;

  const color =
    daten.avg_rating >= 4.5
      ? 'from-emerald-500 to-green-400'
      : daten.avg_rating >= 3.5
      ? 'from-amber-500 to-yellow-400'
      : 'from-red-500 to-orange-400';

  return (
    <div
      className={`flex items-center gap-2 rounded-full px-4 py-2 bg-gradient-to-r ${color} shadow-md transition-transform duration-300 ${pulse ? 'scale-105' : 'scale-100'} w-fit`}
    >
      <Star className="h-4 w-4 text-white fill-white" />
      <span className="text-sm font-bold text-white">{daten.avg_rating.toFixed(1)}</span>
      <span className="text-xs text-white/80">
        ({daten.anzahl} Bewertungen)
      </span>
    </div>
  );
}
