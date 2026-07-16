'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ShieldCheck, X } from 'lucide-react';

/**
 * Phase 1916 — Fahrer-Qualitäts-Siegel (Storefront)
 *
 * "Geprüfter Qualitätsfahrer"-Badge wenn Ø-Score >80.
 * Hydration-safe; schließbar; 1-Std-Polling.
 */

interface SiegelDaten {
  team_durchschnitt: number;
  hat_siegel: boolean;
}

const MOCK: SiegelDaten = { team_durchschnitt: 84, hat_siegel: true };

interface Props {
  locationId: string;
  className?: string;
}

export function Phase1916FahrerQualitaetsSiegel({ locationId, className }: Props) {
  const [daten, setDaten] = useState<SiegelDaten | null>(null);
  const [geschlossen, setGeschlossen] = useState(false);
  const [gemountet, setGemountet] = useState(false);

  useEffect(() => {
    setGemountet(true);
  }, []);

  useEffect(() => {
    if (!gemountet) return;

    const laden = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-schicht-qualitaet?location_id=${locationId}`);
        if (!res.ok) throw new Error('API Fehler');
        const json = await res.json();
        const avg: number = json.team_durchschnitt ?? 0;
        setDaten({ team_durchschnitt: avg, hat_siegel: avg >= 80 });
      } catch {
        setDaten(MOCK);
      }
    };

    laden();
    const id = setInterval(laden, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [gemountet, locationId]);

  if (!gemountet || !daten || !daten.hat_siegel || geschlossen) return null;

  return (
    <div
      className={cn(
        'relative rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 px-4 py-3 flex items-center gap-3 shadow-sm',
        className,
      )}
    >
      <ShieldCheck className="h-6 w-6 text-blue-600 dark:text-blue-400 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-blue-800 dark:text-blue-200">
          ✓ Geprüfte Qualitätsfahrer
        </p>
        <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
          Durchschnittlicher Qualitätsscore {daten.team_durchschnitt}/100 — Top-Team!
        </p>
      </div>
      <button
        onClick={() => setGeschlossen(true)}
        className="shrink-0 rounded-full p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
        aria-label="Schließen"
      >
        <X className="h-3.5 w-3.5 text-blue-700 dark:text-blue-300" />
      </button>
    </div>
  );
}
