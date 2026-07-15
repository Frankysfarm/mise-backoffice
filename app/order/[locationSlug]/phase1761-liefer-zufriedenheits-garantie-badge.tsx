'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ShieldCheck, X } from 'lucide-react';

/**
 * Phase 1761 — Liefer-Zufriedenheits-Garantie-Badge (Storefront)
 *
 * "Zufriedenheitsgarantie aktiv" wenn Pünktlichkeit + Feedback beides ≥90%.
 * 60-Min-Polling. Hydration-safe. Schließbar.
 * Kombiniert: /api/delivery/admin/fahrer-puenktlichkeit + /api/delivery/public/liefer-vertrauens-score
 */

interface GarantieData {
  aktiv: boolean;
  puenktlichkeit_pct: number;
  feedback_pct: number;
}

interface Props {
  locationId?: string | null;
  className?: string;
}

const SCHWELLE = 90;

export function StorefrontPhase1761LieferZufriedenheitsGarantieBadge({ locationId, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<GarantieData | null>(null);
  const [closed, setClosed] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const [rPue, rFb] = await Promise.all([
          fetch(`/api/delivery/admin/fahrer-puenktlichkeit?location_id=${locationId}`),
          fetch(`/api/delivery/public/liefer-vertrauens-score?location_id=${locationId}`),
        ]);

        if (cancelled) return;

        let puenktlichkeit = 0;
        let feedback = 0;

        if (rPue.ok) {
          const j = await rPue.json();
          const rangliste: { quote_pct: number }[] = j.rangliste ?? [];
          if (rangliste.length > 0) {
            puenktlichkeit = Math.round(rangliste.reduce((s, f) => s + f.quote_pct, 0) / rangliste.length * 10) / 10;
          }
        }

        if (rFb.ok) {
          const j = await rFb.json();
          feedback = j.positiv_pct ?? 0;
        }

        if (!cancelled) {
          setData({
            aktiv: puenktlichkeit >= SCHWELLE && feedback >= SCHWELLE,
            puenktlichkeit_pct: puenktlichkeit,
            feedback_pct: feedback,
          });
        }
      } catch { /* silent */ }
    };

    load();
    const iv = setInterval(load, 60 * 60 * 1000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (!mounted || closed) return null;
  if (!data) return null;
  if (!data.aktiv) return null;

  return (
    <div className={cn(
      'flex items-center gap-2 rounded-full border px-3 py-1.5',
      'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
      className,
    )}>
      <ShieldCheck className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
      <span className="text-xs font-semibold text-green-700 dark:text-green-300">
        Zufriedenheitsgarantie aktiv
      </span>
      <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">
        {data.puenktlichkeit_pct.toFixed(0)}% pünktlich · {data.feedback_pct.toFixed(0)}% positiv
      </span>
      <button
        onClick={() => setClosed(true)}
        className="ml-auto p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-green-600 dark:text-green-400"
        aria-label="Schließen"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
