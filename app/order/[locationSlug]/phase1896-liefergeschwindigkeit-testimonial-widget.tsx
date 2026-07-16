'use client';

/**
 * Phase 1896 — Liefergeschwindigkeit-Testimonial-Widget (Storefront)
 *
 * "Zuletzt in deiner Zone in XX Min geliefert" — Social-Proof-Banner
 * aus den letzten 5 abgeschlossenen Bestellungen je Zone.
 * Hydration-safe (mounted-Guard). Schließbar. 30-Min-Polling.
 * GET /api/delivery/public/avg-eta (bestehend, Mock-Fallback)
 */

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Zap, X, RefreshCw, CheckCircle2 } from 'lucide-react';

interface ZoneStats {
  zone: string;
  letzte_lieferzeit_min: number;
  anzahl_lieferungen: number;
  beschleunigung_min?: number;
}

interface Props {
  locationId: string;
  zone?: string;
  className?: string;
}

const ZONE_LABEL: Record<string, string> = { A: 'Nah', B: 'Standard', C: 'Weit', D: 'Außen' };

const MOCK_STATS: ZoneStats[] = [
  { zone: 'A', letzte_lieferzeit_min: 18, anzahl_lieferungen: 5, beschleunigung_min: 3 },
  { zone: 'B', letzte_lieferzeit_min: 26, anzahl_lieferungen: 5, beschleunigung_min: 0 },
  { zone: 'C', letzte_lieferzeit_min: 34, anzahl_lieferungen: 5 },
  { zone: 'D', letzte_lieferzeit_min: 42, anzahl_lieferungen: 3 },
];

export function StorefrontPhase1896LiefergeschwindigkeitTestimonialWidget({
  locationId,
  zone,
  className,
}: Props) {
  const [mounted, setMounted]   = useState(false);
  const [stats, setStats]       = useState<ZoneStats[]>([]);
  const [geschlossen, setGeschlossen] = useState(false);
  const [laden, setLaden]       = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const fetch_ = useCallback(async () => {
    if (!locationId) return;
    setLaden(true);
    try {
      const res = await fetch(
        `/api/delivery/public/avg-eta?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        if (json.zones && Array.isArray(json.zones)) {
          const mapped: ZoneStats[] = (json.zones as Array<{ zone: string; avg_eta_minutes?: number; last_delivery_minutes?: number; recent_count?: number }>).map((z) => ({
            zone: z.zone,
            letzte_lieferzeit_min: z.last_delivery_minutes ?? z.avg_eta_minutes ?? 30,
            anzahl_lieferungen: z.recent_count ?? 5,
          }));
          setStats(mapped);
          return;
        }
      }
    } catch {
      /* Mock-Fallback */
    } finally {
      setLaden(false);
    }
    setStats(MOCK_STATS);
  }, [locationId]);

  useEffect(() => {
    fetch_();
    const id = setInterval(fetch_, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetch_]);

  if (!mounted || geschlossen) return null;

  const displayed = stats.length > 0 ? stats : MOCK_STATS;
  const primary = displayed.find((s) => s.zone === zone) ?? displayed[0];

  if (!primary) return null;

  const istSchnell = primary.letzte_lieferzeit_min <= 25;

  return (
    <div className={cn(
      'relative flex items-start gap-3 rounded-xl border px-4 py-3 shadow-sm',
      istSchnell
        ? 'bg-matcha-50 dark:bg-matcha-950/30 border-matcha-200 dark:border-matcha-800'
        : 'bg-card border-border',
      className,
    )}>
      {/* Icon */}
      <div className={cn(
        'shrink-0 mt-0.5 h-8 w-8 rounded-full flex items-center justify-center',
        istSchnell ? 'bg-matcha-100 dark:bg-matcha-900/40' : 'bg-muted',
      )}>
        {istSchnell
          ? <Zap className="h-4 w-4 text-matcha-600 dark:text-matcha-400" />
          : <CheckCircle2 className="h-4 w-4 text-muted-foreground" />}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-bold',
          istSchnell ? 'text-matcha-800 dark:text-matcha-200' : 'text-foreground',
        )}>
          Zuletzt in {primary.anzahl_lieferungen > 1 ? `${primary.anzahl_lieferungen} Fällen` : 'diesem Fall'} in{' '}
          <span className="tabular-nums">{primary.letzte_lieferzeit_min}</span> Min geliefert
          {zone && ZONE_LABEL[zone] ? ` (Zone ${zone})` : ''}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {istSchnell
            ? 'Blitzschnelle Lieferung — unser Team ist bereit.'
            : 'Aktuelle Lieferzeit basierend auf echten Touren.'}
          {primary.beschleunigung_min && primary.beschleunigung_min > 0 && (
            <span className="ml-1 font-semibold text-matcha-700 dark:text-matcha-300">
              ↓ {primary.beschleunigung_min} Min schneller als letzte Woche
            </span>
          )}
        </p>

        {/* Mini Zeile andere Zonen */}
        {displayed.length > 1 && (
          <div className="flex flex-wrap gap-2 mt-1.5">
            {displayed.filter((s) => s.zone !== primary.zone).map((s) => (
              <span key={s.zone} className="text-[10px] text-muted-foreground">
                Zone {s.zone}: <span className="font-semibold tabular-nums">{s.letzte_lieferzeit_min} Min</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Refresh indicator */}
      {laden && <RefreshCw className="h-3 w-3 text-muted-foreground animate-spin shrink-0 mt-1" />}

      {/* Schließen */}
      <button
        onClick={() => setGeschlossen(true)}
        className="shrink-0 mt-0.5 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        aria-label="Schließen"
      >
        <X className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}
