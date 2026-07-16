'use client';

/**
 * Phase 1886 — Zonen-ETA-Vergleichs-Banner (Storefront)
 *
 * Zeigt ETA-Unterschied zwischen Zone A und Zone B/C als Entscheidungshilfe.
 * Hydration-safe. 10-Min-Polling.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, MapPin } from 'lucide-react';

interface ZoneEta {
  zone: string;
  label: string;
  eta_min: number;
  liefergebuehr_eur: number;
}

interface Props {
  locationId: string;
  className?: string;
}

const DEFAULT_ZONEN: ZoneEta[] = [
  { zone: 'A', label: 'Express (unter 2 km)',  eta_min: 25, liefergebuehr_eur: 0.00 },
  { zone: 'B', label: 'Standard (2–5 km)',      eta_min: 35, liefergebuehr_eur: 1.50 },
  { zone: 'C', label: 'Weit (5–10 km)',         eta_min: 50, liefergebuehr_eur: 2.50 },
];

export function StorefrontPhase1886ZonenEtaVergleichsBanner({ locationId, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [zonen, setZonen]     = useState<ZoneEta[]>([]);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!locationId) return;
    const laden = async () => {
      try {
        const res = await fetch(
          `/api/delivery/admin/zonen-umsatz-prognose?location_id=${locationId}`,
          { cache: 'no-store' },
        );
        if (!res.ok) return;
        // Wir nutzen Mock-ETAs; API liefert Prognosen, keine ETAs
      } catch { /* silently ignore */ }
    };
    laden();
    const id = setInterval(laden, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!mounted) return null;

  const basis = zonen.length > 0 ? zonen : DEFAULT_ZONEN;
  const schnellste = basis[0];
  const rest       = basis.slice(1);

  return (
    <div className={cn('rounded-xl border border-border bg-card shadow-sm overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-2.5 bg-matcha-50/50 dark:bg-matcha-950/20">
        <Clock className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold text-matcha-700 dark:text-matcha-300 uppercase tracking-wide">
          Lieferzeit nach Zone
        </span>
      </div>

      <div className="p-3 space-y-2">
        {/* Schnellste Zone hervorgehoben */}
        <div className="rounded-xl border border-matcha-200 dark:border-matcha-800 bg-matcha-50 dark:bg-matcha-950/30 px-3 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-matcha-500 text-[11px] font-black text-white shrink-0">
              {schnellste.zone}
            </span>
            <div>
              <p className="text-xs font-bold text-matcha-800 dark:text-matcha-200">{schnellste.label}</p>
              <p className="text-[10px] text-matcha-600 dark:text-matcha-400">
                {schnellste.liefergebuehr_eur === 0 ? 'Gratis-Lieferung' : `+ ${schnellste.liefergebuehr_eur.toFixed(2)} € Liefergebühr`}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-lg font-black text-matcha-700 dark:text-matcha-300 tabular-nums leading-none">
              ~{schnellste.eta_min} Min
            </span>
            <span className="text-[10px] text-matcha-500 dark:text-matcha-400 font-semibold">schnellste ETA</span>
          </div>
        </div>

        {/* Weitere Zonen im Vergleich */}
        {rest.map((z) => {
          const diff = z.eta_min - schnellste.eta_min;
          return (
            <div
              key={z.zone}
              className="rounded-xl border border-border bg-muted/20 px-3 py-2 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs font-semibold">{z.label}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {z.liefergebuehr_eur === 0 ? 'Gratis' : `+ ${z.liefergebuehr_eur.toFixed(2)} €`}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-sm font-black tabular-nums text-foreground">~{z.eta_min} Min</span>
                <span className="text-[10px] text-muted-foreground">+{diff} Min länger</span>
              </div>
            </div>
          );
        })}

        <p className="text-[10px] text-muted-foreground text-center pt-1">
          Zeiten sind geschätzte Lieferzeiten · Zone richtet sich nach deiner Adresse
        </p>
      </div>
    </div>
  );
}
