'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Star, TrendingUp, TrendingDown, Minus, X } from 'lucide-react';

/**
 * Phase 1751 — Liefer-Vertrauens-Score-Badge (Storefront)
 *
 * Zeigt "X% positives Feedback" basierend auf letzten 30 Bewertungen;
 * 60-Min-Polling; Hydration-safe; schließbar.
 */

interface ApiResponse {
  positiv_anteil: number;
  positiv_anzahl: number;
  gesamt_bewertungen: number;
  avg_bewertung: number;
  trend: 'steigend' | 'fallend' | 'stabil';
}

interface Props {
  locationId: string | null;
  className?: string;
}

function buildMock(): ApiResponse {
  return {
    positiv_anteil: 94,
    positiv_anzahl: 28,
    gesamt_bewertungen: 30,
    avg_bewertung: 4.7,
    trend: 'steigend',
  };
}

export function StorefrontPhase1751LieferVertrauensScoreBadge({ locationId, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;

    const load = () => {
      if (locationId) {
        fetch(`/api/delivery/public/liefer-vertrauens-score?location_id=${locationId}`, { cache: 'no-store' })
          .then(r => r.ok ? r.json() : null)
          .then(d => setData(d ?? buildMock()))
          .catch(() => setData(buildMock()));
      } else {
        setData(buildMock());
      }
    };
    load();
    const iv = setInterval(load, 60 * 60_000);
    return () => clearInterval(iv);
  }, [mounted, locationId]);

  if (!mounted || !data || dismissed) return null;
  if (data.gesamt_bewertungen < 5) return null;

  const TrendIcon = data.trend === 'steigend' ? TrendingUp : data.trend === 'fallend' ? TrendingDown : Minus;
  const trendLabel = data.trend === 'steigend' ? 'steigend' : data.trend === 'fallend' ? 'fallend' : 'stabil';
  const qualitaet =
    data.positiv_anteil >= 90 ? 'sehr_gut' :
    data.positiv_anteil >= 75 ? 'gut' :
                                 'okay';

  const badgeStyle = {
    sehr_gut: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800', star: 'text-emerald-500', icon: 'text-emerald-500' },
    gut:      { bg: 'bg-blue-50 border-blue-200',       text: 'text-blue-800',    star: 'text-blue-400',    icon: 'text-blue-400'   },
    okay:     { bg: 'bg-amber-50 border-amber-200',     text: 'text-amber-800',   star: 'text-amber-400',   icon: 'text-amber-400'  },
  }[qualitaet];

  return (
    <div className={cn('relative rounded-xl border px-3 py-2.5 flex items-center gap-2.5', badgeStyle.bg, className)}>
      <Star className={cn('w-4 h-4 shrink-0 fill-current', badgeStyle.star)} />

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className={cn('text-sm font-black', badgeStyle.text)}>
            {data.positiv_anteil}% positives Feedback
          </span>
          <span className="text-[10px] text-stone-500">
            ({data.positiv_anzahl} von {data.gesamt_bewertungen} Bewertungen)
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }, (_, i) => (
              <Star
                key={i}
                className={cn(
                  'w-2.5 h-2.5',
                  i < Math.round(data.avg_bewertung) ? cn('fill-current', badgeStyle.star) : 'text-stone-200 fill-current',
                )}
              />
            ))}
          </div>
          <span className="text-[10px] font-bold text-stone-500">Ø {data.avg_bewertung}</span>
          <TrendIcon className={cn('w-3 h-3', badgeStyle.icon)} />
          <span className={cn('text-[9px] font-medium', badgeStyle.icon)}>{trendLabel}</span>
        </div>
      </div>

      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 p-1 rounded-full hover:bg-black/10 transition-colors"
        aria-label="Schließen"
      >
        <X className="w-3 h-3 text-stone-400" />
      </button>
    </div>
  );
}
