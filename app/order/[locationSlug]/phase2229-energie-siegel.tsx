'use client';

import { useEffect, useState } from 'react';

interface Props {
  locationId: string;
  className?: string;
}

export function StorefrontPhase2229EnergieSiegel({ locationId, className = '' }: Props) {
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    async function laden() {
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-energie?location_id=${locationId}`);
        if (!res.ok) return;
        const d = await res.json();
        setShow(d?.team_energie_level === 'hoch');
      } catch {
        // noop
      }
    }

    laden();
    const id = setInterval(laden, 4 * 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [mounted, locationId]);

  if (!mounted || !show) return null;

  return (
    <div
      className={`flex items-center gap-2 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-1.5 text-sm font-semibold shadow-sm ${className}`}
    >
      <span>⚡</span>
      <span>Unser Team läuft auf Hochtouren</span>
    </div>
  );
}
