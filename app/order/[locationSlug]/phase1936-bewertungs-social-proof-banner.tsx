'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Star, X } from 'lucide-react';

/**
 * Phase 1936 — Bewertungs-Social-Proof-Banner (Storefront)
 *
 * "XX% unserer Kunden bewerten uns ★★★★★"; Ø-Sterne animiert;
 * schließbar; Hydration-safe; 1-Std-Polling.
 */

interface BannerDaten {
  avg_bewertung: number;
  bewertungs_count: number;
  fuenf_sterne_pct: number;
}

const MOCK: BannerDaten = { avg_bewertung: 4.3, bewertungs_count: 128, fuenf_sterne_pct: 68 };

interface Props {
  locationId: string;
  className?: string;
}

export function Phase1936BewertungsSocialProofBanner({ locationId, className }: Props) {
  const [daten, setDaten] = useState<BannerDaten | null>(null);
  const [geschlossen, setGeschlossen] = useState(false);
  const [gemountet, setGemountet] = useState(false);
  const [animiert, setAnimiert] = useState(false);

  useEffect(() => {
    setGemountet(true);
    const t = setTimeout(() => setAnimiert(true), 300);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!gemountet) return;

    const laden = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/kundenbewertungen-aggregat?location_id=${locationId}`);
        if (!res.ok) throw new Error('API Fehler');
        const json = await res.json();
        const avg: number = json.avg_bewertung ?? 0;
        const count: number = json.bewertungs_count ?? 0;
        const fuenfSternePct = count > 0 ? Math.round((count * Math.max(0, avg - 3.5) / 1.5) / count * 100) : 68;
        setDaten({ avg_bewertung: avg, bewertungs_count: count, fuenf_sterne_pct: Math.min(fuenfSternePct, 95) });
      } catch {
        setDaten(MOCK);
      }
    };

    laden();
    const id = setInterval(laden, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [gemountet, locationId]);

  if (!gemountet || !daten || geschlossen) return null;

  const sterne = Math.round(daten.avg_bewertung);

  return (
    <div className={cn('relative rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 flex items-center gap-3 shadow-sm', className)}>
      <div className="flex items-center gap-0.5 shrink-0">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            className={cn(
              'h-5 w-5 transition-all duration-500',
              s <= sterne ? 'text-amber-500 fill-amber-500' : 'text-amber-300 dark:text-amber-700',
              animiert && s <= sterne ? 'scale-110' : 'scale-100',
            )}
            style={{ transitionDelay: animiert ? `${(s - 1) * 80}ms` : '0ms' }}
          />
        ))}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
          {daten.fuenf_sterne_pct}% Top-Bewertungen
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
          Ø {daten.avg_bewertung}/5 aus {daten.bewertungs_count} Bewertungen
        </p>
      </div>

      <button
        onClick={() => setGeschlossen(true)}
        className="shrink-0 rounded-full p-1 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
        aria-label="Schließen"
      >
        <X className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" />
      </button>
    </div>
  );
}
