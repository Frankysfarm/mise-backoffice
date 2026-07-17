'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ApiData {
  fahrer: { schicht_start: string | null; letzte_tour_ende: string | null }[];
  team_avg_dauer_min: number;
}

interface Props {
  locationId: string;
  className?: string;
}

export function StorefrontPhase2079LieferzeitGarantieBanner({ locationId, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [cutoffTime, setCutoffTime] = useState<string | null>(null);
  const [available, setAvailable] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;

    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-schicht-start?location_id=${locationId}`);
        if (!res.ok) throw new Error();
        const json: ApiData = await res.json();
        if (!json.fahrer || json.fahrer.length === 0) return;

        // Finde das späteste letzte Tour-Ende um Schicht-Ende zu schätzen
        const lastEnds = json.fahrer
          .map(f => f.letzte_tour_ende)
          .filter((d): d is string => !!d)
          .map(d => new Date(d).getTime());

        if (lastEnds.length === 0) return;

        // Schicht-Ende = spätestes bekanntes Tour-Ende + 2h Puffer (Fahrer noch verfügbar)
        const latestEnd = Math.max(...lastEnds);
        const estimatedCutoff = new Date(latestEnd + 2 * 3600_000);
        const nowMs = Date.now();

        if (estimatedCutoff.getTime() > nowMs) {
          setCutoffTime(estimatedCutoff.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
          setAvailable(true);
        } else {
          setAvailable(false);
        }
      } catch {
        // Kein Banner bei Fehler
        setAvailable(false);
      }
    };

    void load();
    const id = setInterval(load, 60 * 60_000);
    return () => clearInterval(id);
  }, [mounted, locationId]);

  if (!mounted || !available || !cutoffTime) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-full bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-800',
        className,
      )}
    >
      <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
      <span className="font-medium">Heute Lieferung bis</span>
      <span className="flex items-center gap-1 font-bold">
        <Clock className="h-3.5 w-3.5" />
        {cutoffTime} Uhr möglich
      </span>
    </div>
  );
}
