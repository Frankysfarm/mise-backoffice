'use client';

import { useEffect, useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  locationId: string;
  className?: string;
}

const POLL_MS = 5 * 60 * 1000;

export function StorefrontPhase2023LieferkapazitaetsIndikator({ locationId, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [closed, setClosed] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-auslastungs-matrix?location_id=${locationId}`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        const last = json.stunden?.[json.stunden.length - 1];
        const total = (last?.aktiv ?? 0) + (last?.pause ?? 0) + (last?.verfuegbar ?? 0);
        const auslastung = total > 0 ? ((last?.aktiv ?? 0) / total) * 100 : 0;
        if (!cancelled) setShow(auslastung > 80);
      } catch {
        if (!cancelled) setShow(false);
      }
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [locationId]);

  if (!mounted || closed || !show) return null;

  return (
    <div className={cn(
      'relative flex items-center gap-2 rounded-full border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 px-3 py-1.5',
      className,
    )}>
      <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
      <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
        Hohe Nachfrage — kurze Wartezeiten möglich
      </span>
      <button
        onClick={() => setClosed(true)}
        className="ml-1 p-0.5 rounded-full hover:bg-amber-200/60 dark:hover:bg-amber-700/40 transition-colors"
        aria-label="Schließen"
      >
        <X className="h-3 w-3 text-amber-600 dark:text-amber-400" />
      </button>
    </div>
  );
}
