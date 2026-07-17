'use client';

import { useEffect, useState } from 'react';

interface Props {
  locationId: string;
  className?: string;
}

export function StorefrontPhase2214RekordSiegel({ locationId, className = '' }: Props) {
  const [mounted, setMounted] = useState(false);
  const [rekordMin, setRekordMin] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    async function laden() {
      try {
        const res = await fetch(`/api/delivery/admin/schicht-bestzeiten?location_id=${locationId}`);
        if (!res.ok) return;
        const d = await res.json();
        const min: number | null = d?.schnellste_lieferung_min ?? null;
        setRekordMin(typeof min === 'number' && min <= 15 ? min : null);
      } catch {
        // noop
      }
    }

    laden();
    const id = setInterval(laden, 4 * 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [mounted, locationId]);

  if (!mounted || rekordMin === null) return null;

  return (
    <div
      className={`flex items-center gap-2 rounded-full bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-4 py-1.5 text-sm font-semibold shadow-sm ${className}`}
    >
      <span>⚡</span>
      <span>Heutiger Lieferrekord: {rekordMin} Min.</span>
    </div>
  );
}
