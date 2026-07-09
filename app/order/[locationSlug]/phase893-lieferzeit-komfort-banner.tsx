'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, TrendingDown, TrendingUp, X } from 'lucide-react';

/**
 * phase893 — Lieferzeit-Komfort-Banner
 *
 * Zeigt ob die aktuelle ETA schneller oder langsamer als der 7-Tage-Ø ist.
 * Nur sichtbar wenn |delta| ≥10%. Dismissbar via sessionStorage (30 Min).
 * 3-Min-Polling gegen /api/delivery/eta?mode=komfort, Fallback Mock.
 */

interface Props {
  locationId: string;
  currentEtaMin?: number | null;
}

interface EtaKomfort {
  avg_7d_min: number;
  aktuell_min: number;
  delta_pct: number;
  richtung: 'schneller' | 'langsamer' | 'normal';
}

const GUARD_KEY = 'mise_lieferzeit_komfort_dismissed_v2';
const THRESHOLD_PCT = 10;

function isDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const ts = sessionStorage.getItem(GUARD_KEY);
    if (!ts) return false;
    return Date.now() - parseInt(ts) < 30 * 60_000;
  } catch { return false; }
}
function markDismissed() {
  if (typeof window === 'undefined') return;
  try { sessionStorage.setItem(GUARD_KEY, String(Date.now())); } catch { /* noop */ }
}

export function Phase893LieferzeitKomfortBanner({ locationId, currentEtaMin }: Props) {
  const [data, setData] = useState<EtaKomfort | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const fetchData = () => {
    if (isDismissed()) { setDismissed(true); return; }
    fetch(`/api/delivery/eta?location_id=${locationId}&mode=komfort`)
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
      .then(d => {
        const avg   = d?.avg_7d_min ?? 32;
        const aktuell = currentEtaMin ?? d?.aktuell_min ?? avg;
        const delta_pct = avg > 0 ? Math.round(((avg - aktuell) / avg) * 100) : 0;
        setData({
          avg_7d_min: avg,
          aktuell_min: aktuell,
          delta_pct,
          richtung:
            delta_pct >=  THRESHOLD_PCT ? 'schneller' :
            delta_pct <= -THRESHOLD_PCT ? 'langsamer'  : 'normal',
        });
      });
  };

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 3 * 60_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, currentEtaMin]);

  const dismiss = () => { markDismissed(); setDismissed(true); };

  if (dismissed || !data || data.richtung === 'normal') return null;

  const isSchneller = data.richtung === 'schneller';
  const absPct = Math.abs(data.delta_pct);

  return (
    <div className={cn(
      'relative flex items-center gap-3 rounded-xl border px-4 py-3',
      'animate-in slide-in-from-top-2 duration-500',
      isSchneller
        ? 'border-matcha-300 bg-matcha-50 dark:bg-matcha-950/30'
        : 'border-amber-300 bg-amber-50 dark:bg-amber-950/30',
    )}>
      <div className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
        isSchneller ? 'bg-matcha-100' : 'bg-amber-100',
      )}>
        {isSchneller
          ? <TrendingDown className="h-5 w-5 text-matcha-600" />
          : <TrendingUp   className="h-5 w-5 text-amber-600"  />
        }
      </div>

      <div className="flex-1 min-w-0">
        <div className={cn(
          'text-sm font-bold',
          isSchneller ? 'text-matcha-800 dark:text-matcha-200' : 'text-amber-800 dark:text-amber-200',
        )}>
          {isSchneller
            ? `Heute ${absPct}% schneller als sonst`
            : `Heute ${absPct}% länger als normal`
          }
        </div>
        <div className={cn(
          'text-[11px] mt-0.5 flex items-center gap-1',
          isSchneller ? 'text-matcha-600 dark:text-matcha-400' : 'text-amber-600 dark:text-amber-400',
        )}>
          <Clock className="h-3 w-3 inline shrink-0" />
          {`Aktuell ${data.aktuell_min} Min · Normal ${data.avg_7d_min} Min`}
        </div>
      </div>

      <div className={cn(
        'shrink-0 rounded-full px-2.5 py-1 text-xs font-black',
        isSchneller ? 'bg-matcha-500 text-white' : 'bg-amber-400 text-white',
      )}>
        {isSchneller ? `-${absPct}%` : `+${absPct}%`}
      </div>

      <button
        onClick={dismiss}
        className="absolute top-2 right-2 rounded-full p-1 text-muted-foreground hover:bg-black/10 transition"
        aria-label="Schließen"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
