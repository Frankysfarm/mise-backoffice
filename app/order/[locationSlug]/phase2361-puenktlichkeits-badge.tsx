'use client';
import { useEffect, useState } from 'react';

interface ApiData {
  team_durchschnitt: number;
}

interface Props {
  locationId: string;
  className?: string;
}

export function StorefrontPhase2361PuenktlichkeitsBadge({ locationId, className }: Props) {
  const [quote, setQuote] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    async function load() {
      try {
        const r = await fetch(`/api/delivery/admin/fahrer-puenktlichkeit?location_id=${locationId}`);
        if (!r.ok) return;
        const d: ApiData = await r.json();
        if (d.team_durchschnitt >= 90) setQuote(d.team_durchschnitt);
      } catch {}
    }
    load();
    const t = setInterval(load, 4 * 60 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!mounted || quote === null) return null;

  return (
    <div
      className={`inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-full px-3 py-1 text-xs text-blue-800 font-medium ${className ?? ''}`}
    >
      <span>🕐 {quote.toFixed(0)}% pünktliche Lieferungen</span>
    </div>
  );
}
