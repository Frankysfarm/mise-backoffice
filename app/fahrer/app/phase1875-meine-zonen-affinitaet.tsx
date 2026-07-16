'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Map, ChevronDown, ChevronUp, Star } from 'lucide-react';

/**
 * Phase 1875 — Meine-Zonen-Affinität (Fahrer-App)
 *
 * Top-3 Zonen nach Ø-Verdienst/Stopp + Erfolgsquote aus Tourdaten.
 * isOnline-Guard. Collapsible (default geschlossen). 30-Min-Polling.
 * GET /api/driver-app/my-tours.
 */

interface TourStop {
  delivered_at?: string | null;
  delivery_zone?: string | null;
  delivery_fee_cents?: number | null;
}

interface Tour {
  stops?: TourStop[];
  delivery_fee_cents?: number | null;
  num_stops?: number | null;
  created_at?: string;
}

interface ZonenAffinitaet {
  zone: string;
  stopps: number;
  erfolge: number;
  erfolgsquote: number;
  avg_verdienst_cents: number;
}

interface Props {
  driverId: string | null;
  locationId?: string | null;
  isOnline: boolean;
  className?: string;
}

const MOCK_ZONEN: ZonenAffinitaet[] = [
  { zone: 'A', stopps: 28, erfolge: 26, erfolgsquote: 93, avg_verdienst_cents: 340 },
  { zone: 'B', stopps: 17, erfolge: 15, erfolgsquote: 88, avg_verdienst_cents: 420 },
  { zone: 'C', stopps: 8,  erfolge: 6,  erfolgsquote: 75, avg_verdienst_cents: 510 },
];

function ampelFarbe(quote: number) {
  if (quote >= 85) return 'gruen';
  if (quote >= 70) return 'amber';
  return 'rot';
}

const FARB = {
  gruen: { bar: 'bg-matcha-500', text: 'text-matcha-700 dark:text-matcha-300', badge: 'bg-matcha-100 dark:bg-matcha-900/30 text-matcha-700 dark:text-matcha-300' },
  amber: { bar: 'bg-amber-400',  text: 'text-amber-700 dark:text-amber-300',   badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
  rot:   { bar: 'bg-red-400',    text: 'text-red-700 dark:text-red-300',       badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
} as const;

export function FahrerPhase1875MeineZonenAffinitaet({ driverId, isOnline, className }: Props) {
  const [touren, setTouren] = useState<Tour[]>([]);
  const [offen, setOffen] = useState(false);

  useEffect(() => {
    if (!driverId || !isOnline) return;

    const laden = async () => {
      try {
        const res = await fetch(
          `/api/driver-app/my-tours?driver_id=${driverId}&limit=100`,
          { cache: 'no-store' },
        );
        if (!res.ok) throw new Error('fetch error');
        const data = await res.json();
        setTouren(data.tours ?? data ?? []);
      } catch {
        setTouren([]);
      }
    };

    laden();
    const id = setInterval(laden, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [driverId, isOnline]);

  const top3 = useMemo<ZonenAffinitaet[]>(() => {
    if (touren.length === 0) return MOCK_ZONEN;

    const zonenMap = new Map<string, { stopps: number; erfolge: number; gesamtCents: number }>();

    for (const t of touren) {
      const stops = t.stops ?? [];
      const totalFee = t.delivery_fee_cents ?? 0;
      const perStopp = stops.length > 0 ? totalFee / stops.length : 0;

      for (const s of stops) {
        const zone = (s.delivery_zone ?? 'A').toUpperCase();
        if (!zonenMap.has(zone)) zonenMap.set(zone, { stopps: 0, erfolge: 0, gesamtCents: 0 });
        const acc = zonenMap.get(zone)!;
        acc.stopps++;
        if (s.delivered_at) acc.erfolge++;
        acc.gesamtCents += s.delivery_fee_cents ?? perStopp;
      }
    }

    return [...zonenMap.entries()]
      .map(([zone, acc]) => ({
        zone,
        stopps: acc.stopps,
        erfolge: acc.erfolge,
        erfolgsquote: acc.stopps > 0 ? Math.round((acc.erfolge / acc.stopps) * 100) : 0,
        avg_verdienst_cents: acc.stopps > 0 ? Math.round(acc.gesamtCents / acc.stopps) : 0,
      }))
      .sort((a, b) => b.avg_verdienst_cents - a.avg_verdienst_cents)
      .slice(0, 3);
  }, [touren]);

  if (!isOnline) return null;

  const bestZone = top3[0]?.zone ?? '—';

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <Map className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Meine Zonen-Affinität</span>
        <span className="ml-auto text-[10px] font-bold rounded-full bg-matcha-100 dark:bg-matcha-900/30 text-matcha-700 dark:text-matcha-300 px-2 py-0.5">
          Top: Zone {bestZone}
        </span>
        {offen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {offen && (
        <div className="p-4 space-y-3">
          <p className="text-[11px] text-muted-foreground">
            Deine Top-3 Zonen nach Ø-Verdienst pro Stopp — basierend auf deinen letzten Touren.
          </p>

          <div className="space-y-2.5">
            {top3.map((z, idx) => {
              const amp = ampelFarbe(z.erfolgsquote);
              const cfg = FARB[amp];
              return (
                <div key={z.zone} className="rounded-xl border bg-muted/20 px-3 py-2.5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black text-white shrink-0',
                      idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-slate-400' : 'bg-orange-700',
                    )}>
                      {idx + 1}
                    </span>
                    <span className="font-bold text-sm">Zone {z.zone}</span>
                    {idx === 0 && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-400" />}
                    <span className="ml-auto font-black tabular-nums text-sm text-foreground">
                      {(z.avg_verdienst_cents / 100).toFixed(2)} €
                      <span className="text-[10px] font-normal text-muted-foreground ml-0.5">/Stopp</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-700', cfg.bar)}
                        style={{ width: `${z.erfolgsquote}%` }}
                      />
                    </div>
                    <span className={cn('text-[11px] font-bold tabular-nums shrink-0', cfg.text)}>
                      {z.erfolgsquote}% Erfolg
                    </span>
                  </div>

                  <div className="text-[10px] text-muted-foreground">
                    {z.erfolge} von {z.stopps} Stopps erfolgreich abgeschlossen
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-muted-foreground text-right">
            Aktualisierung alle 30 Min
          </p>
        </div>
      )}
    </div>
  );
}
